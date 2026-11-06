/**
 * Klip + marka link izlenme durumu özeti; isteğe bağlı örnek yenileme.
 * npx tsx --env-file=.env.local scripts/audit-video-views.ts
 * npx tsx --env-file=.env.local scripts/audit-video-views.ts --refresh-sample 3
 */
import { getSupabaseAdmin } from "../src/lib/supabase/admin";
import { submissionFromRow } from "../src/lib/clip-farm/types";
import { brandLinkFromRow } from "../src/lib/db/mappers";
import { isRapidApiEnabled } from "../src/lib/env";
import { refreshSubmission } from "../src/lib/clip-farm/server";

const refreshN = (() => {
  const i = process.argv.indexOf("--refresh-sample");
  if (i === -1) return 0;
  const n = Number(process.argv[i + 1] ?? "2");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 2;
})();

async function main() {
  console.log("RapidAPI:", isRapidApiEnabled() ? "açık" : "KAPALI (RAPIDAPI_KEY yok)");
  const db = getSupabaseAdmin();

  const { data: clipRows, error: ce } = await db
    .from("clip_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (ce) throw ce;
  const clips = (clipRows ?? []).map((r) => submissionFromRow(r as Record<string, unknown>));

  const byStatus = { pending: 0, approved: 0, rejected: 0 };
  let clipNoViews = 0;
  let clipWithError = 0;
  let clipStale = 0;
  const now = Date.now();
  const staleMs = 7 * 24 * 3600 * 1000;

  for (const s of clips) {
    byStatus[s.status]++;
    if (s.views == null && !s.lastCheckError) clipNoViews++;
    if (s.lastCheckError) clipWithError++;
    if (s.lastCheckedAt && now - Date.parse(s.lastCheckedAt) > staleMs) clipStale++;
  }

  console.log("\n--- Klip gönderimleri (son 500) ---");
  console.log("Durum:", byStatus);
  console.log("Hiç ölçülmemiş (views null, hata yok):", clipNoViews);
  console.log("Son ölçüm hatalı:", clipWithError);
  console.log("7+ gün eski ölçüm:", clipStale);

  const errSamples = clips.filter((s) => s.lastCheckError).slice(0, 5);
  if (errSamples.length) {
    console.log("\nHata örnekleri:");
    for (const s of errSamples) {
      console.log(`  ${s.platform} ${s.status} views=${s.views ?? "—"} | ${s.lastCheckError?.slice(0, 80)}`);
      console.log(`    ${s.url.slice(0, 70)}…`);
    }
  }

  const okSamples = clips
    .filter((s) => s.status === "approved" && s.views != null && !s.lastCheckError)
    .slice(0, 5);
  if (okSamples.length) {
    console.log("\nOnaylı + sayılı örnekler:");
    for (const s of okSamples) {
      console.log(
        `  ${s.views?.toLocaleString()} izlenme · ${s.likes ?? 0} beğeni · ${s.platform} · ${s.lastCheckedAt?.slice(0, 10) ?? "?"}`,
      );
      console.log(`    ${s.url.slice(0, 72)}`);
    }
  }

  const { data: linkRows, error: le } = await db
    .from("brand_links")
    .select("id,platform,url,last_views,last_checked_at,last_check_error,auto_track")
    .eq("auto_track", true)
    .order("last_checked_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (le) throw le;
  const links = (linkRows ?? []).map((r) => brandLinkFromRow(r as Record<string, unknown>));

  let linkNoCheck = 0;
  let linkError = 0;
  let linkZeroViews = 0;
  for (const l of links) {
    if (!l.lastCheckedAt) linkNoCheck++;
    if (l.lastCheckError) linkError++;
    if ((l.lastViews ?? 0) === 0 && l.lastCheckedAt && !l.lastCheckError) linkZeroViews++;
  }

  console.log("\n--- Otomatik izlenen marka linkleri (son 300) ---");
  console.log("Toplam auto_track:", links.length);
  console.log("Hiç kontrol edilmemiş:", linkNoCheck);
  console.log("last_check_error:", linkError);
  console.log("0 izlenme (hatasız ölçüm):", linkZeroViews);

  const linkErr = links.filter((l) => l.lastCheckError).slice(0, 5);
  if (linkErr.length) {
    console.log("\nLink hata örnekleri:");
    for (const l of linkErr) {
      console.log(`  ${l.platform} views=${l.lastViews ?? "—"} | ${l.lastCheckError?.slice(0, 80)}`);
    }
  }

  if (refreshN > 0 && isRapidApiEnabled()) {
    const targets = clips
      .filter((s) => (s.status === "approved" || s.status === "pending") && s.url)
      .slice(0, refreshN);
    console.log(`\n--- Canlı yenileme (${targets.length} klip) ---`);
    for (const t of targets) {
      const r = await refreshSubmission({ id: t.id, url: t.url, platform: t.platform });
      const { data: row } = await db.from("clip_submissions").select("views,likes,last_check_error").eq("id", t.id).single();
      console.log(
        r.ok ? "OK" : "FAIL",
        row?.views ?? "—",
        "izlenme",
        row?.last_check_error ? `| ${String(row.last_check_error).slice(0, 60)}` : "",
      );
      console.log(`  ${t.url.slice(0, 72)}`);
    }
  } else if (refreshN > 0) {
    console.log("\n(--refresh-sample atlandı: RAPIDAPI_KEY yok)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
