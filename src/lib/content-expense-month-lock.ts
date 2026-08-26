import { isSupabaseClientMode } from "@/lib/supabase-client";

const SETTINGS_KEY = "contentExpense.lockedMonths";

export function normalizeLockedMonths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .map((x) => String(x ?? "").trim())
        .filter((ym) => /^\d{4}-\d{2}$/.test(ym))
    ),
  ].sort((a, b) => b.localeCompare(a));
}

export function isContentExpenseMonthLocked(
  monthYm: string,
  lockedMonths: string[]
): boolean {
  if (!/^\d{4}-\d{2}$/.test(monthYm)) return false;
  return lockedMonths.includes(monthYm);
}

export async function fetchLockedContentExpenseMonths(): Promise<string[]> {
  if (!isSupabaseClientMode()) return [];
  try {
    const res = await fetch("/api/admin/content-expense-month-lock", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { lockedMonths?: string[] };
    return normalizeLockedMonths(json.lockedMonths);
  } catch {
    return [];
  }
}

export async function setContentExpenseMonthLocked(
  monthYm: string,
  locked: boolean
): Promise<{ ok: boolean; lockedMonths: string[]; error?: string }> {
  try {
    const res = await fetch("/api/admin/content-expense-month-lock", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthYm, locked }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      lockedMonths?: string[];
      error?: string;
    };
    if (!res.ok || !json.ok) {
      return {
        ok: false,
        lockedMonths: [],
        error: json.error ?? `HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      lockedMonths: normalizeLockedMonths(json.lockedMonths),
    };
  } catch (e) {
    return {
      ok: false,
      lockedMonths: [],
      error: e instanceof Error ? e.message : "Ağ hatası",
    };
  }
}

export { SETTINGS_KEY as CONTENT_EXPENSE_LOCKED_MONTHS_KEY };
