import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { loadAchievementDayItems } from "@/lib/achievement-day";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/streamer/achievement-day?employeeId=&date=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date")?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date (YYYY-MM-DD) gerekli" }, { status: 400 });
  }

  const queryEid = req.nextUrl.searchParams.get("employeeId")?.trim();
  let employeeId = session.employeeId ?? "";
  if (session.role === "admin" || session.role === "auditor") {
    employeeId = queryEid || employeeId;
  } else if (session.role === "streamer") {
    employeeId = session.employeeId ?? "";
  } else {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId gerekli" }, { status: 400 });
  }

  const items = await loadAchievementDayItems({ employeeId, date });
  return NextResponse.json({ ok: true, date, items });
}
