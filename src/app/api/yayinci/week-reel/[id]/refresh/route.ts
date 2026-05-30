import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { refreshWeekReel } from "@/lib/social-api/week-reel-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/yayinci/week-reel/[id]/refresh
 * Haftalık reel/gönderi için izlenme (RapidAPI) çeker.
 * - admin / auditor: her kaydı yenileyebilir
 * - streamer: yalnızca kendi (employeeId) kaydını
 * 1 RapidAPI kotası harcar.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseEnabled() || !isRapidApiEnabled()) {
    return NextResponse.json(
      { ok: false, error: "RapidAPI veya Supabase yapılandırılmamış" },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });

  const isAdmin = session.role === "admin" || session.role === "auditor";
  if (!isAdmin && session.role !== "streamer") {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "id gerekli" }, { status: 400 });

  const result = await refreshWeekReel(id, {
    isAdmin,
    employeeId: session.employeeId,
  });
  return NextResponse.json({ ok: result.ok, result }, { status: result.ok ? 200 : 200 });
}
