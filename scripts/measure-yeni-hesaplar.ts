/** Tüm aktif yeni hesapları tek tek ölçer. */
import { createClient } from "@supabase/supabase-js";
import { detectPlatform } from "../src/lib/social-api/platform-detect";
import { fetchMetricsForLink } from "../src/lib/social-api/clients";

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: links, error } = await db
    .from("brand_links")
    .select("id,platform,handle,url")
    .eq("brand_id", "br-yeni-hesaplar")
    .eq("status", "active")
    .order("platform")
    .order("handle");
  if (error) throw error;

  let ok = 0;
  let fail = 0;
  for (const row of links ?? []) {
    const label = `${row.platform} ${row.handle}`;
    process.stdout.write(`${label} ... `);
    try {
      const d = detectPlatform(row.url, row.platform, row.handle);
      if (!d) throw new Error("URL desteklenmiyor");
      const m = await fetchMetricsForLink(d);
      const now = new Date().toISOString();
      const { error: up } = await db
        .from("brand_links")
        .update({
          last_views: m.views,
          last_shares: m.shares,
          last_likes: m.likes,
          last_checked_at: now,
          last_check_error: null,
          last_refresh_status: "ok",
          external_ref: d.externalRef,
        })
        .eq("id", row.id);
      if (up) throw up;
      console.log(`ok views=${m.views ?? "—"} shares=${m.shares ?? "—"}`);
      ok += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db
        .from("brand_links")
        .update({
          last_check_error: msg.slice(0, 240),
          last_refresh_status: "error",
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      console.log(`ERR ${msg.slice(0, 120)}`);
      fail += 1;
    }
  }
  console.log(`\ndone ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
