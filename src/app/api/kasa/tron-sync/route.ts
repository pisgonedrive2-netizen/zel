import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { kasaAccountFromRow } from "@/lib/db/mappers";
import { syncTronTransfersForKasa } from "@/lib/tron-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { kasaId } — TRON TRC20 USDT hareketlerini kasaya aktar. */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { kasaId?: string };
  const kasaId = body.kasaId?.trim();
  if (!kasaId) {
    return NextResponse.json({ ok: false, error: "kasaId gerekli" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("kasas")
    .select("*")
    .eq("id", kasaId)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Kasa bulunamadı" }, { status: 404 });
  }

  const kasa = kasaAccountFromRow(data as Record<string, unknown>);
  try {
    const summary = await syncTronTransfersForKasa(kasa);
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "TRON senkron hatası",
    }, { status: 500 });
  }
}
