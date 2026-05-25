import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { kasaToRow } from "@/lib/db/mappers";
import type { KasaTransaction } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canWriteKasa(role: string): boolean {
  return role === "admin";
}

/** POST — tek kasa hareketi upsert (anında kayıt). */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli — lütfen tekrar giriş yapın" }, { status: 401 });
  }
  if (!canWriteKasa(session.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekli" }, { status: 403 });
  }

  const body = (await req.json()) as KasaTransaction;
  if (!body?.id || !body.date || !body.direction) {
    return NextResponse.json({ error: "Eksik kasa hareketi alanları" }, { status: 400 });
  }

  const row = kasaToRow({
    ...body,
    kasaId: body.kasaId || "kasa-genel",
    feeUsd: body.feeUsd ?? 0,
    proof: body.proof ?? "",
    notes: body.notes ?? "",
  });

  const { error } = await getSupabaseAdmin()
    .from("kasa_transactions")
    .upsert(row, { onConflict: "id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: body.id });
}

/** DELETE — tek kasa hareketi sil. */
export async function DELETE(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli — lütfen tekrar giriş yapın" }, { status: 401 });
  }
  if (!canWriteKasa(session.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekli" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin().from("kasa_transactions").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
