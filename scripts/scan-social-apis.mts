/**
 * One-off: probe RapidAPI hosts + refresh never-checked / stale / failed links.
 * Usage: npx tsx --env-file=.env.local scripts/scan-social-apis.mts
 */
import { getRateLimitSnapshot, rapidApiGet } from "../src/lib/social-api/clients";
import { refreshAllLinksBulk } from "../src/lib/social-api/refresh-runner";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";

async function probe() {
  console.log("=== API probes ===");
  const jobs: Array<[string, () => Promise<unknown>]> = [
    ["youtube /video/details/", () => rapidApiGet("youtube", "/video/details/", { id: "jNQXAC9IVRw" })],
    ["instagram /profile", () => rapidApiGet("instagram", "/profile", { username: "natgeo" })],
    ["tiktok /user/info", () => rapidApiGet("tiktok", "/user/info", { unique_id: "@tiktok" })],
  ];
  for (const [label, fn] of jobs) {
    const t0 = Date.now();
    try {
      await fn();
      const plat = label.split(" ")[0] as "youtube" | "instagram" | "tiktok";
      const rl = getRateLimitSnapshot(plat);
      console.log(`OK  ${label} ${Date.now() - t0}ms  remaining=${rl?.remaining}/${rl?.limit}`);
    } catch (e) {
      console.log(`FAIL ${label} ${Date.now() - t0}ms  ${(e as Error).message.slice(0, 140)}`);
    }
  }
}

function platKey(p: string | null | undefined): string {
  const s = (p || "").toLowerCase();
  if (s.includes("youtube")) return "youtube";
  if (s.includes("instagram")) return "instagram";
  if (s.includes("tiktok")) return "tiktok";
  return s || "?";
}

async function inventory() {
  const db = getSupabaseAdmin();
  const { data: links } = await db
    .from("brand_links")
    .select("id, platform, last_checked_at, last_check_error, auto_track, status")
    .eq("status", "active")
    .eq("auto_track", true);
  const rows = links ?? [];
  const never = rows.filter((l) => !l.last_checked_at);
  const errored = rows.filter((l) => l.last_check_error);
  console.log(`=== Inventory: auto_track=${rows.length} never=${never.length} errored=${errored.length}`);
  return { rows, never, errored };
}

async function refreshIds(label: string, ids: string[]) {
  if (ids.length === 0) {
    console.log(`\n=== ${label}: nothing ===`);
    return;
  }
  console.log(`\n=== ${label} (${ids.length}) ===`);
  const s = await refreshAllLinksBulk({
    linkIds: ids,
    userId: "script:scan-social-apis",
  });
  console.log(
    `${label} attempted=${s.attempted} ok=${s.succeeded} fail=${s.failed} skipQuota=${s.skippedQuota}`
  );
  for (const f of s.results.filter((r) => !r.ok).slice(0, 6)) {
    console.log(`  fail ${f.linkId.slice(0, 8)} ${f.platform}: ${f.error?.slice(0, 110)}`);
  }
}

async function main() {
  await probe();
  const { rows, never, errored } = await inventory();

  // 1) Never checked (mostly TikTok short links) — historical gap
  await refreshIds(
    "never-checked",
    never.map((l) => String(l.id)).slice(0, 120)
  );

  // 2) Instagram rate-limit leftovers (retryable now that daily window reset)
  const igRate = errored
    .filter(
      (l) =>
        platKey(l.platform) === "instagram" &&
        /rate limit|istek limiti|429/i.test(String(l.last_check_error ?? ""))
    )
    .map((l) => String(l.id))
    .slice(0, 80);
  await refreshIds("instagram-rate-limit-retry", igRate);

  // 3) YouTube stale / errored (v1 fallback covers flaky v2)
  const cutoff = Date.now() - 24 * 3600_000;
  const yt = rows
    .filter((l) => platKey(l.platform) === "youtube")
    .filter(
      (l) =>
        Boolean(l.last_check_error) ||
        !l.last_checked_at ||
        new Date(l.last_checked_at).getTime() < cutoff
    )
    .map((l) => String(l.id))
    .slice(0, 60);
  await refreshIds("youtube-stale-or-error", yt);

  await inventory();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
