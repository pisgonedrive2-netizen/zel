import { isSupabaseClientMode } from "@/lib/supabase-client";
import { contentExpenseToRow, salaryExtraToRow } from "@/lib/db/mappers";
import { persistKasaTransaction, removeKasaTransaction } from "@/lib/kasa-persist";
import { notifySyncError } from "@/lib/sync-notify";
import type { ContentExpense, KasaTransaction, SalaryExtra } from "@/store/store";

async function postRow(entity: string, row: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/data/row", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity, row }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `${entity} (${res.status})`);
  }
}

async function deleteRow(entity: string, id: string): Promise<void> {
  const res = await fetch(
    `/api/data/row?entity=${encodeURIComponent(entity)}&id=${encodeURIComponent(id)}`,
    { method: "DELETE", credentials: "include" }
  );
  if (!res.ok && res.status !== 404) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `${entity} silinemedi (${res.status})`);
  }
}

/** Maaşa masraf: önce bordro kalemi, sonra içerik harcaması (FK sırası). */
export async function persistContentExpenseSettlement(
  extra: SalaryExtra,
  expense: ContentExpense
): Promise<boolean> {
  if (!isSupabaseClientMode()) return true;
  try {
    await postRow("salary_extra", salaryExtraToRow(extra));
    await postRow("content_expense", contentExpenseToRow(expense));
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kayıt hatası";
    notifySyncError(msg);
    return false;
  }
}

/** Bordrodan çıkar: salary_extra sil + harcama güncelle. */
export async function persistContentExpenseUnsettlePayroll(
  expense: ContentExpense,
  salaryExtraIds: string | string[]
): Promise<boolean> {
  if (!isSupabaseClientMode()) return true;
  try {
    const ids = Array.isArray(salaryExtraIds) ? salaryExtraIds : [salaryExtraIds];
    for (const id of ids) {
      if (id) await deleteRow("salary_extra", id);
    }
    await postRow("content_expense", contentExpenseToRow(expense));
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bordro bağlantısı kaldırılamadı";
    notifySyncError(msg);
    return false;
  }
}

/**
 * Kasadan öde (veya maaştan kasaya taşı):
 * bordro kalemini sil, kasa hareketini yaz, harcamayı güncelle.
 */
export async function persistContentExpenseKasaPay(opts: {
  expense: ContentExpense;
  kasaTx: KasaTransaction;
  removeSalaryExtraIds: string[];
}): Promise<boolean> {
  if (!isSupabaseClientMode()) return true;
  try {
    for (const id of opts.removeSalaryExtraIds) {
      await deleteRow("salary_extra", id);
    }
    const kasa = await persistKasaTransaction(opts.kasaTx);
    if (!kasa.ok) throw new Error(kasa.error ?? "Kasa hareketi yazılamadı");
    await postRow("content_expense", contentExpenseToRow(opts.expense));
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kasa ödemesi kaydedilemedi";
    notifySyncError(msg);
    return false;
  }
}

/** Kasadan ödemeyi geri al. */
export async function persistContentExpenseUnpay(opts: {
  expense: ContentExpense;
  removeKasaTxIds: string[];
}): Promise<boolean> {
  if (!isSupabaseClientMode()) return true;
  try {
    for (const id of opts.removeKasaTxIds) {
      const r = await removeKasaTransaction(id);
      if (!r.ok && r.error) throw new Error(r.error);
    }
    await postRow("content_expense", contentExpenseToRow(opts.expense));
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ödeme geri alınamadı";
    notifySyncError(msg);
    return false;
  }
}
