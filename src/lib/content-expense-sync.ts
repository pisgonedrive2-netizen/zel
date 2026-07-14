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
  column: "salary_extra_id" | "kasa_tx_id" | "brand_id" | "submitted_by" | "reviewed_by",
  table: "salary_extras" | "kasa_transactions" | "brands" | "app_users"
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

/** brand_ids dizisinden DB'de olmayan marka id'lerini temizler. */
async function sanitizeBrandIds<T extends Record<string, unknown>>(rows: T[]): Promise<T[]> {
  const all = new Set<string>();
  for (const r of rows) {
    const arr = r.brand_ids;
    if (Array.isArray(arr)) for (const id of arr) if (id) all.add(String(id));
  }
  if (all.size === 0) return rows;
  const dbIds = await loadIdSet("brands");
  return rows.map((r) => {
    const arr = r.brand_ids;
    if (!Array.isArray(arr) || arr.length === 0) return r;
    const next = arr.map(String).filter((id) => dbIds.has(id));
    return { ...r, brand_ids: next.length ? next : null } as T;
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
    phase1 = await nullifyMissingFk(phase1, "brand_id", "brands");
    phase1 = await nullifyMissingFk(phase1, "submitted_by", "app_users");
    phase1 = await nullifyMissingFk(phase1, "reviewed_by", "app_users");
    phase1 = await sanitizeBrandIds(phase1);
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
    phase3 = await nullifyMissingFk(phase3, "brand_id", "brands");
    phase3 = await nullifyMissingFk(phase3, "submitted_by", "app_users");
    phase3 = await nullifyMissingFk(phase3, "reviewed_by", "app_users");
    phase3 = await sanitizeBrandIds(phase3);
    await upsertRows("content_expenses", phase3);
  }
}

/**
 * Tek bordro kalemi kaydı. `content_expense_id`, ilgili içerik harcaması henüz
 * DB'de yoksa null'a düşürülür (döngüsel FK ihlali olmasın); bağlantı, içerik
 * harcaması kaydedilince `persistContentExpenseRow` tarafından geri kurulur.
 */
export async function persistSalaryExtraRow(extra: SalaryExtra): Promise<void> {
  await upsertSalaryExtras([salaryExtraToRow(extra)], new Set());
}

/**
 * Tek içerik harcaması kaydı. Çembersel FK'ye dayanıklıdır:
 *  1) Bağlı bordro kalemi (salary_extra) DB'de yoksa `salary_extra_id` null'a
 *     düşürülür (hata fırlatılmaz — kırmızı senkron hatası oluşmaz).
 *  2) Kalem varsa, içerik harcaması kaydedildikten sonra bordro kaleminin geri
 *     bağlantısı (`content_expense_id`) kurulur; böylece döngü kapanır.
 */
export async function persistContentExpenseRow(expense: ContentExpense): Promise<void> {
  const admin = getSupabaseAdmin();
  let row = contentExpenseToRow(expense);

  let salaryExtraExists = false;
  if (expense.salaryExtraId) {
    const { data } = await admin
      .from("salary_extras")
      .select("id")
      .eq("id", expense.salaryExtraId)
      .maybeSingle();
    salaryExtraExists = !!data;
    if (!salaryExtraExists) {
      // Bordro kalemi henüz yoksa bağlantıyı geçici olarak kopar (hard-fail yok).
      row = { ...row, salary_extra_id: null };
    }
  }

  row = (await nullifyMissingFk([row], "kasa_tx_id", "kasa_transactions"))[0];
  row = (await nullifyMissingFk([row], "brand_id", "brands"))[0];
  row = (await nullifyMissingFk([row], "submitted_by", "app_users"))[0];
  row = (await nullifyMissingFk([row], "reviewed_by", "app_users"))[0];
  row = (await sanitizeBrandIds([row]))[0];
  // NOT NULL alanlar
  if (row.notes == null) row = { ...row, notes: "" };
  if (row.brand_name == null) row = { ...row, brand_name: "" };
  if (row.review_thread == null) row = { ...row, review_thread: [] };
  await upsertRows("content_expenses", [row]);

  // İçerik harcaması artık DB'de; döngüyü kapat: bordro kaleminin geri
  // bağlantısını (content_expense_id) kur.
  if (expense.salaryExtraId && salaryExtraExists) {
    const { error } = await admin
      .from("salary_extras")
      .update({ content_expense_id: expense.id })
      .eq("id", expense.salaryExtraId);
    if (error) throw new Error(`salary_extras backlink: ${error.message}`);
  }
}

export async function persistContentExpenseSettlement(
  extra: SalaryExtra,
  expense: ContentExpense
): Promise<void> {
  await persistSalaryExtraRow(extra);
  await persistContentExpenseRow(expense);
}
