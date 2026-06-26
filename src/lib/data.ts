// ─────────────────────────────────────────────────────────────────────────────
// Foxstream — Statik özet veriler & yardımcı sabitler
// (CRUD verisi `src/store/store.ts` içindedir; bu dosya türev/UI sabitleri tutar.)
// ─────────────────────────────────────────────────────────────────────────────

export const MONTHS = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
] as const;

/**
 * 2026 takvim yılı maaş bordrosu (net ödeme), USD.
 * Kaynak: 1) Ramiz Nis-Ara 2026 ($10k base + $1.400 kira − $3k avans Nis/May/Tem, sonra avans yok)
 *         2) Lucy   Nis-Haz 2026 ($3k base + $500 kira · 18 Haz 2026 iş çıkışı, Tem+ yok)
 *         3) Acelya May 2026 ilk bordro ($3.5k + $1.55k kira − $300 avans → $4.75k);
 *            Haz–Tem $300/ay avans kesintisi; sonra $3.5k + $650/ay kira
 *         4) Orkun  bordroda yok (koordinatör)
 *
 *   Oca Şub Mar  Nis     May      Haz     Tem     Ağu-Ara
 *    0   0   0  11.950  21.526  17.550  12.250  15.250 × 5
 */
export const maasAylik: readonly number[] = [
  0, 0, 0,
  11_950, 21_526,
  17_550, 12_250,
  15_250, 15_250, 15_250, 15_250, 15_250,
];

/**
 * 2025+2026 toplamı (CSV "AY BAZLI GELİR ÖZETİ" satırı).
 * Sum = 377.199.
 */
export const disGelirAylik: readonly number[] = [
  26_500, 34_000, 76_000,
  15_500, 16_000, 11_000,
  37_500, 33_700, 30_499,
  38_000, 23_000, 35_500,
];

export const icGelirAylik:  readonly number[] = [60_000, 65_000, 70_000, 68_000, 72_000, 75_000, 63_000, 67_000, 70_000, 75_000, 80_000, 40_000];
export const giderlerAylik: readonly number[] = [ 1_200,  1_100,  1_500,  1_300,  1_400,  1_200,  1_100,  1_300,  1_500,  1_400,  1_200,  1_600];

const sumN = (a: readonly number[]) => a.reduce((s, v) => s + v, 0);

export const YILLIK = {
  maas:     sumN(maasAylik),     // ~154.776 (Lucy Haz 2026 çıkışı sonrası)
  disGelir: sumN(disGelirAylik), // 377.199
  icGelir:  sumN(icGelirAylik),  // 805.000
  giderler: sumN(giderlerAylik), // 15.800
  get net() {
    return this.disGelir + this.icGelir - this.giderler - this.maas;
  },
};

export const netAylik = MONTHS.map((_, i) =>
  disGelirAylik[i] + icGelirAylik[i] - giderlerAylik[i] - maasAylik[i]
);

export const monthlyChartData = MONTHS.map((ay, i) => ({
  ay,
  disGelir:    disGelirAylik[i],
  icGelir:     icGelirAylik[i],
  toplamGelir: disGelirAylik[i] + icGelirAylik[i],
  toplamGider: giderlerAylik[i] + maasAylik[i],
  net:         netAylik[i],
  gider:       giderlerAylik[i],
  maas:        maasAylik[i],
}));

// ── Yardımcılar ───────────────────────────────────────────────────────────────
export const fmt = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000)     return "$" + (n / 1_000).toFixed(1) + "k";
  return fmt(n);
};

export const CHART_COLORS = {
  icGelir:  "#3b82f6",
  disGelir: "#8b5cf6",
  net:      "#22c55e",
  gider:    "#ef4444",
  maas:     "#f59e0b",
  gelir:    "#06b6d4",
};

export const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

