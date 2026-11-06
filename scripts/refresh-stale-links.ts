/**
 * Stale / hatalı brand_links izlenmelerini yeniler (kota dostu).
 * Kullanım: npx tsx --env-file=.env.local scripts/refresh-stale-links.ts
 */
import { refreshAllLinksBulk } from "../src/lib/social-api/refresh-runner";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";

async function main() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: stale } = await getSupabaseAdmin()
    .from("brand_links")
    .select("id")
    .eq("status", "active")
    .or(`last_checked_at.is.null,last_checked_at.lt.${weekAgo},error_count.gt.0`)
    .limit(80);

  const linkIds = (stale ?? []).map((r) => String((r as { id: string }).id));
  console.log(`Stale/hatalı aday: ${linkIds.length}`);
  if (linkIds.length === 0) {
    console.log("Yenilenecek yok.");
    return;
  }

  const summary = await refreshAllLinksBulk({
    userId: "script:refresh-stale-links",
    linkIds,
    linkScope: "all",
  });
  console.log(
    `attempted=${summary.attempted} ok=${summary.succeeded} fail=${summary.failed} quotaSkip=${summary.skippedQuota}`,
  );
  const fails = summary.results.filter((r) => !r.ok).slice(0, 12);
  for (const f of fails) {
    console.log(`fail ${f.linkId}: ${f.error ?? "?"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
