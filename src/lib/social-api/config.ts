/**
 * RapidAPI Basic plan limitleri ve otomatik yenileme bütçesi.
 *
 * KAYNAK (yükseltilmiş planlar — Mayıs 2026):
 *   • YouTube   (youtube138)                            : 5000 req/ay (varsayılan)
 *   • Instagram (instagram-api-fast-reliable-data-scraper): 5000 req/ay
 *   • TikTok    (tiktok-scraper7)                       : 5000 req/ay
 *
 * Ortam değişkeni ile override: RAPIDAPI_YOUTUBE_MONTHLY_LIMIT vb.
 *
 * Budget stratejisi:
 *   - Aylık kotanın %85'ini güvenli sınır olarak kullan (manuel refresh +
 *     hata payı için %15 rezerv).
 *   - Cron günde 1 kez çalışır (Vercel Hobby uyumlu); ay başına ~30 çalıştırma.
 *   - Her çalıştırma, kalan kotayı kalan güne böler ve adaptif batch boyutu
 *     hesaplar. Hiçbir koşulda kota aşılmaz.
 */

export type SocialPlatform = "youtube" | "tiktok" | "instagram";

export interface PlanConfig {
  /** RapidAPI hostname (x-rapidapi-host) */
  apiHost: string;
  /** İnsan dostu etiket */
  label: string;
  /** Aylık hard limit */
  monthlyLimit: number;
  /** İkincil rate limit (saniye/dakika başına) — bilgi amaçlı */
  rateLimit: string;
  /** UI'da gösterilen güvenli kotanın yüzdesi (0–1) */
  safeFraction: number;
  /** Cron çalıştırma başına izin verilen MAX batch (üst sınır) */
  maxBatchPerRun: number;
}

function envMonthlyLimit(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const SOCIAL_PLANS: Record<SocialPlatform, PlanConfig> = {
  youtube: {
    apiHost: "youtube138.p.rapidapi.com",
    label: "YouTube",
    monthlyLimit: envMonthlyLimit("RAPIDAPI_YOUTUBE_MONTHLY_LIMIT", 5000),
    rateLimit: "5 req/sn",
    safeFraction: 0.85,
    maxBatchPerRun: 40,
  },
  instagram: {
    apiHost: "instagram-api-fast-reliable-data-scraper.p.rapidapi.com",
    label: "Instagram",
    monthlyLimit: envMonthlyLimit("RAPIDAPI_INSTAGRAM_MONTHLY_LIMIT", 5000),
    rateLimit: "1000 req/saat",
    safeFraction: 0.85,
    maxBatchPerRun: 40,
  },
  tiktok: {
    apiHost: "tiktok-scraper7.p.rapidapi.com",
    label: "TikTok",
    monthlyLimit: envMonthlyLimit("RAPIDAPI_TIKTOK_MONTHLY_LIMIT", 5000),
    rateLimit: "120 req/dk",
    safeFraction: 0.85,
    maxBatchPerRun: 24,
  },
};

/** Cron varsayılan sıklığı (saat) — vercel.json içindeki cron ile tutarlı. */
export const CRON_INTERVAL_HOURS = 24;

export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Kalan kota ve kalan ay sürelerine göre cron çalıştırması için adaptif
 * batch boyutu hesabı.
 *
 * Mantık:
 *   safeRemaining = floor(monthlyLimit * safeFraction) - usedThisMonth
 *   runsLeft      = max(1, kalan gün × (24/CRON_INTERVAL_HOURS))
 *   batch         = clamp(0..maxBatchPerRun, floor(safeRemaining / runsLeft))
 *
 * Eğer kullanım zaten güvenli sınıra ulaşmışsa 0 döner — sonraki ay başına
 * kadar otomatik refresh durur (manuel refresh hâlâ izinli, kota dahilinde).
 */
export function calcBatchSize(opts: {
  platform: SocialPlatform;
  usedThisMonth: number;
  now?: Date;
  cronIntervalHours?: number;
}): {
  batchSize: number;
  safeRemaining: number;
  runsLeft: number;
  monthlyBudget: number;
} {
  const plan = SOCIAL_PLANS[opts.platform];
  const now = opts.now ?? new Date();
  const interval = opts.cronIntervalHours ?? CRON_INTERVAL_HOURS;
  const monthlyBudget = Math.floor(plan.monthlyLimit * plan.safeFraction);
  const safeRemaining = Math.max(0, monthlyBudget - opts.usedThisMonth);

  if (safeRemaining === 0) {
    return { batchSize: 0, safeRemaining: 0, runsLeft: 0, monthlyBudget };
  }
  // Kalan saat (UTC)
  const endOfMonthUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const hoursLeft = Math.max(1, (endOfMonthUtc - now.getTime()) / 3_600_000);
  const runsLeft = Math.max(1, Math.floor(hoursLeft / interval));
  const fair = Math.floor(safeRemaining / runsLeft);
  const batchSize = Math.max(0, Math.min(plan.maxBatchPerRun, fair));
  return { batchSize, safeRemaining, runsLeft, monthlyBudget };
}

/**
 * Bir link için tahmini ortalama yenileme aralığını (saat) hesaplar.
 *   intervalHours = (linkCount × interval) / batchSizePerRun
 * batchSizePerRun = 0 ise sınırsız (kota tükendi) → null.
 */
export function estimateRefreshIntervalHours(opts: {
  platform: SocialPlatform;
  trackedLinkCount: number;
  batchSizePerRun: number;
  cronIntervalHours?: number;
}): number | null {
  if (opts.batchSizePerRun <= 0 || opts.trackedLinkCount <= 0) return null;
  const interval = opts.cronIntervalHours ?? CRON_INTERVAL_HOURS;
  return (opts.trackedLinkCount * interval) / opts.batchSizePerRun;
}

/** Türkçe insan dostu interval formatı: "≈ 2.5 günde bir" / "≈ 14 saatte bir". */
export function formatRefreshInterval(hours: number | null): string {
  if (hours == null) return "kota tükendi · ay başına kadar bekleniyor";
  if (hours < 24) return `≈ ${Math.round(hours)} saatte bir`;
  const days = hours / 24;
  return days >= 2
    ? `≈ ${days.toFixed(1)} günde bir`
    : `≈ ${Math.round(hours)} saatte bir`;
}
