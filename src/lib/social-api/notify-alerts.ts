import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SOCIAL_PLANS, type SocialPlatform } from "./config";
import { getApiRefreshSettings } from "./settings";
import type { PlatformRunSummary } from "./refresh-runner";

type AlertKind = "quota_exhausted" | "api_error" | "payment_required" | "all_failed";

function classifyError(msg: string): AlertKind {
  const m = msg.toLowerCase();
  if (/payment|subscribe|subscription|402|403|forbidden|unauthorized|billing|plan|upgrade|credit/.test(m)) {
    return "payment_required";
  }
  if (/quota|limit|exceeded|429|too many/.test(m)) {
    return "quota_exhausted";
  }
  return "api_error";
}

async function wasRecentlyNotified(
  refId: string,
  cooldownHours: number
): Promise<boolean> {
  const since = new Date(Date.now() - cooldownHours * 3_600_000).toISOString();
  const { data } = await getSupabaseAdmin()
    .from("app_notifications")
    .select("id")
    .eq("ref_id", refId)
    .gte("created_at", since)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function insertAlert(opts: {
  title: string;
  message: string;
  refId: string;
  href?: string;
}): Promise<boolean> {
  const id = `n-api-${crypto.randomUUID().slice(0, 10)}`;
  const now = new Date().toISOString();
  const base = {
    id,
    type: "api_refresh_alert" as const,
    title: opts.title,
    message: opts.message,
    ref_id: opts.refId,
    triggered_by: null,
    created_at: now,
    read: false,
    href: opts.href ?? "/izlenme",
  };
  const rows = [
    { ...base, id: `${id}-admin`, for_role: "admin" as const, for_user_id: null },
    { ...base, id: `${id}-aud`, for_role: "auditor" as const, for_user_id: null },
  ];
  let { error } = await getSupabaseAdmin().from("app_notifications").insert(rows);
  if (error?.message?.includes("api_refresh_alert")) {
    const fallback = rows.map((r) => ({ ...r, type: "general" as const }));
    const res = await getSupabaseAdmin().from("app_notifications").insert(fallback);
    error = res.error;
  }
  return !error;
}

/**
 * Cron/manuel refresh sonrası admin + denetçiye bildirim (cooldown ile).
 * 7/24 spam yapmaz — aynı platform+uyarı tipi için notifyCooldownHours içinde tekrar atmaz.
 */
export async function notifyApiRefreshIssues(summaries: PlatformRunSummary[]): Promise<void> {
  const settings = await getApiRefreshSettings();
  if (!settings.notifyEnabled) return;

  for (const s of summaries) {
    const plan = SOCIAL_PLANS[s.platform];
    const safeLimit = Math.floor(plan.monthlyLimit * plan.safeFraction);
    const quotaFull = s.quotaBefore >= safeLimit || (s.attempted === 0 && s.quotaBefore >= safeLimit);

    let kind: AlertKind | null = null;
    let title = "";
    let message = "";

    if (quotaFull) {
      kind = "quota_exhausted";
      title = `${plan.label} · aylık kota doldu`;
      message =
        `RapidAPI Basic plan güvenli kotası (${safeLimit}/${plan.monthlyLimit} istek) tükendi. ` +
        `Otomatik yenileme ay sonuna kadar durdu. Ücretli plan yükseltmesi veya ay başını bekleyin.`;
    } else if (s.attempted > 0 && s.succeeded === 0) {
      const errMsg = s.results.find((r) => r.error)?.error ?? "";
      kind = classifyError(errMsg);
      if (kind === "payment_required") {
        title = `${plan.label} · ödeme / abonelik gerekli`;
        message =
          `RapidAPI ${plan.label} API'si yanıt vermiyor — ödeme veya abonelik yenilemesi gerekebilir. ` +
          `Detay: ${errMsg.slice(0, 200)}`;
      } else {
        title = `${plan.label} · API hatası`;
        message =
          `Son otomatik yenilemede ${s.failed} link başarısız oldu. ` +
          `İzlenme panelinden "Bağlantıyı test et" ile kontrol edin. ${errMsg ? `Hata: ${errMsg.slice(0, 160)}` : ""}`;
      }
    } else if (s.failed > 0 && s.succeeded > 0) {
      kind = "api_error";
      title = `${plan.label} · kısmi API hatası`;
      message = `${s.succeeded} link güncellendi, ${s.failed} link hata verdi. Kota: ${s.quotaAfter}/${safeLimit} güvenli.`;
    }

    if (!kind) continue;

    const refId = `api-alert-${s.platform}-${kind}`;
    const recent = await wasRecentlyNotified(refId, settings.notifyCooldownHours);
    if (recent) continue;

    await insertAlert({ title, message, refId });
  }
}
