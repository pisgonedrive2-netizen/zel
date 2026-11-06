import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isMainAdminSession } from "@/lib/user-guards";
import { isSupabaseEnabled } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { employeesHaveAdvanceColumns, resetAdvanceColumnsProbe } from "@/lib/db/advance-columns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Avans kolon migration SQL’ini döner / durum kontrol eder.
 * DDL bu projede MCP ile uygulanamıyor; SQL Supabase SQL Editor’a yapıştırılmalı.
 */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yok" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || (!isMainAdminSession(session) && session.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "Yalnızca yönetici" }, { status: 403 });
  }

  resetAdvanceColumnsProbe();
  const columnsReady = await employeesHaveAdvanceColumns(true);

  const sql = `-- Avans geri ödeme planı kolonları
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS advance_monthly_cut numeric(14,2),
  ADD COLUMN IF NOT EXISTS advance_repay_start_month text;

COMMENT ON COLUMN public.employees.advance_monthly_cut IS
  'Aylık avans kesinti tutarı (USD). NULL/0 = otomatik kesinti yok';
COMMENT ON COLUMN public.employees.advance_repay_start_month IS
  'Avans kesintisinin başladığı ilk ay (YYYY-MM). Bu aydan önce kesinti üretilmez.';`;

  const { data: plans } = await getSupabaseAdmin()
    .from("employees")
    .select("id, name, notes, initial_advance")
    .eq("status", "active");

  const withPlan = (plans ?? []).filter((r) =>
    /\[adv-plan:cut=/i.test(String((r as { notes?: string }).notes ?? "")),
  );

  return NextResponse.json({
    ok: true,
    columnsReady,
    notesFallback: !columnsReady,
    plansInNotes: withPlan.map((r) => ({
      id: (r as { id: string }).id,
      name: (r as { name: string }).name,
    })),
    sql,
    hint: columnsReady
      ? "Kolonlar hazır — notes + kolon birlikte yazılır."
      : "Kolonlar yok. Aşağıdaki SQL’i Supabase → SQL Editor’da çalıştır; planlar notes ile zaten aktif.",
  });
}
