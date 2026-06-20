/**
 * Marka iGaming UI — yazma + panel/rapor yardımcıları.
 * Okuma (dashboard, CRM, deal, …): @/lib/marka-igaming-api
 */
import type {
  BrandCalendarEvent,
  BrandCampaign,
  BrandComplianceCheck,
  BrandDepartmentBudget,
  BrandIgamingProfile,
  BrandIgamingTask,
  BrandIgamingDashboard,
  BrandInvoiceLine,
  BrandKpiTarget,
  BrandNotificationRule,
  BrandOnboardingProgress,
  BrandOperator,
  BrandPaymentSchedule,
  BrandPayrollRun,
  BrandPlayerEvent,
  BrandRiskFlag,
  IgamingDashboardSummary,
} from "@/types/brand-igaming";

export {
  complianceCompletionPct,
  computePartnerQualityScore,
  fetchAffiliateTiers,
  fetchBrandCampaigns,
  fetchBrandCampaigns as fetchCampaigns,
  fetchCalendarEvents,
  fetchComplianceChecks,
  fetchDealMilestones,
  fetchDealTracking,
  fetchIgamingDashboard,
  fetchInvoiceLines,
  fetchKpiTargets,
  fetchOfferTemplates,
  fetchOperators,
  fetchPostApprovals,
  fetchRiskFlags,
  fetchTrackingDomains,
} from "@/lib/marka-igaming-api";

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `${fallback} (${res.status})`);
  return data;
}

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ── Dashboard / KPI ───────────────────────────────────────────────────────────

export async function fetchIgamingDashboardSummary(
  brandId: string,
  month: string,
): Promise<IgamingDashboardSummary> {
  const res = await fetch(
    `/api/marka/igaming/dashboard${qs({ brandId, month })}`,
    { credentials: "include", cache: "no-store" },
  );
  const data = await jsonOrThrow<{ summary?: IgamingDashboardSummary; dashboard?: BrandIgamingDashboard }>(
    res,
    "Dashboard alınamadı",
  );
  if (data.summary) return data.summary;
  const d = data.dashboard;
  if (!d) throw new Error("Dashboard özeti boş");
  return {
    brandId,
    month: d.month,
    monthly: {
      newRegistrations: d.registrations,
      ftd: d.ftd,
      depositAmount: d.depositAmount,
      withdrawalAmount: d.withdrawalAmount,
      ggr: d.ggr,
      ngr: d.ngr,
      commissionTotal: d.commission,
      activePlayers: d.activePlayers,
    },
    targets: { targetFtd: d.targetFtd, targetNgr: d.targetNgr, targetRegistrations: 0, targetDepositAmount: 0 },
    affiliate: {
      clicks: d.affiliateClicks,
      registrations: d.affiliateRegistrations,
      ftdCount: d.affiliateFtd,
      depositAmount: 0,
      commissionDue: 0,
    },
  };
}

export async function saveKpiTarget(input: Partial<BrandKpiTarget>): Promise<BrandKpiTarget> {
  const res = await fetch("/api/marka/igaming/kpi-targets", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ target: BrandKpiTarget }>(res, "KPI hedefi kaydedilemedi");
  return data.target;
}

// ── Player events ─────────────────────────────────────────────────────────────

export async function upsertPlayerEventsBatch(
  brandId: string,
  events: Partial<BrandPlayerEvent>[],
): Promise<{ count: number }> {
  const res = await fetch("/api/marka/igaming/player-events", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandId, events }),
  });
  const data = await jsonOrThrow<{ count: number }>(res, "Oyuncu olayları kaydedilemedi");
  return { count: data.count ?? 0 };
}

