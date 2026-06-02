import { NextRequest, NextResponse } from "next/server";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { weekBrandReelFromRow } from "@/lib/db/mappers";
import { syncEmployeePersonalAccounts } from "@/lib/social-api/streamer-achievement-sync";
import type { WeekBrandReel } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/streamer/sync-achievement-from-accounts?employeeId=
 * Yayıncının kişisel YouTube / Instagram / TikTok hesaplarından son içerikleri çeker.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });

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

  if (!isRapidApiEnabled()) {
    return NextResponse.json({
      ok: true,
      reels: await loadPersonalReels(employeeId),
      summary: { attempted: 0, synced: 0, skipped: 0, failed: 0, errors: [] },
      warning: "RAPIDAPI_KEY yok — kişisel hesap taraması yapılamadı.",
    });
  }

  const summary = await syncEmployeePersonalAccounts(employeeId);
  const reels = await loadPersonalReels(employeeId);

  return NextResponse.json({ ok: true, reels, summary });
}

async function loadPersonalReels(employeeId: string): Promise<WeekBrandReel[]> {
  const { data } = await getSupabaseAdmin()
    .from("week_brand_reels")
    .select("*")
    .eq("employee_id", employeeId)
    .is("brand_link_id", null)
    .not("streamer_account_id", "is", null);
  return (data ?? []).map((r) => weekBrandReelFromRow(r as Record<string, unknown>));
}
