/**
 * Sadece landing galeri kapaklarını doldurur (kota dostu, yavaş).
 * Kullanım: npx tsx --env-file=.env.local scripts/sync-gallery-thumbs-only.ts
 */
import {
  enrichGalleryThumbnails,
  getLandingGalleryItems,
  saveLandingGalleryItems,
  buildItemFromParsed,
  youtubeThumb,
} from "../src/lib/landing-gallery";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";
import { detectPlatform } from "../src/lib/social-api/platform-detect";
import { fetchRichDetailsForLink } from "../src/lib/social-api/clients";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // Rate limit soğusun
  console.log("Bekleme 8s (rate limit)…");
  await sleep(8000);

  let items = await getLandingGalleryItems();
  console.log(
    "Başlangıç:",
    items.map((i) => `${i.id} thumb=${Boolean(i.thumbnailUrl)}`).join(" | "),
  );

  // Önce mevcut eksikleri doldur
  const pass1 = await enrichGalleryThumbnails(items, { force: false, delayMs: 2000 });
  items = pass1.items;
  console.log(`Pass1 filled=${pass1.filled} failed=${pass1.failed}`);

  // Hâlâ kapaksız IG: brand_links’ten alternatif yüksek izlenen reel bul
  const stillMissing = items.filter((i) => !i.thumbnailUrl?.trim() && i.platform === "instagram");
  if (stillMissing.length > 0) {
    console.log(`${stillMissing.length} IG hâlâ kapaksız — alternatif aranıyor…`);
    const { data: links } = await getSupabaseAdmin()
      .from("brand_links")
      .select("url, platform, last_views, brand_id")
      .ilike("platform", "%instagram%")
      .not("last_views", "is", null)
      .gte("last_views", 500_000)
      .order("last_views", { ascending: false })
      .limit(40);

    const used = new Set(items.map((i) => i.id));
    const candidates = (links ?? [])
      .map((row) => {
        const r = row as { url: string; last_views: number | null };
        return buildItemFromParsed({ url: r.url, views: r.last_views ?? 0, brand: "Padişahbet" });
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x) && !used.has(x!.id));

    for (const miss of stillMissing) {
      let replaced = false;
      for (const cand of candidates) {
        if (used.has(cand.id)) continue;
        await sleep(2000);
        const detected = detectPlatform(cand.url, "instagram", undefined, cand.externalId);
        if (!detected) continue;
        try {
          const details = await fetchRichDetailsForLink(detected, { includePremium: false });
          const thumb = details.thumbnailUrl?.trim();
          if (!thumb) {
            console.log(`  candidate ${cand.id} no thumb`);
            continue;
          }
          const idx = items.findIndex((i) => i.id === miss.id);
          if (idx < 0) break;
          const nextItem = {
            ...cand,
            brand: miss.brand,
            color: miss.color,
            thumbnailUrl: thumb,
            title: details.title?.slice(0, 80) || cand.title,
            views: Math.max(cand.views, details.metrics.views ?? 0),
          };
          console.log(`  REPLACE ${miss.id} → ${nextItem.id} thumb=ok views=${nextItem.views}`);
          items[idx] = nextItem;
          used.add(nextItem.id);
          used.delete(miss.id);
          replaced = true;
          break;
        } catch (e) {
          console.log(`  candidate ${cand.id} err: ${e instanceof Error ? e.message : e}`);
        }
      }
      if (!replaced) {
        // Son çare: YouTube yedek (görsel boş kalmasın) — aynı sıradaki YT yoksa atla
        console.log(`  KEEP ${miss.id} (alternatif bulunamadı)`);
      }
    }
  }

  // YouTube garantisi
  items = items.map((i) =>
    i.platform === "youtube"
      ? { ...i, thumbnailUrl: i.thumbnailUrl || youtubeThumb(i.externalId) }
      : i,
  );

  await saveLandingGalleryItems(items);
  console.log(
    "Sonuç:",
    items.map((i) => `${i.id}=${i.thumbnailUrl ? "ok" : "YOK"}`).join(", "),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
