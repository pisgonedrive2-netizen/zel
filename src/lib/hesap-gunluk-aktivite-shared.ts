/** Client-safe: tipler ve İstanbul gün yardımcıları (sunucu bağımlılığı yok). */

export type HesapAktiviteKind = "video" | "story" | "none" | "error";
export type HesapTag = "naz" | "ponpon";

/** Tek taramadan gelen paylaşım önizlemesi (thumb + link). */
export interface HesapGunlukItem {
  url: string;
  contentType: string;
  title?: string;
  thumbnailUrl?: string;
  views?: number | null;
  publishedAt?: string | null;
}

export interface HesapGunlukRow {
  platform: string;
  handle: string;
  url: string;
  tag?: HesapTag;
  kind: HesapAktiviteKind;
  count: number;
  storyCount: number;
  videoCount: number;
  latestAt: string | null;
  sampleUrl: string | null;
  sampleThumb?: string | null;
  items?: HesapGunlukItem[];
  error?: string;
}

export interface HesapGunlukReport {
  date: string;
  checkedAt: string;
  rows: HesapGunlukRow[];
  posted: number;
  missing: number;
  errors: number;
  triggeredBy: "cron" | "manual";
  final: boolean;
  notified?: boolean;
}

export interface HesapGunlukStore {
  byDate: Record<string, HesapGunlukReport>;
  latestDate: string | null;
  /** Son otomatik/manuel geçmiş doldurma — API kotasını korumak için. */
  lastBackfillAt?: string | null;
}

/** Son N günde kaç günün kaydı eksik / items’siz? */
export function hesapGunlukMissingDays(
  store: HesapGunlukStore | null | undefined,
  endDay: string,
  windowDays = 14
): number {
  if (!store?.byDate) return windowDays;
  const days = istanbulDayRangeEnding(endDay, windowDays);
  let missing = 0;
  for (const d of days) {
    const report = store.byDate[d];
    if (!report) {
      missing += 1;
      continue;
    }
    const needsItems = report.posted > 0 && !report.rows.some((r) => (r.items?.length ?? 0) > 0);
    if (needsItems) missing += 1;
  }
  return missing;
}

/** Sayfa açılışında otomatik doldurulsun mu? (kota korumalı) */
export function shouldAutoBackfillHesapGunluk(
  store: HesapGunlukStore | null | undefined,
  now = new Date()
): boolean {
  const today = hesapGunlukIstanbulDate(now);
  const missing = hesapGunlukMissingDays(store, today, 14);
  if (missing === 0) return false;
  if (!store?.lastBackfillAt) return missing >= 1;
  const ageMs = now.getTime() - new Date(store.lastBackfillAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return missing >= 3;
  // 6 saatten sık otomatik tarama yapma
  if (ageMs < 6 * 60 * 60 * 1000) return false;
  return missing >= 2;
}

export function hesapGunlukIstanbulDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(d);
}

export function shiftIstanbulDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function istanbulDayToClose(d = new Date()): string {
  return shiftIstanbulDay(hesapGunlukIstanbulDate(d), -1);
}

/** Bitiş gününden geriye `count` gün (bitiş dahil), eskiden yeniye. */
export function istanbulDayRangeEnding(endDay: string, count: number): string[] {
  const n = Math.max(1, Math.min(count, 92));
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(shiftIstanbulDay(endDay, -i));
  }
  return out;
}
