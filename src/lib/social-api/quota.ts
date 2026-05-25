import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SOCIAL_PLANS, currentMonthKey, type SocialPlatform } from "./config";

export interface QuotaRow {
  platform: SocialPlatform;
  month: string;
  requestsUsed: number;
  monthlyLimit: number;
  lastRequestAt: string | null;
}

const PLATFORMS: SocialPlatform[] = ["youtube", "instagram", "tiktok"];

function rowId(platform: SocialPlatform, month: string): string {
  return `q-${platform}-${month}`;
}

/** Belirtilen ayda bir platform için kayıtlı kullanım — yoksa 0 döner. */
export async function getMonthlyUsage(
  platform: SocialPlatform,
  month: string = currentMonthKey()
): Promise<QuotaRow> {
  const { data, error } = await getSupabaseAdmin()
    .from("api_quota_usage")
    .select("*")
    .eq("platform", platform)
    .eq("month", month)
    .maybeSingle();
  if (error) throw new Error(`api_quota_usage: ${error.message}`);
  const db = getSupabaseAdmin();
  if (!data) {
    return {
      platform,
      month,
      requestsUsed: 0,
      monthlyLimit: SOCIAL_PLANS[platform].monthlyLimit,
      lastRequestAt: null,
    };
  }
  const row = data as Record<string, unknown>;
  const planLimit = SOCIAL_PLANS[platform].monthlyLimit;
  const storedLimit = (row.monthly_limit as number) ?? 0;
  if (storedLimit !== planLimit) {
    void db
      .from("api_quota_usage")
      .update({ monthly_limit: planLimit })
      .eq("platform", platform)
      .eq("month", month)
      .then(() => undefined);
  }
  return {
    platform,
    month,
    requestsUsed: (row.requests_used as number) ?? 0,
    monthlyLimit: planLimit,
    lastRequestAt: (row.last_request_at as string | null) ?? null,
  };
}

/** Eski düşük limit kayıtlarını güncel plan limitlerine çeker (YT/IG 5000, TikTok 5000). */
export async function syncQuotaLimitsFromConfig(month: string = currentMonthKey()): Promise<void> {
  const db = getSupabaseAdmin();
  for (const platform of PLATFORMS) {
    const limit = SOCIAL_PLANS[platform].monthlyLimit;
    await db
      .from("api_quota_usage")
      .update({ monthly_limit: limit })
      .eq("platform", platform)
      .eq("month", month)
      .lt("monthly_limit", limit);
  }
}

export async function getAllUsage(month: string = currentMonthKey()): Promise<QuotaRow[]> {
  return Promise.all(PLATFORMS.map((p) => getMonthlyUsage(p, month)));
}

/**
 * Kullanımı `delta` (>=1) kadar artırır. Hem yeni satır oluşturur hem mevcudu
 * günceller. (Atomik değil — Postgres'te race koşulu olsa bile yalnızca cron
 * ve manuel-refresh tek noktadan tetiklendiği için pratikte güvenli.)
 */
export async function incrementUsage(
  platform: SocialPlatform,
  delta: number = 1,
  month: string = currentMonthKey()
): Promise<void> {
  const db = getSupabaseAdmin();
  const id = rowId(platform, month);
  const limit = SOCIAL_PLANS[platform].monthlyLimit;

  // Önce upsert ile bir satır olduğundan emin ol (yoksa varsayılan limitle ekle).
  const { error: upsertErr } = await db
    .from("api_quota_usage")
    .upsert(
      {
        id,
        platform,
        month,
        monthly_limit: limit,
      },
      { onConflict: "platform,month", ignoreDuplicates: true }
    );
  if (upsertErr) throw new Error(`api_quota_usage upsert: ${upsertErr.message}`);

  // Sonra delta uygula
  const { data, error } = await db
    .from("api_quota_usage")
    .select("requests_used")
    .eq("platform", platform)
    .eq("month", month)
    .single();
  if (error) throw new Error(`api_quota_usage read: ${error.message}`);
  const current = ((data as { requests_used?: number })?.requests_used ?? 0) + delta;

  const { error: updateErr } = await db
    .from("api_quota_usage")
    .update({
      requests_used: current,
      last_request_at: new Date().toISOString(),
    })
    .eq("platform", platform)
    .eq("month", month);
  if (updateErr) throw new Error(`api_quota_usage update: ${updateErr.message}`);
}
