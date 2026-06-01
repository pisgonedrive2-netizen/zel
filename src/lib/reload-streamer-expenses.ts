import { mergeCanonicalContentExpenses, useStore, type ContentExpense } from "@/store/store";

/** Sunucudaki içerik harcamalarını store'a yazar (yayıncı oturumu). */
export async function reloadStreamerExpensesFromServer(
  employeeId: string
): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const res = await fetch("/api/bootstrap/expenses", { credentials: "include" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `Yükleme başarısız (${res.status})`);
    }
    const data = (await res.json()) as { contentExpenses?: ContentExpense[] };
    const rows = data.contentExpenses ?? [];
    useStore.setState((s) => ({
      contentExpenses: mergeCanonicalContentExpenses([
        ...s.contentExpenses.filter((e) => e.employeeId !== employeeId),
        ...rows,
      ]),
    }));
    return { ok: true, count: rows.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Harcamalar yüklenemedi";
    return { ok: false, count: 0, error };
  }
}