export async function fetchPlayerEvents(
  brandId: string,
  fromOrMonth?: string,
  to?: string,
): Promise<BrandPlayerEvent[]> {
  const params: Record<string, string | undefined> = { brandId };
  if (to) {
    params.from = fromOrMonth;
    params.to = to;
  } else if (fromOrMonth && /^\d{4}-\d{2}$/.test(fromOrMonth)) {
    const [y, m] = fromOrMonth.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    params.from = `${fromOrMonth}-01`;
    params.to = `${fromOrMonth}-${String(last).padStart(2, "0")}`;
  } else {
    params.from = fromOrMonth;
  }
  const res = await fetch(`/api/marka/igaming/player-events${qs(params)}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await jsonOrThrow<{ events: BrandPlayerEvent[] }>(res, "Oyuncu olayları alınamadı");
  return data.events ?? [];
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export async function saveCampaign(input: Partial<BrandCampaign>): Promise<BrandCampaign> {
  const res = await fetch("/api/marka/igaming/campaigns", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ campaign: BrandCampaign }>(res, "Kampanya kaydedilemedi");
  return data.campaign;
}

export async function patchCampaign(
  id: string,
  patch: Partial<BrandCampaign>,
): Promise<BrandCampaign> {
  const res = await fetch("/api/marka/igaming/campaigns", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...patch }),
  });
  const data = await jsonOrThrow<{ campaign: BrandCampaign }>(res, "Kampanya güncellenemedi");
  return data.campaign;
}

export async function deleteCampaign(id: string): Promise<void> {
  const res = await fetch(`/api/marka/igaming/campaigns?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await jsonOrThrow<{ ok: boolean }>(res, "Kampanya silinemedi");
}

// ── Compliance ────────────────────────────────────────────────────────────────

export async function saveComplianceCheck(
  input: Partial<BrandComplianceCheck>,
): Promise<BrandComplianceCheck> {
  const res = await fetch("/api/marka/igaming/compliance", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ check: BrandComplianceCheck }>(res, "Uyumluluk kaydı oluşturulamadı");
  return data.check;
}

export async function patchComplianceCheck(
  id: string,
  patch: Partial<BrandComplianceCheck>,
): Promise<BrandComplianceCheck> {
  const res = await fetch("/api/marka/igaming/compliance", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...patch }),
  });
  const data = await jsonOrThrow<{ check: BrandComplianceCheck }>(res, "Uyumluluk kaydı güncellenemedi");
  return data.check;
}

// ── Risk flags ────────────────────────────────────────────────────────────────

export async function saveRiskFlag(input: Partial<BrandRiskFlag>): Promise<BrandRiskFlag> {
  const res = await fetch("/api/marka/igaming/risk-flags", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ flag: BrandRiskFlag }>(res, "Risk bayrağı kaydedilemedi");
  return data.flag;
}

export async function resolveRiskFlag(id: string): Promise<BrandRiskFlag> {
  const res = await fetch("/api/marka/igaming/risk-flags", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, resolve: true }),
  });
  const data = await jsonOrThrow<{ flag: BrandRiskFlag }>(res, "Risk bayrağı çözülemedi");
  return data.flag;
}

// ── Operators ─────────────────────────────────────────────────────────────────

export async function saveOperator(input: Partial<BrandOperator>): Promise<BrandOperator> {
  const res = await fetch("/api/marka/igaming/operators", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ operator: BrandOperator }>(res, "Operatör kaydedilemedi");
  return data.operator;
}

// ── Invoice lines ─────────────────────────────────────────────────────────────

export async function saveInvoiceLine(input: Partial<BrandInvoiceLine>): Promise<BrandInvoiceLine> {
  const res = await fetch("/api/marka/igaming/invoice-lines", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ line: BrandInvoiceLine }>(res, "Fatura kalemi kaydedilemedi");
  return data.line;
}

export async function deleteInvoiceLine(brandId: string, lineId: string): Promise<void> {
  const res = await fetch(
    `/api/marka/igaming/invoice-lines${qs({ brandId, id: lineId })}`,
    { method: "DELETE", credentials: "include" },
  );
  await jsonOrThrow<{ ok: boolean }>(res, "Fatura kalemi silinemedi");
}

