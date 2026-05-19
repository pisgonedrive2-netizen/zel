import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CRON_INTERVAL_HOURS, SOCIAL_PLANS, type SocialPlatform } from "./config";

export interface ApiRefreshSettings {
  /** Cron / otomatik yenileme aralığı (saat). Vercel cron günlük tetiklenir; bu değer minimum bekleme süresidir. */
  cronIntervalHours: number;
  /** API sorunlarında admin/denetçiye bildirim gönder. */
  notifyEnabled: boolean;
  /** Aynı uyarı tipi için minimum bekleme (saat) — 7/24 spam önleme. */
  notifyCooldownHours: number;
}

/** Panelden seçilebilir aralıklar (Basic plan ile uyumlu). */
export const CRON_INTERVAL_OPTIONS: Array<{ hours: number; label: string }> = [
  { hours: 6, label: "6 saatte bir" },
  { hours: 12, label: "12 saatte bir" },
  { hours: 24, label: "24 saatte bir (önerilen)" },
  { hours: 48, label: "48 saatte bir" },
  { hours: 72, label: "72 saatte bir" },
];

const DEFAULTS: ApiRefreshSettings = {
  cronIntervalHours: CRON_INTERVAL_HOURS,
  notifyEnabled: true,
  notifyCooldownHours: 12,
};

function clampInterval(h: number): number {
  const allowed = CRON_INTERVAL_OPTIONS.map((o) => o.hours);
  if (allowed.includes(h)) return h;
  return DEFAULTS.cronIntervalHours;
}

export async function getApiRefreshSettings(): Promise<ApiRefreshSettings> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "apiRefresh.cronIntervalHours",
        "apiRefresh.notifyEnabled",
        "apiRefresh.notifyCooldownHours",
      ]);
    if (error || !data?.length) return { ...DEFAULTS };

    const map = new Map(data.map((r) => [String((r as { key: string }).key), (r as { value: unknown }).value]));
    const rawHours = map.get("apiRefresh.cronIntervalHours");
    const rawNotify = map.get("apiRefresh.notifyEnabled");
    const rawCooldown = map.get("apiRefresh.notifyCooldownHours");

    return {
      cronIntervalHours: clampInterval(
        typeof rawHours === "number" ? rawHours : Number(rawHours) || DEFAULTS.cronIntervalHours
      ),
      notifyEnabled:
        typeof rawNotify === "boolean" ? rawNotify : rawNotify !== false && rawNotify !== "false",
      notifyCooldownHours: Math.min(
        48,
        Math.max(4, typeof rawCooldown === "number" ? rawCooldown : Number(rawCooldown) || 12)
      ),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveApiRefreshSettings(
  partial: Partial<ApiRefreshSettings>,
  updatedBy?: string
): Promise<ApiRefreshSettings> {
  const current = await getApiRefreshSettings();
  const next: ApiRefreshSettings = {
    cronIntervalHours: partial.cronIntervalHours != null
      ? clampInterval(partial.cronIntervalHours)
      : current.cronIntervalHours,
    notifyEnabled: partial.notifyEnabled ?? current.notifyEnabled,
    notifyCooldownHours:
      partial.notifyCooldownHours != null
        ? Math.min(48, Math.max(4, partial.notifyCooldownHours))
        : current.notifyCooldownHours,
  };

  const rows = [
    { key: "apiRefresh.cronIntervalHours", value: next.cronIntervalHours, updated_by: updatedBy ?? null },
    { key: "apiRefresh.notifyEnabled", value: next.notifyEnabled, updated_by: updatedBy ?? null },
    { key: "apiRefresh.notifyCooldownHours", value: next.notifyCooldownHours, updated_by: updatedBy ?? null },
  ];

  const { error } = await getSupabaseAdmin().from("app_settings").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return next;
}

/**
 * Basic plan kotasına göre önerilen minimum cron aralığı (saat).
 * trackedLinkCount ve batch hesabına göre ay sonuna kadar güvenli kalır.
 */
export function suggestMinCronIntervalHours(
  platform: SocialPlatform,
  trackedLinkCount: number
): number {
  const plan = SOCIAL_PLANS[platform];
  const monthlyBudget = Math.floor(plan.monthlyLimit * plan.safeFraction);
  if (trackedLinkCount <= 0 || monthlyBudget <= 0) return 24;
  const maxBatch = plan.maxBatchPerRun;
  const runsNeededPerCycle = Math.ceil(trackedLinkCount / maxBatch);
  const hoursInMonth = 30 * 24;
  const minHours = Math.ceil(hoursInMonth / (monthlyBudget / runsNeededPerCycle));
  return Math.max(6, Math.min(72, minHours));
}
