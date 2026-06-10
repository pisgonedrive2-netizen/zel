import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { kasaAccountFromRow, kasaAccountToRow } from "@/lib/db/mappers";
import type { Kasa } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — kasa hesabını Supabase'e yazar (admin/denetçi). */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<Kasa> & { id?: string };
  const id = body.id?.trim();
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const row = kasaAccountToRow({
    id,
    name: body.name ?? "",
    kind: body.kind ?? "general",
    currency: body.currency ?? "USD",
    isDefault: body.isDefault ?? false,
    archived: body.archived ?? false,
    orderIndex: body.orderIndex ?? 0,
    notes: body.notes ?? "",
    tronAddress: body.tronAddress,
    tronSyncFrom: body.tronSyncFrom,
  } as Kasa);

  const { error } = await getSupabaseAdmin()
    .from("kasas")
    .upsert(row, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = await getSupabaseAdmin()
    .from("kasas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    kasa: data ? kasaAccountFromRow(data as Record<string, unknown>) : null,
  });
}

const PROTECTED_KASA_IDS = new Set(["kasa-genel"]);

/** DELETE ?id=…&force=1 — kasayı arşivler veya kalıcı siler (yalnızca admin). */
export async function DELETE(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yalnızca yönetici silebilir" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id")?.trim();
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  if (PROTECTED_KASA_IDS.has(id)) {
    return NextResponse.json(
      { error: "Genel Kasa silinemez — yalnızca düzenlenebilir." },
      { status: 400 },
    );
  }

  const db = getSupabaseAdmin();
  const { count, error: countErr } = await db
    .from("kasa_transactions")
    .select("id", { count: "exact", head: true })
    .eq("kasa_id", id);
  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  const txCount = count ?? 0;
  if (txCount > 0 && !force) {
    const { error } = await db.from("kasas").update({ archived: true }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, archived: true, txCount });
  }

  if (txCount > 0 && force) {
    const { error: txErr } = await db.from("kasa_transactions").delete().eq("kasa_id", id);
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });
  }

  const { error: delErr } = await db.from("kasas").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: true, txCount });
}
