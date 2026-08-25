import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import { dedupeBrandLinks } from "@/lib/social-api/dedupe-brand-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/admin/dedupe-brand-links
 * Body: { brandId?: string }
 *
 * Her markadaki aynı içerik URL’sinin çift kayıtlarını birleştirip fazlaları siler.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Yalnızca yönetici" }, { status: 403 });
  }

  let body: { brandId?: string } = {};
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
  } catch {
    body = {};
  }

  try {
    const summary = await dedupeBrandLinks({ brandId: body.brandId });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Dedupe hatası" },
      { status: 500 }
    );
  }
}
