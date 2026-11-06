/**
 * Orkun arşiv / çöp kutusu yardımcılar.
 *
 * Soft-delete convention: notes içine `[orkun_trash]` gömülür (kolon migration’sız).
 * Şimdilik içerik harcamaları (content_expense); aynı etiket kalıbı ileride
 * kasa hareketleri / kullanıcılar için de kullanılabilir.
 */
import type { ContentExpense } from "@/store/store";
import {
  isStreamerClearedExpense,
  isWithdrawnContentExpense,
} from "@/lib/content-expense";

export const ORKUN_TRASH_TAG = "[orkun_trash]";

const ORKUN_TRASH_RE = /\[orkun_trash\]/gi;
const STREAMER_CLEARED_RE = /\s*\[streamer_cleared\]/gi;

export function isOrkunTrashed(notes: string | undefined | null): boolean {
  return /\[orkun_trash\]/i.test(String(notes ?? ""));
}

export function markOrkunTrashed(notes: string | undefined | null): string {
  const base = String(notes ?? "").trim();
  if (isOrkunTrashed(base)) return base;
  return base ? `${base} ${ORKUN_TRASH_TAG}` : ORKUN_TRASH_TAG;
}

export function stripOrkunTrash(notes: string | undefined | null): string {
  return String(notes ?? "")
    .replace(ORKUN_TRASH_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Geri çekilen (cancelled) içerik harcamaları — Orkun arşiv görünümü. */
export function filterOrkunArchiveExpenses<T extends ContentExpense>(
  expenses: T[],
): T[] {
  return expenses.filter(isWithdrawnContentExpense);
}

/**
 * Çöp: açık `[orkun_trash]` etiketi VEYA yayıncının soft-clear ettiği
 * geri çekilen kayıtlar (`[streamer_cleared]`).
 */
export function filterOrkunTrashExpenses<T extends ContentExpense>(
  expenses: T[],
): T[] {
  return expenses.filter(
    (e) =>
      isOrkunTrashed(e.notes) ||
      (isWithdrawnContentExpense(e) && isStreamerClearedExpense(e)),
  );
}

export type OrkunTrashKind = "orkun_trash" | "streamer_discarded";

export function orkunTrashKind(e: ContentExpense): OrkunTrashKind {
  if (isOrkunTrashed(e.notes)) return "orkun_trash";
  return "streamer_discarded";
}

/** Yeniden açma / restore için notes temizliği (streamer_cleared + orkun_trash). */
export function stripArchiveTagsFromNotes(
  notes: string | undefined | null,
): string {
  return stripOrkunTrash(String(notes ?? "").replace(STREAMER_CLEARED_RE, ""));
}

/** Açıklama hücresi için kısa özet. */
export function expenseDescriptionSnippet(
  description: string | undefined | null,
  max = 48,
): string {
  const t = String(description ?? "").trim();
  if (!t) return "—";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export const ORKUN_TRASH_RETENTION_DAYS = 30;

/**
 * Çöp yaşı (gün). Öncelik: reviewedAt → date (YYYY-MM-DD) → month (YYYY-MM-01).
 * Geçersiz tarih / gelecek tarih → 0.
 */
export function orkunTrashAgeDays(
  expense: Pick<ContentExpense, "reviewedAt" | "date" | "month">,
  now: Date = new Date(),
): number {
  const candidates = [
    expense.reviewedAt,
    expense.date,
    expense.month ? `${expense.month}-01` : undefined,
  ];
  let ms: number | null = null;
  for (const c of candidates) {
    const s = String(c ?? "").trim();
    if (!s) continue;
    const parsed = Date.parse(s);
    if (!Number.isFinite(parsed)) continue;
    ms = parsed;
    break;
  }
  if (ms === null) return 0;
  const diffMs = now.getTime() - ms;
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export function isOrkunTrashExpired(
  expense: Pick<ContentExpense, "reviewedAt" | "date" | "month">,
  days: number = ORKUN_TRASH_RETENTION_DAYS,
  now: Date = new Date(),
): boolean {
  return orkunTrashAgeDays(expense, now) >= days;
}

/** UI: "12g" */
export function orkunTrashAgeLabel(
  expense: Pick<ContentExpense, "reviewedAt" | "date" | "month">,
  now: Date = new Date(),
): string {
  return `${orkunTrashAgeDays(expense, now)}g`;
}
