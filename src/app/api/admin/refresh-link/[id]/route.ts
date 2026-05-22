import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { refreshSingleLink } from "@/lib/social-api/refresh-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/refresh-link/[id]
 * Tek link için manuel refresh — yalnızca admin ve auditor rolü tetikleyebilir.
 * Bu istek RapidAPI kotasından 1 düşürür.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseEnabled() || !isRapidApiEnabled()) {
    return NextResponse.json({ ok: false, error: "RapidAPI veya Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  // Sadece admin ve auditor manuel tetikleyebilir; brand kullanıcısı sadece okur.
  if (session.role !== "admin" && session.role !== "auditor") {
    return NextResponse.json({ ok: false, error: "Yalnızca yönetici / denetçi" }, { status: 403 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "id gerekli" }, { status: 400 });

  const result = await refreshSingleLink(id, { userId: session.userId });
  return NextResponse.json({ ok: result.ok, result });
}
