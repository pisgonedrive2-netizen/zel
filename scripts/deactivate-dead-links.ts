/**
 * Silinmiş / erişilemeyen IG reel & post linklerini inactive yapar.
 * Profil URL’lerine dokunmaz.
 *
 * Kullanım: npx tsx --env-file=.env.local scripts/deactivate-dead-links.ts [limit=80]
 */
import { getSupabaseAdmin } from "../src/lib/supabase/admin";
import { detectPlatform } from "../src/lib/social-api/platform-detect";
import { fetchMetricsForLink } from "../src/lib/social-api/clients";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function isMediaUrl(url: string): boolean {
  return /\/(reel|reels|p|tv)\//i.test(url);
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("limit="));
  const limit = Math.min(200, Math.max(10, Number(limitArg?.split("=")[1] ?? 80) || 80));

  const { data } = await getSupabaseAdmin()
    .from("brand_links")
    .select("id, url, platform, handle, external_ref, error_count, last_views, last_checked_at")
    .eq("status", "active")
    .or("platform.ilike.%instagram%,url.ilike.%instagram.com%")
    .order("error_count", { ascending: false })
    .limit(400);

  const candidates = (data ?? [])
    .map((r) => r as {
      id: string;
      url: string;
      platform: string;
      handle: string | null;
      external_ref: string | null;
      error_count: number | null;
    })
    .filter((r) => isMediaUrl(r.url))
    .slice(0, limit);

  console.log(`Aday reel/post: ${candidates.length} (limit=${limit})`);
  let deactivated = 0;
  let ok = 0;
  let otherFail = 0;

  for (const r of candidates) {
    const detected = detectPlatform(
      r.url,
      r.platform,
      r.handle ?? undefined,
      r.external_ref ?? undefined,
    );
    if (!detected || detected.kind === "user") {
      console.log(`skip-non-media ${r.id}`);
      continue;
    }
    await sleep(1400);
    try {
      await fetchMetricsForLink(detected);
      await getSupabaseAdmin()
        .from("brand_links")
        .update({
          error_count: 0,
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      ok += 1;
      console.log(`ok ${r.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/404|not found|unavailable|couldn't find/i.test(msg)) {
        const { error } = await getSupabaseAdmin()
          .from("brand_links")
          .update({
            status: "inactive",
            last_checked_at: new Date().toISOString(),
          })
          .eq("id", r.id);
        if (error) console.error("update fail", r.id, error.message);
        else {
          deactivated += 1;
          console.log(`inactive ${r.id}: ${msg.slice(0, 90)}`);
        }
      } else {
        otherFail += 1;
        console.log(`fail ${r.id}: ${msg.slice(0, 90)}`);
      }
    }
  }

  console.log(`done ok=${ok} deactivated=${deactivated} otherFail=${otherFail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
