import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseEnabled, isRapidApiEnabled } from "@/lib/env";
import { getAllUsage, syncQuotaLimitsFromConfig } from "@/lib/social-api/quota";
import { getPlatformHealth } from "@/lib/social-api/health";
import {
  SOCIAL_PLANS,
  calcBatchSize,
  estimateRefreshIntervalHours,
  formatRefreshInterval,
  type SocialPlatform,
} from "@/lib/social-api/config";
import { getApiRefreshSettings, suggestMinCronIntervalHours } from "@/lib/social-api/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PlatformStatus {
  platform: SocialPlatform;
  label: string;
  monthlyLimit: number;
  monthlyBudget: number;
  requestsUsed: number;
  safeRemaining: number;
  trackedLinkCount: number;
  batchSizePerRun: number;
  estimatedIntervalHours: number | null;
  estimatedIntervalLabel: string;
  lastRequestAt: string | null;
  rateLimit: string;
  apiHost: string;
  health: {
    status: "ok" | "warn" | "error" | "exhausted" | "unknown";
    connectivityStatus: "ok" | "warn" | "error" | "unknown";
    lastPingAt: string | null;
    linksWithError: number;
    staleTrackedLinks: number;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    successCount24h: number;
    errorCount24h: number;
    staleHours: number | null;
  } | null;
}

/**
 * GET /api/admin/refresh-status
 *
 * Otomatik yenileme paneli için tek noktadan veri toplar:
 *   - Her platform için aylık kota / kullanım / batch / tahmini interval
 *   - Aktif takip edilen link sayısı
 *   - Son 10 cron çalışma kaydı
 */
export async function GET(_req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  if (session.role !== "admin" && session.role !== "auditor") {
    return NextResponse.json({ ok: false, error: "Yalnızca yönetici / denetçi" }, { status: 403 });
  }

  const db = getSupabaseAdmin();
  await syncQuotaLimitsFromConfig();
  const [usage, health, refreshSettings] = await Promise.all([
    getAllUsage(),
    getPlatformHealth(),
    getApiRefreshSettings(),
  ]);
  const cronIntervalHours = refreshSettings.cronIntervalHours;

  // Aktif & auto_track linklerin platforma göre dağılımı
  const counts: Record<SocialPlatform, number> = { youtube: 0, instagram: 0, tiktok: 0 };
  const { data: links, error: linksErr } = await db
    .from("brand_links")
    .select("platform")
    .eq("status", "active")
    .eq("auto_track", true);
  if (!linksErr && links) {
    for (const row of links as Array<{ platform: string }>) {
      const p = row.platform.toLowerCase();
      if (p === "youtube") counts.youtube += 1;
      else if (p === "instagram") counts.instagram += 1;
      else if (p === "tiktok") counts.tiktok += 1;
    }
  }

  const platforms: PlatformStatus[] = usage.map((u) => {
    const calc = calcBatchSize({
      platform: u.platform,
      usedThisMonth: u.requestsUsed,
      cronIntervalHours,
    });
    const trackedLinkCount = counts[u.platform];
    const intervalHours = estimateRefreshIntervalHours({
      platform: u.platform,
      trackedLinkCount,
      batchSizePerRun: calc.batchSize,
      cronIntervalHours,
    });
    const minSuggestedHours = suggestMinCronIntervalHours(u.platform, trackedLinkCount);
    const platformHealth = health.find((h) => h.platform === u.platform);
    return {
      platform: u.platform,
      label: SOCIAL_PLANS[u.platform].label,
      monthlyLimit: u.monthlyLimit,
      monthlyBudget: calc.monthlyBudget,
      requestsUsed: u.requestsUsed,
      safeRemaining: calc.safeRemaining,
      trackedLinkCount,
      batchSizePerRun: calc.batchSize,
      estimatedIntervalHours: intervalHours,
      estimatedIntervalLabel: formatRefreshInterval(intervalHours),
      lastRequestAt: u.lastRequestAt,
      rateLimit: SOCIAL_PLANS[u.platform].rateLimit,
      apiHost: SOCIAL_PLANS[u.platform].apiHost,
      minSuggestedHours,
      intervalTooAggressive: cronIntervalHours < minSuggestedHours,
      // Sağlık sinyali — UI bunu kullanır
      health: platformHealth
        ? {
            status:
              calc.batchSize === 0 ? ("exhausted" as const) : platformHealth.status,
            connectivityStatus: platformHealth.connectivityStatus,
            lastPingAt: platformHealth.lastPingAt,
            linksWithError: platformHealth.linksWithError,
            staleTrackedLinks: platformHealth.staleTrackedLinks,
            lastSuccessAt: platformHealth.lastSuccessAt,
            lastErrorAt: platformHealth.lastErrorAt,
            lastError: platformHealth.lastError,
            successCount24h: platformHealth.successCount24h,
            errorCount24h: platformHealth.errorCount24h,
            staleHours: platformHealth.staleHours,
          }
        : null,
    };
  });

  const { data: runs } = await db
    .from("api_refresh_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    ok: true,
    rapidApiEnabled: isRapidApiEnabled(),
    cronIntervalHours,
    settings: refreshSettings,
    platforms,
    recentRuns: runs ?? [],
  });
}