/** Yerel YYYY-MM — `Date#toISOString()` UTC kayması ay ileri/geri düğmelerini bozabilir. */
export function toYearMonthLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Yerel takvim günü YYYY-MM-DD (`toISOString` UTC kayması hatırlatma refId'lerini bozmasın). */
export function toDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Hafta görünümü anchor — her zaman Pazartesi.
 * Eski UTC hatasıyla Pazar (dow=0) kaydedilmiş week_start → ertesi gün Pazartesi.
 */
export function normalizeWeekAnchorIso(anchorIso: string): string {
  const base = pgDateOnly(anchorIso);
  if (!base) return anchorIso;
  const [y, mo, day] = base.split("-").map(Number);
  const d = new Date(y, mo - 1, day, 12, 0, 0);
  if (d.getDay() === 0) {
    d.setDate(d.getDate() + 1);
    return toDateLocal(d);
  }
  return weekStartFromDateIso(base) || base;
}

/** Haftanın 7 günü (Pzt–Paz), yerel takvim — girdi her zaman o haftanın Pazartesi’sine çekilir. */
export function weekDayIsosFromStart(weekStartIso: string): string[] {
  const base = normalizeWeekAnchorIso(weekStartIso);
  if (!base) return [];
  const [y, mo, day] = base.split("-").map(Number);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(y, mo - 1, day + i, 12, 0, 0);
    days.push(toDateLocal(d));
  }
  return days;
}

/** Hafta başlangıcını N hafta kaydır (yerel takvim). */
export function shiftWeekStartIso(weekStartIso: string, deltaWeeks: number): string {
  const base = normalizeWeekAnchorIso(weekStartIso);
  if (!base) return weekStartIso;
  const [y, mo, day] = base.split("-").map(Number);
  const d = new Date(y, mo - 1, day + deltaWeeks * 7, 12, 0, 0);
  return toDateLocal(d);
}

/** Bugünün yerel ISO tarihi. */
export function todayDateLocal(): string {
  return toDateLocal(new Date());
}

/** Verilen günün hafta başlangıcı (Pazartesi), yerel. */
export function weekStartFromDateIso(isoDate: string): string {
  const base = pgDateOnly(isoDate);
  if (!base) return "";
  const [y, mo, day] = base.split("-").map(Number);
  const d = new Date(y, mo - 1, day, 12, 0, 0);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return toDateLocal(d);
}

/** ISO tarih → "27 Mayıs Çarşamba" (yerel, UTC kayması yok). */
export function formatDateLongTr(iso: string): string {
  const base = pgDateOnly(iso);
  if (!base) return iso;
  const [y, mo, day] = base.split("-").map(Number);
  const d = new Date(y, mo - 1, day, 12, 0, 0);
  return d.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Plan bu hafta aralığında mı (week_start alanı hatalı olsa bile date ile). */
export function planDateInWeek(planDateIso: string, weekAnchorIso: string): boolean {
  const days = weekDayIsosFromStart(weekAnchorIso);
  const d = pgDateOnly(planDateIso);
  return d != null && days.includes(d);
}

function pgDateOnly(value: string): string | null {
  const v = value.trim();
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** ISO tarih/saat → yerel YYYY-MM-DD (UTC `slice(0,10)` kaymasını önler). */
export function isoToLocalDateOnly(iso: string | undefined | null): string {
  if (!iso) return "";
  const bare = pgDateOnly(String(iso));
  if (!bare) return "";
  if (String(iso).trim().length <= 10) return bare;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return bare;
  return toDateLocal(d);
}

/** Yerel öğlen (12:00) — `published_at` için timezone kayması olmadan gün sabitlenir. */
export function localNoonTimestampIso(dateIso: string): string {
  const bare = pgDateOnly(dateIso);
  if (!bare) return new Date().toISOString();
  const [y, mo, day] = bare.split("-").map(Number);
  return new Date(y, mo - 1, day, 12, 0, 0).toISOString();
}

export function shiftCalendarMonthYm(ym: string, deltaMonths: number): string {
  const [y, mo] = ym.split("-").map(Number);
  const d = new Date(y, mo - 1 + deltaMonths, 1);
  return toYearMonthLocal(d);
}

/** Snapshot / liste için o aya uygun varsayılan ISO tarih (bu ay → bugün, geçmiş ay → ay sonu). */
export function defaultSnapshotDateInMonth(ym: string): string {
  const [y, mo] = ym.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(y, mo, 0).getDate();
  const lastStr = `${y}-${pad(mo)}-${pad(lastDay)}`;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayYm = toYearMonthLocal(today);
  if (ym > todayYm) return `${y}-${pad(mo)}-01`;
  if (ym === todayYm) return todayStr <= lastStr ? todayStr : lastStr;
  return lastStr;
}

