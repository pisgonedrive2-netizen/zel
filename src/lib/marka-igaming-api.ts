/**
 * Marka iGaming program — istemci fetch yardımcıları.
 */

import { ApiError } from "@/lib/streamer-pool-api";
import { previousMonthYm } from "@/lib/brand-igaming-metrics";
import type {
  AffiliateTier,
  BrandCampaign,
  BrandCalendarEvent,
  BrandComplianceCheck,
  BrandContentViolation,
  BrandDealMilestone,
  BrandDealTrackingLink,
  BrandIgamingDashboard,
  BrandKpiTarget,
  BrandOfferTemplate,
  BrandPostApproval,
  BrandTrackingDomain,
} from "@/types/brand-igaming";

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(init?.body && typeof init.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    let msg = `Sunucu hatası (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) msg = data.error;
    } catch {
      /* json parse opsiyonel */
    }
    throw new ApiError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ── Dashboard / KPI / compliance ─────────────────────────────────────────────

export async function fetchIgamingDashboard(
  brandId: string,
  month: string
): Promise<BrandIgamingDashboard> {
  const data = await jsonFetch<{ ok?: boolean; dashboard: BrandIgamingDashboard }>(
    `/api/marka/igaming/dashboard${qs({ brandId, month })}`
  );
  return data.dashboard;
}

export async function fetchIgamingDashboardPair(
  brandId: string,
  month: string
): Promise<{ current: BrandIgamingDashboard; previous: BrandIgamingDashboard | null }> {
  const prevMonth = previousMonthYm(month);
  const [current, previous] = await Promise.all([
    fetchIgamingDashboard(brandId, month),
    fetchIgamingDashboard(brandId, prevMonth).catch(() => null),
  ]);
  return { current, previous };
}

export async function fetchKpiTargets(
  brandId: string,
  month: string
): Promise<BrandKpiTarget | null> {
  const data = await jsonFetch<{ ok?: boolean; targets?: BrandKpiTarget[]; target?: BrandKpiTarget | null }>(
    `/api/marka/igaming/kpi-targets${qs({ brandId, month })}`
  );
  return data.target ?? data.targets?.[0] ?? null;
}

export async function upsertKpiTargets(
  target: Omit<BrandKpiTarget, "id"> & { id?: string }
): Promise<BrandKpiTarget> {
  const data = await jsonFetch<{ ok?: boolean; target: BrandKpiTarget }>(
    `/api/marka/igaming/kpi-targets`,
    { method: "POST", body: JSON.stringify(target) }
  );
  return data.target;
}

export async function fetchComplianceChecks(
  brandId: string
): Promise<BrandComplianceCheck[]> {
  const data = await jsonFetch<{ ok?: boolean; checks: BrandComplianceCheck[] }>(
    `/api/marka/igaming/compliance${qs({ brandId })}`
  );
  return Array.isArray(data.checks) ? data.checks : [];
}

export function complianceCompletionPct(checks: BrandComplianceCheck[]): number {
  if (checks.length === 0) return 0;
  const done = checks.filter((c) => c.status === "passed" || c.status === "waived").length;
  return Math.round((done / checks.length) * 100);
}

export async function fetchAffiliateTiers(brandId: string): Promise<AffiliateTier[]> {
  const data = await jsonFetch<{ ok?: boolean; tiers: AffiliateTier[] }>(
    `/api/marka/igaming/tiers${qs({ brandId })}`
  );
  return Array.isArray(data.tiers) ? data.tiers : [];
}

export async function fetchBrandCampaigns(brandId: string): Promise<BrandCampaign[]> {
  const data = await jsonFetch<{ ok?: boolean; campaigns: BrandCampaign[] }>(
    `/api/marka/igaming/campaigns${qs({ brandId })}`
  );
  return Array.isArray(data.campaigns) ? data.campaigns : [];
}

/** Partner performansından basit kalite skoru (0–100). */
export function computePartnerQualityScore(
  clicks: number,
  registrations: number,
  ftd: number
): number {
  if (clicks === 0 && registrations === 0 && ftd === 0) return 50;
  const regRate = clicks > 0 ? registrations / clicks : 0;
  const ftdRate = registrations > 0 ? ftd / registrations : 0;
  const raw = regRate * 35 + ftdRate * 55 + (ftd > 0 ? 10 : 0);
  return Math.max(0, Math.min(100, Math.round(raw * 100)));
}

// ── Diğer iGaming modülleri ───────────────────────────────────────────────────

async function igamingFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const q = params
    ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
    : "";
  return jsonFetch<T>(`/api/marka/igaming/${path}${q}`);
}

export function fetchOfferTemplates(brandId: string) {
  return igamingFetch<{ templates: BrandOfferTemplate[] }>("offer-templates", { brandId }).then(
    (d) => d.templates ?? []
  );
}

export function fetchDealMilestones(brandId: string, dealId?: string) {
  const params: Record<string, string> = { brandId };
  if (dealId) params.dealId = dealId;
  return igamingFetch<{ milestones: BrandDealMilestone[] }>("deal-milestones", params).then(
    (d) => d.milestones ?? []
  );
}

export function fetchDealTracking(brandId: string, dealId?: string) {
  const params: Record<string, string> = { brandId };
  if (dealId) params.dealId = dealId;
  return igamingFetch<{ links: BrandDealTrackingLink[] }>("deal-tracking", params).then(
    (d) => d.links ?? []
  );
}

export function fetchCalendarEvents(brandId: string, from?: string, to?: string) {
  const params: Record<string, string> = { brandId };
  if (from) params.from = from;
  if (to) params.to = to;
  return igamingFetch<{ events: BrandCalendarEvent[] }>("calendar-events", params).then(
    (d) => d.events ?? []
  );
}

export function fetchTrackingDomains(brandId: string) {
  return igamingFetch<{ domains: BrandTrackingDomain[] }>("tracking-domains", { brandId }).then(
    (d) => d.domains ?? []
  );
}

export function fetchPostApprovals(brandId: string) {
  return igamingFetch<{
    approvals: BrandPostApproval[];
    violations: BrandContentViolation[];
  }>("post-approvals", { brandId }).then((d) => ({
    approvals: d.approvals ?? [],
    violations: d.violations ?? [],
  }));
}
