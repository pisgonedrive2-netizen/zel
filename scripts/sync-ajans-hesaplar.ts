/**
 * Ajans hesap listesini canlı DB ile hizalar.
 * - br-yeni-hesaplar altında IG/YT/TT profilleri (Naz/Ponpon notlarıyla)
 * - Ramiz streamer_accounts altında Telegram / Facebook / Pornhub
 *
 * Kullanım: npx tsx --env-file=.env.local scripts/sync-ajans-hesaplar.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  AJANS_DIGER_HESAPLAR,
  YENI_HESAPLAR,
  YENI_HESAPLAR_BRAND_ID,
  notesForYeniHesap,
  yeniHesapLinkId,
} from "../src/lib/yeni-hesaplar";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY gerekli");

const db = createClient(url, key);
const EMP_RAMIZ = "emp-ramiz";

async function ensureBrand() {
  const { data } = await db.from("brands").select("id").eq("id", YENI_HESAPLAR_BRAND_ID).maybeSingle();
  if (data) return;
  const { error } = await db.from("brands").insert({
    id: YENI_HESAPLAR_BRAND_ID,
    name: "Yeni Hesaplar",
    short_name: "Yeni",
    category: "Yeni hesaplar",
    status: "paused",
    organization_id: "org-foxstream",
    notes: "Ajansın yeni profil hesapları. Eski marka linkleri durur.",
  });
  if (error) throw new Error(`brand insert: ${error.message}`);
  console.log("brand created", YENI_HESAPLAR_BRAND_ID);
}

async function syncYeniHesaplar() {
  await ensureBrand();
  const wantIds = new Set(YENI_HESAPLAR.map(yeniHesapLinkId));
  const rows = YENI_HESAPLAR.map((a) => ({
    id: yeniHesapLinkId(a),
    brand_id: YENI_HESAPLAR_BRAND_ID,
    platform: a.platform,
    handle: a.handle,
    url: a.url,
    notes: notesForYeniHesap(a),
    status: "active",
    owner_id: null,
  }));

  const { error: upErr } = await db.from("brand_links").upsert(rows, { onConflict: "id" });
  if (upErr) throw new Error(`yeni upsert: ${upErr.message}`);
  console.log("yeni upserted", rows.length);

  const { data: existing, error: listErr } = await db
    .from("brand_links")
    .select("id, handle, status")
    .eq("brand_id", YENI_HESAPLAR_BRAND_ID);
  if (listErr) throw new Error(listErr.message);

  const drop = (existing ?? []).filter((r) => !wantIds.has(r.id) && r.status === "active");
  if (drop.length > 0) {
    const { error } = await db
      .from("brand_links")
      .update({ status: "inactive" })
      .in(
        "id",
        drop.map((r) => r.id)
      );
    if (error) throw new Error(`deactivate: ${error.message}`);
    console.log(
      "deactivated",
      drop.map((r) => r.handle).join(", ")
    );
  }
}

function normHandle(h: string) {
  return h.replace(/^@/, "").trim().toLowerCase();
}

async function syncDiger() {
  const { data: existing, error } = await db
    .from("streamer_accounts")
    .select("id, platform, handle, url, notes, status")
    .eq("employee_id", EMP_RAMIZ);
  if (error) throw new Error(error.message);
  const list = existing ?? [];

  for (const spec of AJANS_DIGER_HESAPLAR) {
    const want = normHandle(spec.handle);
    const hit = list.find(
      (r) =>
        r.platform.toLowerCase() === spec.platform.toLowerCase() &&
        normHandle(r.handle) === want
    );
    if (hit) {
      const { error: upd } = await db
        .from("streamer_accounts")
        .update({
          url: spec.url,
          notes: spec.notes || hit.notes || "",
          status: "active",
          handle: spec.handle,
        })
        .eq("id", hit.id);
      if (upd) throw new Error(`update ${spec.handle}: ${upd.message}`);
      console.log("updated", spec.platform, spec.handle);
    } else {
      const id = `sa-ramiz-${spec.platform.toLowerCase().slice(0, 2)}-${want}`.replace(/[^a-z0-9-]/g, "");
      const { error: ins } = await db.from("streamer_accounts").insert({
        id,
        employee_id: EMP_RAMIZ,
        platform: spec.platform,
        handle: spec.handle,
        url: spec.url,
        notes: spec.notes,
        status: "active",
      });
      if (ins) throw new Error(`insert ${spec.handle}: ${ins.message}`);
      console.log("inserted", spec.platform, spec.handle);
    }
  }
}

async function main() {
  await syncYeniHesaplar();
  await syncDiger();
  console.log("ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
