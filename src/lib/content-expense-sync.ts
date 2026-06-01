import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  contentExpenseToRow,
  salaryExtraToRow,
} from "@/lib/db/mappers";
import { dedupeSalaryExtrasByContentExpense } from "@/lib/salary-extra-dedupe";
import type { ContentExpense, SalaryExtra } from "@/store/store";

/**
 * Aynı `id`'ye sahip satırları tekilleştirir (son kazanır). Tek bir
 * `INSERT ... ON CONFLICT (id)` içinde aynı arbiter anahtarı iki kez geçerse
 * Postgres "ON CONFLICT DO UPDATE command cannot affect row a second time"
 * hatası verir; bu yüzden upsert öncesi mutlaka tekilleştiriyoruz.
 */
function dedupeById(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  for (const r of rows) map.set(String(r.id), r);
  return [...map.values()];
}

async function upsertRows(table: string, rows: Record<string, unknown>[]) {
  const deduped = dedupeById(rows);
  if (deduped.length === 0) return;
  const { error } = await getSupabaseAdmin().from(table).upsert(deduped, { onConflict: "id" });
  if (error) throw new Error(`${table} upsert: ${error.message}`);
}

async function loadIdSet(table: string): Promise<Set<string>> {
  const { data, error } = await getSupabaseAdmin().from(table).select("id");
  if (error) throw new Error(`${table} select: ${error.message}`);
  return new Set((data ?? []).map((r) => String((r as { id: string }).id)));
}

async function upsertSalaryExtras(
  rows: Record<string, unknown>[],
  knownContentIds: Set<string>
) {
  if (rows.length === 0) return;
  const db = getSupabaseAdmin();
  const dbContentIds = await loadIdSet("content_expenses");
  const validContent = new Set([...knownContentIds, ...dbContentIds]);

  const byContent = new Map<string, Record<string, unknown>>();
  const rest: Record<string, unknown>[] = [];
  for (const row of rows) {
    const cid = row.content_expense_id ? String(row.content_expense_id) : "";
    if (cid) {
      if (!validContent.has(cid)) {
        rest.push({ ...row, content_expense_id: null });
        continue;
      }
      byContent.set(cid, row);
    } else {
      rest.push(row);
    }
  }
  const deduped = dedupeById([...rest, ...byContent.values()]);

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

async function nullifyMissingFk<T extends Record<string, unknown>>(
  rows: T[],
  column: "salary_extra_id" | "kasa_tx_id",
  table: "salary_extras" | "kasa_transactions"
): Promise<T[]> {
  const ids = new Set<string>();
  for (const r of rows) {
    const v = r[column];
    if (v) ids.add(String(v));
  }
  if (ids.size === 0) return rows;
  const dbIds = await loadIdSet(table);
  return rows.map((r) => {
    const v = r[column];
    if (v && !dbIds.has(String(v))) return { ...r, [column]: null } as T;
    return r;
  });
}

/**
 * Döngüsel FK: önce içerik (salary_extra_id=null, kasa_tx_id valid), sonra
 * bordro kalemi, sonra bağlantıyı kur. `kasa_tx_id` mevcut kasa hareketine
 * referans veriyorsa korunur; yoksa `null`'a düşürülür ki FK ihlali olmasın.
 */
export async function syncContentExpensesAndSalaryExtras(
  contentExpenses: ContentExpense[],
  salaryExtras: SalaryExtra[]
): Promise<void> {
  const extras = dedupeSalaryExtrasByContentExpense(salaryExtras, contentExpenses);
  const contentRows = contentExpenses.map(contentExpenseToRow);
  const extraRows = extras.map(salaryExtraToRow);
  const contentIds = new Set(contentRows.map((r) => String(r.id)));

  if (contentRows.length > 0) {
    let phase1 = contentRows.map((r) => ({ ...r, salary_extra_id: null }));
    phase1 = await nullifyMissingFk(phase1, "kasa_tx_id", "kasa_transactions");
    await upsertRows("content_expenses", phase1);
  }

  await upsertSalaryExtras(extraRows, contentIds);

  if (contentRows.length > 0) {
    const validExtraIds = new Set(extraRows.map((r) => String(r.id)));
    const dbExtraIds = await loadIdSet("salary_extras");
    for (const id of dbExtraIds) validExtraIds.add(id);

    let phase3 = contentRows.map((r) => {
      const sid = r.salary_extra_id ? String(r.salary_extra_id) : "";
      if (sid && !validExtraIds.has(sid)) {
        return { ...r, salary_extra_id: null };
      }
      return r;
    });
    phase3 = await nullifyMissingFk(phase3, "kasa_tx_id", "kasa_transactions");
    await upsertRows("content_expenses", phase3);
  }
}

/** Tek işlem: bordro kalemi önce, sonra içerik harcaması bağlantısı. */
export async function persistSalaryExtraRow(extra: SalaryExtra): Promise<void> {
  const known = extra.contentExpenseId
    ? new Set([extra.contentExpenseId])
    : new Set<string>();
  await upsertSalaryExtras([salaryExtraToRow(extra)], known);
}

export async function persistContentExpenseRow(expense: ContentExpense): Promise<void> {
  let row = contentExpenseToRow(expense);
  if (expense.salaryExtraId) {
    const { data } = await getSupabaseAdmin()
      .from("salary_extras")
      .select("id")
      .eq("id", expense.salaryExtraId)
      .maybeSingle();
    if (!data) {
      const phase1 = { ...row, salary_extra_id: null };
      const phase1Safe = (await nullifyMissingFk(
        [phase1],
        "kasa_tx_id",
        "kasa_transactions"
      ))[0];
      await upsertRows("content_expenses", [phase1Safe]);
      throw new Error(
        "Bordro kalemi henüz kayıtlı değil — önce salary_extra kaydedilmeli."
      );
    }
  }
  if (expense.kasaTxId) {
    const { data } = await getSupabaseAdmin()
      .from("kasa_transactions")
      .select("id")
      .eq("id", expense.kasaTxId)
      .maybeSingle();
    if (!data) {
      row = { ...row, kasa_tx_id: null };
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
