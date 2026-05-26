import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { contentExpenseFromRow } from "@/lib/db/mappers";
import type { ContentExpense } from "@/store/store";

export const dynamic = "force-dynamic";

/** Yayıncı içerik harcamaları — harcamalar sekmesi yenileme. */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (session.role !== "streamer" || !session.employeeId) {
    return NextResponse.json({ error: "Yalnızca yayıncı" }, { status: 403 });
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("content_expenses")
      .select("*")
      .eq("employee_id", session.employeeId)
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);

    const contentExpenses = (data ?? []).map((r) =>
      contentExpenseFromRow(r as Record<string, unknown>)
    ) as ContentExpense[];

    return NextResponse.json(
      { contentExpenses },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Harcama yükleme hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
