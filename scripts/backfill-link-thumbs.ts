/**
 * IG/TikTok video linklerinin kapaklarını link-thumbs bucket'ına kopyalar.
 * Kullanım: npx tsx --env-file=.env.local scripts/backfill-link-thumbs.ts [instagram|tiktok]
 */
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseMediaRef } from "@/lib/media-ref";
import { resolveFreeThumb } from "@/lib/social-api/free-thumbnails";

async function main() {
  const only = process.argv[2];
  const urls: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await getSupabaseAdmin()
      .from("brand_links")
      .select("url")
      .range(from, from + 999);
    if (error) throw error;
    for (const row of data ?? []) {
      const ref = row.url ? parseMediaRef(row.url) : null;
      if (!ref || ref.platform === "youtube") continue;
      if (only && ref.platform !== only) continue;
      urls.push(row.url);
    }
    if (!data || data.length < 1000) break;
  }
  const unique = [...new Set(urls)];
  console.log(`${unique.length} link`);
  let ok = 0;
  let miss = 0;
  for (const [i, url] of unique.entries()) {
    const t = await resolveFreeThumb(url);
    if (t.thumbnailUrl?.includes("/link-thumbs/")) ok++;
    else miss++;
    if ((i + 1) % 25 === 0) console.log(`${i + 1}/${unique.length} · kayıtlı ${ok} · yok ${miss}`);
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`bitti · kayıtlı ${ok} · yok ${miss}`);
}

void main();
