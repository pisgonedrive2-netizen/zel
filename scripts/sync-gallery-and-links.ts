/**
 * Landing galeri eksik kapaklarını doldur + stale brand_links izlenmelerini yenile.
 * Kullanım: npx tsx --env-file=.env.local scripts/sync-gallery-and-links.ts
 */
import {
  enrichGalleryThumbnails,
  getLandingGalleryItems,
  saveLandingGalleryItems,
} from "../src/lib/landing-gallery";
import { refreshAllLinksBulk } from "../src/lib/social-api/refresh-runner";

async function main() {
  console.log("1) Landing galeri kapakları…");
  const current = await getLandingGalleryItems();
  const missing = current.filter((i) => !i.thumbnailUrl?.trim());
  console.log(`   ${current.length} öğe, ${missing.length} kapaksız`);
  const enriched = await enrichGalleryThumbnails(current, { force: false, delayMs: 400 });
  const saved = await saveLandingGalleryItems(enriched.items);
  console.log(
    `   doldurulan=${enriched.filled} başarısız=${enriched.failed} atlanan=${enriched.skipped}`,
  );
  console.log(
    "   kapak durumu:",
    saved.map((s) => `${s.platform}:${s.externalId}=${s.thumbnailUrl ? "ok" : "YOK"}`).join(", "),
  );

  console.log("2) Brand link izlenmeleri (tümü)…");
  const summary = await refreshAllLinksBulk({
    userId: "script:sync-gallery-and-links",
    linkScope: "all",
  });
  console.log(
    `   attempted=${summary.attempted} ok=${summary.succeeded} fail=${summary.failed} quotaSkip=${summary.skippedQuota}`,
  );
  if (summary.failed > 0) {
    const sample = summary.results.filter((r) => !r.ok).slice(0, 8);
    for (const r of sample) {
      console.log(`   fail ${r.linkId}: ${r.error ?? "?"}`);
    }
  }

  console.log("3) Galeri izlenmelerini brand_links ile hizala…");
  const after = await getLandingGalleryItems();
  const { getSupabaseAdmin } = await import("../src/lib/supabase/admin");
  const { data: links } = await getSupabaseAdmin()
    .from("brand_links")
    .select("url, platform, last_views, external_ref")
    .not("last_views", "is", null)
    .order("last_views", { ascending: false })
    .limit(500);

  const { buildItemFromParsed } = await import("../src/lib/landing-gallery");
  const viewsById = new Map<string, number>();
  for (const row of links ?? []) {
    const r = row as { url: string; last_views: number | null };
    const built = buildItemFromParsed({ url: r.url, views: r.last_views ?? 0 });
    if (built) viewsById.set(built.id, built.views);
  }
  const synced = after.map((it) => ({
    ...it,
    views: viewsById.get(it.id) ?? it.views,
  }));
  await saveLandingGalleryItems(synced);
  console.log("   galeri views senkronlandı.");
  console.log("Bitti.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
