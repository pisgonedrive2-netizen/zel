import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { weeklyPlanFromRow } from "@/lib/db/mappers";
import type { WeeklyPlan } from "@/store/store";

export const dynamic = "force-dynamic";

/** Yayıncı haftalık planları — takvim sekmesi yenileme. */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  try {
    const { data, error } = await getSupabaseAdmin().from("weekly_plans").select("*");
    if (error) throw new Error(error.message);

    let plans = (data ?? []).map((r) =>
      weeklyPlanFromRow(r as Record<string, unknown>)
    );

    if (session.role === "streamer" && session.employeeId) {
      plans = plans.filter((p) => p.employeeId === session.employeeId);
    } else if (session.role === "brand") {
      plans = [];
    }

    return NextResponse.json(
      { weeklyPlans: plans },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Plan yükleme hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