// ── Tasks / calendar ──────────────────────────────────────────────────────────

export async function saveIgamingTask(input: Partial<BrandIgamingTask>): Promise<BrandIgamingTask> {
  const res = await fetch("/api/marka/igaming/tasks", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ task: BrandIgamingTask }>(res, "Görev kaydedilemedi");
  return data.task;
}

export async function fetchIgamingTasks(brandId: string): Promise<BrandIgamingTask[]> {
  const res = await fetch(`/api/marka/igaming/tasks${qs({ brandId })}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await jsonOrThrow<{ tasks: BrandIgamingTask[] }>(res, "Görevler alınamadı");
  return data.tasks ?? [];
}

export async function saveCalendarEvent(
  input: Partial<BrandCalendarEvent>,
): Promise<BrandCalendarEvent> {
  const res = await fetch("/api/marka/igaming/calendar-events", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ event: BrandCalendarEvent }>(res, "Takvim olayı kaydedilemedi");
  return data.event;
}

// ── Integration panel ─────────────────────────────────────────────────────────

export type IntegrationPanel = {
  operators: Array<{
    id: string;
    name: string;
    apiBaseUrl?: string;
    currency: string;
    status: string;
    notes: string;
  }>;
  apiKeys: Array<{
    id: string;
    label: string;
    keyPrefix: string;
    operatorId?: string;
    scopes?: string[];
    lastUsedAt?: string;
  }>;
  webhookLogs: Array<{
    id: string;
    eventType: string;
    statusCode?: number;
    createdAt: string;
    error?: string;
  }>;
  importBatches: Array<{
    id: string;
    source: string;
    status: string;
    rowsImported: number;
    createdAt: string;
  }>;
  lastWebhook: { eventType: string; statusCode?: number; createdAt: string } | null;
  lastImport: {
    id: string;
    source: string;
    status: string;
    rowsImported: number;
    createdAt: string;
  } | null;
};

export async function fetchIntegrationPanel(brandId: string): Promise<IntegrationPanel> {
  const res = await fetch(`/api/marka/igaming/integration${qs({ brandId })}`, {
    credentials: "include",
    cache: "no-store",
  });
  return jsonOrThrow<IntegrationPanel>(res, "Entegrasyon paneli alınamadı");
}

export async function createApiKey(
  brandId: string,
  label = "default",
  operatorId?: string,
): Promise<{ key: string; apiKey: { id: string; keyPrefix: string; label: string } }> {
  const res = await fetch("/api/marka/igaming/integration", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandId, label, operatorId }),
  });
  const data = await jsonOrThrow<{ key: string; apiKey: { id: string; keyPrefix: string; label: string } }>(
    res,
    "API anahtarı oluşturulamadı",
  );
  return data;
}

// ── Reports ─────────────────────────────────────────────────────────────────────

export function downloadReport(brandId: string, type: string, month?: string): void {
  const params = new URLSearchParams({ brandId, type, download: "1" });
  if (month) params.set("month", month);
  window.open(`/api/marka/igaming/reports?${params.toString()}`, "_blank");
}

// ── Payroll / department budgets ──────────────────────────────────────────────

export async function fetchPayrollRuns(brandId: string, month?: string): Promise<BrandPayrollRun[]> {
  const res = await fetch(`/api/marka/igaming/payroll-runs${qs({ brandId, month })}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await jsonOrThrow<{ runs: BrandPayrollRun[] }>(res, "Bordro dönemleri alınamadı");
  return data.runs ?? [];
}

export async function savePayrollRun(input: Partial<BrandPayrollRun>): Promise<BrandPayrollRun> {
  const res = await fetch("/api/marka/igaming/payroll-runs", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ run: BrandPayrollRun }>(res, "Bordro dönemi kaydedilemedi");
  return data.run;
}

export async function fetchDepartmentBudgets(
  brandId: string,
  month: string,
): Promise<BrandDepartmentBudget[]> {
  const res = await fetch(`/api/marka/igaming/department-budgets${qs({ brandId, month })}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await jsonOrThrow<{ budgets: BrandDepartmentBudget[] }>(
    res,
    "Departman bütçeleri alınamadı",
  );
  return data.budgets ?? [];
}

export async function saveDepartmentBudget(
  input: Partial<BrandDepartmentBudget>,
): Promise<BrandDepartmentBudget> {
  const res = await fetch("/api/marka/igaming/department-budgets", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ budget: BrandDepartmentBudget }>(res, "Bütçe kaydedilemedi");
  return data.budget;
}

// ── Payment schedules ───────────────────────────────────────────────────────────

export async function fetchPaymentSchedules(
  brandId: string,
  month?: string,
): Promise<BrandPaymentSchedule[]> {
  const res = await fetch(`/api/marka/igaming/payment-schedules${qs({ brandId, month })}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await jsonOrThrow<{ schedules: BrandPaymentSchedule[] }>(
    res,
    "Ödeme planları alınamadı",
  );
  return data.schedules ?? [];
}

// ── Notification rules ────────────────────────────────────────────────────────

export async function fetchNotificationRules(brandId: string): Promise<BrandNotificationRule[]> {
  const res = await fetch(`/api/marka/igaming/notification-rules${qs({ brandId })}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await jsonOrThrow<{ rules: BrandNotificationRule[] }>(
    res,
    "Bildirim kuralları alınamadı",
  );
  return data.rules ?? [];
}

export async function saveNotificationRule(
  input: Partial<BrandNotificationRule>,
): Promise<BrandNotificationRule> {
  const res = await fetch("/api/marka/igaming/notification-rules", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<{ rule: BrandNotificationRule }>(
    res,
    "Bildirim kuralı kaydedilemedi",
  );
  return data.rule;
}

// ── Onboarding ────────────────────────────────────────────────────────────────

export type OnboardingStepStatus = {
  key: string;
  label: string;
  href: string;
  done: boolean;
};

export async function fetchOnboardingProgress(brandId: string): Promise<{
  progress: BrandOnboardingProgress | null;
  steps: OnboardingStepStatus[];
}> {
  const res = await fetch(`/api/marka/igaming/onboarding${qs({ brandId })}`, {
    credentials: "include",
    cache: "no-store",
  });
  return jsonOrThrow<{ progress: BrandOnboardingProgress | null; steps: OnboardingStepStatus[] }>(
    res,
    "Onboarding durumu alınamadı",
  );
}

export async function saveOnboardingStep(
  brandId: string,
  stepKey: string,
  done = true,
): Promise<BrandOnboardingProgress> {
  const res = await fetch("/api/marka/igaming/onboarding", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandId, stepKey, done }),
  });
  const data = await jsonOrThrow<{ progress: BrandOnboardingProgress }>(
    res,
    "Onboarding adımı kaydedilemedi",
  );
  return data.progress;
}

// ── iGaming profile ───────────────────────────────────────────────────────────

export async function fetchIgamingProfile(brandId: string): Promise<BrandIgamingProfile> {
  const res = await fetch(`/api/marka/igaming/profile${qs({ brandId })}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await jsonOrThrow<{ profile: BrandIgamingProfile }>(res, "iGaming profili alınamadı");
  return data.profile ?? { restrictedGeos: [], igamingSettings: {} };
}

export async function saveIgamingProfile(
  brandId: string,
  patch: Partial<BrandIgamingProfile> & {
    licenseJurisdiction?: string;
    restrictedGeos?: string[];
    igamingSettings?: Record<string, unknown>;
  },
): Promise<BrandIgamingProfile> {
  const res = await fetch("/api/marka/igaming/profile", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brandId, ...patch }),
  });
  const data = await jsonOrThrow<{ profile: BrandIgamingProfile }>(
    res,
    "iGaming profili kaydedilemedi",
  );
  return data.profile;
}
