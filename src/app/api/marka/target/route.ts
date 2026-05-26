import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — Markanın kendi aylık izlenme hedefini günceller.
 * Yalnızca admin veya hedef markaya bağlı `brand` rolü.
 */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { brandId?: string; monthlyTarget?: number | null }
    | null;
  const brandId = String(body?.brandId ?? "").trim();
  if (!brandId) {
    return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  }

  if (session.role === "brand") {
    if (!session.brandId || session.brandId !== brandId) {
      return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
    }
  } else if (session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const raw = body?.monthlyTarget;
  const target = raw == null ? null : Math.max(0, Math.round(Number(raw)));
  if (target != null && (!Number.isFinite(target) || Number.isNaN(target))) {
    return NextResponse.json({ error: "Geçersiz hedef" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from("brands")
    .update({ monthly_target: target })
    .eq("id", brandId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, brandId, monthlyTarget: target });
}
