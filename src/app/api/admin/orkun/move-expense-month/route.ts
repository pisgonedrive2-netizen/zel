import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled } from "@/lib/env";
import { isMainAdminSession } from "@/lib/user-guards";
import { planExpenseMonthMove } from "@/lib/orkun-month-move";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { expenseIds: string[], targetMonth: "YYYY-MM" }
 * İçerik harcamalarını (ve bağlı salary_extras) hedef aya taşır.
 * Yalnızca ana yönetici (Orkun).
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yok" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !isMainAdminSession(session)) {
    return NextResponse.json(
      { ok: false, error: "Yalnızca ana yönetici ay taşıyabilir" },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    expenseIds?: unknown;
    targetMonth?: unknown;
  };
  const targetMonth = String(body.targetMonth ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    return NextResponse.json(
      { ok: false, error: "Geçersiz hedef ay (YYYY-MM)" },
      { status: 400 }
    );
  }
  const expenseIds = Array.isArray(body.expenseIds)
    ? [
        ...new Set(
          body.expenseIds
            .map((x) => String(x ?? "").trim())
            .filter(Boolean)
        ),
      ]
    : [];
  if (expenseIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "expenseIds gerekli" },
      { status: 400 }
    );
  }

  const db = getSupabaseAdmin();

  try {
    const { data: rows, error: fetchErr } = await db
      .from("content_expenses")
      .select("id, date, month, salary_extra_id")
      .in("id", expenseIds);
    if (fetchErr) throw new Error(fetchErr.message);

    const found = rows ?? [];
    if (found.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Harcama bulunamadı" },
        { status: 404 }
      );
    }

    const moved: Array<{ id: string; date: string; month: string }> = [];
    const salaryExtraIds = new Set<string>();

    for (const row of found) {
      const id = String(row.id);
      const plan = planExpenseMonthMove(
        { date: String(row.date ?? "").slice(0, 10), month: String(row.month ?? "") },
        targetMonth
      );
      const { error: updErr } = await db
        .from("content_expenses")
        .update({ date: plan.date, month: plan.month })
        .eq("id", id);
      if (updErr) throw new Error(updErr.message);
      moved.push({ id, ...plan });

      if (row.salary_extra_id) {
        salaryExtraIds.add(String(row.salary_extra_id));
      }
    }

    // salary_extra_id üzerinden + content_expense_id ile bağlı kayıtlar
    if (salaryExtraIds.size > 0) {
      const { error: sxByIdErr } = await db
        .from("salary_extras")
        .update({ month: targetMonth })
        .in("id", [...salaryExtraIds]);
      if (sxByIdErr) throw new Error(sxByIdErr.message);
    }

    const movedIds = moved.map((m) => m.id);
    const { error: sxByCeErr } = await db
      .from("salary_extras")
      .update({ month: targetMonth })
      .in("content_expense_id", movedIds);
    if (sxByCeErr) throw new Error(sxByCeErr.message);

    return NextResponse.json({
      ok: true,
      targetMonth,
      movedCount: moved.length,
      moved,
      missingIds: expenseIds.filter((id) => !moved.some((m) => m.id === id)),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Taşıma hatası" },
      { status: 500 }
    );
  }
}
