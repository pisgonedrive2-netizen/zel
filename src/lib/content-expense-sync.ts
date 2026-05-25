import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  contentExpenseToRow,
  salaryExtraToRow,
} from "@/lib/db/mappers";
import { dedupeSalaryExtrasByContentExpense } from "@/lib/salary-extra-dedupe";
import type { ContentExpense, SalaryExtra } from "@/store/store";

async function upsertRows(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const { error } = await getSupabaseAdmin().from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table} upsert: ${error.message}`);
}

async function upsertSalaryExtras(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const db = getSupabaseAdmin();

  const byContent = new Map<string, Record<string, unknown>>();
  const rest: Record<string, unknown>[] = [];
  for (const row of rows) {
    const cid = row.content_expense_id ? String(row.content_expense_id) : "";
    if (cid) byContent.set(cid, row);
    else rest.push(row);
  }
  const deduped = [...rest, ...byContent.values()];

  for (const row of deduped) {
    const cid = row.content_expense_id ? String(row.content_expense_id) : "";
    const id = String(row.id);
    if (!cid) continue;
    const { error: delErr } = await db
      .from("salary_extras")
      .delete()
      .eq("content_expense_id", cid)
      .neq("id", id);
    if (delErr) throw new Error(`salary_extras cleanup: ${delErr.message}`);
  }

  const { error } = await db
    .from("salary_extras")
    .upsert(deduped, { onConflict: "id" });
  if (error) throw new Error(`salary_extras upsert: ${error.message}`);
}

/**
 * Döngüsel FK: önce içerik (salary_extra_id=null), sonra bordro kalemi, sonra bağlantı.
 */
export async function syncContentExpensesAndSalaryExtras(
  contentExpenses: ContentExpense[],
  salaryExtras: SalaryExtra[]
): Promise<void> {
  const extras = dedupeSalaryExtrasByContentExpense(salaryExtras, contentExpenses);
  const contentRows = contentExpenses.map(contentExpenseToRow);
  const extraRows = extras.map(salaryExtraToRow);

  if (contentRows.length > 0) {
    const phase1 = contentRows.map((r) => ({ ...r, salary_extra_id: null }));
    await upsertRows("content_expenses", phase1);
  }

  await upsertSalaryExtras(extraRows);

  if (contentRows.length > 0) {
    await upsertRows("content_expenses", contentRows);
  }
}

/** Tek işlem: bordro kalemi önce, sonra içerik harcaması bağlantısı. */
export async function persistSalaryExtraRow(extra: SalaryExtra): Promise<void> {
  await upsertSalaryExtras([salaryExtraToRow(extra)]);
}

export async function persistContentExpenseRow(expense: ContentExpense): Promise<void> {
  const row = contentExpenseToRow(expense);
  if (expense.salaryExtraId) {
    const { data } = await getSupabaseAdmin()
      .from("salary_extras")
      .select("id")
      .eq("id", expense.salaryExtraId)
      .maybeSingle();
    if (!data) {
      const phase1 = { ...row, salary_extra_id: null };
      await upsertRows("content_expenses", [phase1]);
      throw new Error(
        "Bordro kalemi henüz kayıtlı değil — önce salary_extra kaydedilmeli."
      );
    }
  }
  await upsertRows("content_expenses", [row]);
}

export async function persistContentExpenseSettlement(
  extra: SalaryExtra,
  expense: ContentExpense
): Promise<void> {
  await persistSalaryExtraRow(extra);
  await persistContentExpenseRow(expense);
}
