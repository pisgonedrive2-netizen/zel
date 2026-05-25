import { isSupabaseClientMode } from "@/lib/supabase-client";
import { contentExpenseToRow, salaryExtraToRow } from "@/lib/db/mappers";
import { notifySyncError } from "@/lib/sync-notify";
import type { ContentExpense, SalaryExtra } from "@/store/store";

/** Maaşa masraf: önce bordro kalemi, sonra içerik harcaması (FK sırası). */
export async function persistContentExpenseSettlement(
  extra: SalaryExtra,
  expense: ContentExpense
): Promise<boolean> {
  if (!isSupabaseClientMode()) return true;
  try {
    const res1 = await fetch("/api/data/row", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "salary_extra", row: salaryExtraToRow(extra) }),
    });
    if (!res1.ok) {
      const j = (await res1.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error ?? `salary_extra (${res1.status})`);
    }

    const res2 = await fetch("/api/data/row", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "content_expense", row: contentExpenseToRow(expense) }),
    });
    if (!res2.ok) {
      const j = (await res2.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error ?? `content_expense (${res2.status})`);
    }
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kayıt hatası";
    notifySyncError(msg);
    return false;
  }
}
