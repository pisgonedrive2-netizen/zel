import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { brandMonthlyStatsFromRow } from "@/lib/db/mappers";
import type {
  BrandAuditLogEntry,
  BrandCalendarEvent,
  BrandCampaign,
  BrandComplianceCheck,
  BrandContentViolation,
  BrandDealMilestone,
  BrandDealTrackingLink,
  BrandPostApproval,
  BrandTrackingDomain,
  BrandDepartmentBudget,
  BrandIgamingTask,
  BrandImportBatch,
  BrandInvoiceLine,
  BrandKpiTarget,
  BrandNotificationRule,
  BrandOnboardingProgress,
  BrandPaymentSchedule,
  BrandPayrollRun,
  BrandPlayerEvent,
  BrandWebhookLog,
  IgamingDashboardSummary,
  IgamingCurrency,
  PlayerEventChannel,
  PlayerEventSource,
  PlayerEventType,
} from "@/types/brand-igaming";

const str = (v: unknown, d = ""): string => (v == null ? d : String(v));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
function pick<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  const s = String(v ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : fb;
}

const CURRENCY: readonly IgamingCurrency[] = ["USD", "EUR", "TRY"];
const EVENT_TYPES: readonly PlayerEventType[] = [
  "registration", "ftd", "deposit", "withdrawal", "chargeback", "active_player",
];
const CHANNELS: readonly PlayerEventChannel[] = ["all", "affiliate", "organic", "influencer"];
const SOURCES: readonly PlayerEventSource[] = ["manual", "csv", "api", "webhook"];
const CAMPAIGN_TYPES = ["bonus", "tournament", "landing", "promo", "affiliate"] as const;
const CAMPAIGN_STATUS = ["draft", "active", "paused", "ended"] as const;
const COMPLIANCE_TYPES = [
  "kyc", "geo_restrict", "responsible_gaming", "ad_disclosure", "license", "other",
] as const;
const COMPLIANCE_STATUS = ["pending", "passed", "failed", "waived"] as const;
const TASK_STATUS = ["open", "in_progress", "done", "cancelled"] as const;
const TASK_PRIORITY = ["low", "normal", "high", "urgent"] as const;
const CALENDAR_TYPES = ["campaign", "compliance", "launch", "payout", "content", "other"] as const;

function missingTable(err: { message: string }): boolean {
  return /relation .* does not exist|does not exist|schema cache/i.test(err.message);
}

// ── KPI targets ──────────────────────────────────────────────────────────────
function kpiFromRow(r: Record<string, unknown>): BrandKpiTarget {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    month: str(r.month),
    targetFtd: num(r.target_ftd),
    targetRegistrations: num(r.target_registrations),
    targetDepositAmount: num(r.target_deposit_amount),
    targetNgr: num(r.target_ngr),
    targetContentDeliveries: num(r.target_content_deliveries),
    targetAffiliateRoi: r.target_affiliate_roi != null ? num(r.target_affiliate_roi) : undefined,
    notes: str(r.notes),
    updatedBy: r.updated_by ? str(r.updated_by) : undefined,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}
function kpiToRow(t: BrandKpiTarget) {
  return {
    id: t.id,
    brand_id: t.brandId,
    month: t.month,
    target_ftd: t.targetFtd,
    target_registrations: t.targetRegistrations,
    target_deposit_amount: t.targetDepositAmount,
    target_ngr: t.targetNgr,
    target_content_deliveries: t.targetContentDeliveries,
    target_affiliate_roi: t.targetAffiliateRoi ?? null,
    notes: t.notes,
    updated_by: t.updatedBy ?? null,
  };
}

export async function fetchBrandKpiTargets(
  brandId: string,
  month?: string,
): Promise<BrandKpiTarget[]> {
  let q = getSupabaseAdmin().from("brand_kpi_targets").select("*").eq("brand_id", brandId);
  if (month) q = q.eq("month", month);
  const { data, error } = await q.order("month", { ascending: false });
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_kpi_targets: ${error.message}`);
  }
  return (data ?? []).map((r) => kpiFromRow(r as Record<string, unknown>));
}

export async function saveBrandKpiTarget(t: BrandKpiTarget): Promise<BrandKpiTarget> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_kpi_targets")
    .upsert(kpiToRow(t), { onConflict: "brand_id,month" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_kpi_targets: ${error.message}`);
  if (!data) throw new Error("brand_kpi_targets: upsert sonuç dönmedi.");
  return kpiFromRow(data as Record<string, unknown>);
}

// ── Player events ────────────────────────────────────────────────────────────
function playerEventFromRow(r: Record<string, unknown>): BrandPlayerEvent {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    eventDate: str(r.event_date).slice(0, 10),
    eventType: pick(r.event_type, EVENT_TYPES, "registration"),
    channel: pick(r.channel, CHANNELS, "all"),
    countryCode: r.country_code ? str(r.country_code) : undefined,
    eventCount: Math.max(0, Math.floor(num(r.event_count))),
    amount: num(r.amount),
    currency: pick(r.currency, CURRENCY, "USD"),
    importBatchId: r.import_batch_id ? str(r.import_batch_id) : undefined,
    source: pick(r.source, SOURCES, "manual"),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}
function playerEventToRow(e: BrandPlayerEvent) {
  return {
    id: e.id,
    brand_id: e.brandId,
    event_date: e.eventDate,
    event_type: e.eventType,
    channel: e.channel,
    country_code: e.countryCode ?? null,
    event_count: e.eventCount,
    amount: e.amount,
    currency: e.currency,
    import_batch_id: e.importBatchId ?? null,
    source: e.source,
  };
}

export async function fetchBrandPlayerEvents(
  brandId: string,
  from?: string,
  to?: string,
): Promise<BrandPlayerEvent[]> {
  let q = getSupabaseAdmin()
    .from("brand_player_events")
    .select("*")
    .eq("brand_id", brandId)
    .order("event_date", { ascending: false });
  if (from) q = q.gte("event_date", from);
  if (to) q = q.lte("event_date", to);
  const { data, error } = await q;
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_player_events: ${error.message}`);
  }
  return (data ?? []).map((r) => playerEventFromRow(r as Record<string, unknown>));
}

export async function upsertBrandPlayerEventsBatch(
  events: BrandPlayerEvent[],
): Promise<{ count: number }> {
  if (events.length === 0) return { count: 0 };
  const rows = events.map(playerEventToRow);
  const { error } = await getSupabaseAdmin()
    .from("brand_player_events")
    .upsert(rows, {
      onConflict: "brand_id,event_date,event_type,channel,country_code",
    });
  if (error) throw new Error(`brand_player_events: ${error.message}`);
  return { count: events.length };
}

// ── Campaigns ──────────────────────────────────────────────────────────────────
function campaignFromRow(r: Record<string, unknown>): BrandCampaign {
  const rules = r.rules;
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    name: str(r.name),
    campaignType: pick(r.campaign_type, CAMPAIGN_TYPES, "bonus"),
    promoCode: r.promo_code ? str(r.promo_code) : undefined,
    startDate: r.start_date ? str(r.start_date).slice(0, 10) : undefined,
    endDate: r.end_date ? str(r.end_date).slice(0, 10) : undefined,
    rules: rules && typeof rules === "object" && !Array.isArray(rules)
      ? (rules as Record<string, unknown>)
      : {},
    status: pick(r.status, CAMPAIGN_STATUS, "draft"),
    budgetUsd: r.budget_usd != null ? num(r.budget_usd) : undefined,
    notes: str(r.notes),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}
function campaignToRow(c: BrandCampaign) {
  return {
    id: c.id,
    brand_id: c.brandId,
    name: c.name,
    campaign_type: c.campaignType,
    promo_code: c.promoCode ?? null,
    start_date: c.startDate ?? null,
    end_date: c.endDate ?? null,
    rules: c.rules,
    status: c.status,
    budget_usd: c.budgetUsd ?? null,
    notes: c.notes,
  };
}

export async function fetchBrandCampaigns(brandId: string): Promise<BrandCampaign[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_campaigns")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_campaigns: ${error.message}`);
  }
  return (data ?? []).map((r) => campaignFromRow(r as Record<string, unknown>));
}

export async function findBrandCampaignById(id: string): Promise<BrandCampaign | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`brand_campaigns: ${error.message}`);
  return data ? campaignFromRow(data as Record<string, unknown>) : null;
}

export async function upsertBrandCampaign(c: BrandCampaign): Promise<BrandCampaign> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_campaigns")
    .upsert(campaignToRow(c), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_campaigns: ${error.message}`);
  if (!data) throw new Error("brand_campaigns: upsert sonuç dönmedi.");
  return campaignFromRow(data as Record<string, unknown>);
}

// ── Compliance ─────────────────────────────────────────────────────────────────
function complianceFromRow(r: Record<string, unknown>): BrandComplianceCheck {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    checkType: pick(r.check_type, COMPLIANCE_TYPES, "other"),
    status: pick(r.status, COMPLIANCE_STATUS, "pending"),
    dueDate: r.due_date ? str(r.due_date).slice(0, 10) : undefined,
    completedAt: r.completed_at ? str(r.completed_at) : undefined,
    evidenceUrl: r.evidence_url ? str(r.evidence_url) : undefined,
    notes: str(r.notes),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}
function complianceToRow(c: BrandComplianceCheck) {
  return {
    id: c.id,
    brand_id: c.brandId,
    check_type: c.checkType,
    status: c.status,
    due_date: c.dueDate ?? null,
    completed_at: c.completedAt ?? null,
    evidence_url: c.evidenceUrl ?? null,
    notes: c.notes,
  };
}

export async function fetchBrandComplianceChecks(
  brandId: string,
): Promise<BrandComplianceCheck[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_compliance_checks")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_compliance_checks: ${error.message}`);
  }
  return (data ?? []).map((r) => complianceFromRow(r as Record<string, unknown>));
}

export async function findBrandComplianceById(
  id: string,
): Promise<BrandComplianceCheck | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_compliance_checks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`brand_compliance_checks: ${error.message}`);
  return data ? complianceFromRow(data as Record<string, unknown>) : null;
}

export async function upsertBrandComplianceCheck(
  c: BrandComplianceCheck,
): Promise<BrandComplianceCheck> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_compliance_checks")
    .upsert(complianceToRow(c), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_compliance_checks: ${error.message}`);
  if (!data) throw new Error("brand_compliance_checks: upsert sonuç dönmedi.");
  return complianceFromRow(data as Record<string, unknown>);
}

// ── Audit log ──────────────────────────────────────────────────────────────────
function auditFromRow(r: Record<string, unknown>): BrandAuditLogEntry {
  const meta = r.metadata;
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    actorId: r.actor_id ? str(r.actor_id) : undefined,
    actorName: r.actor_name ? str(r.actor_name) : undefined,
    action: str(r.action),
    entityType: r.entity_type ? str(r.entity_type) : undefined,
    entityId: r.entity_id ? str(r.entity_id) : undefined,
    detail: str(r.detail),
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
    createdAt: str(r.created_at),
  };
}

export async function appendBrandAuditLog(entry: {
  id: string;
  brandId: string;
  actorId?: string;
  actorName?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await getSupabaseAdmin().from("brand_audit_log").insert({
    id: entry.id,
    brand_id: entry.brandId,
    actor_id: entry.actorId ?? null,
    actor_name: entry.actorName ?? null,
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    detail: entry.detail ?? "",
    metadata: entry.metadata ?? {},
  });
  if (error && !missingTable(error)) throw new Error(`brand_audit_log: ${error.message}`);
}

export async function fetchBrandAuditLogRecent(
  brandId: string,
  limit = 50,
): Promise<BrandAuditLogEntry[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_audit_log")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_audit_log: ${error.message}`);
  }
  return (data ?? []).map((r) => auditFromRow(r as Record<string, unknown>));
}

// ── Tasks (brand_tasks) ────────────────────────────────────────────────────────
function taskFromRow(r: Record<string, unknown>): BrandIgamingTask {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    title: str(r.title),
    description: str(r.description),
    assigneeUserId: r.assignee_user_id ? str(r.assignee_user_id) : undefined,
    staffId: r.staff_id ? str(r.staff_id) : undefined,
    dueDate: r.due_date ? str(r.due_date).slice(0, 10) : undefined,
    status: pick(r.status, TASK_STATUS, "open"),
    priority: pick(r.priority, TASK_PRIORITY, "normal"),
    campaignId: r.campaign_id ? str(r.campaign_id) : undefined,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}
function taskToRow(t: BrandIgamingTask) {
  return {
    id: t.id,
    brand_id: t.brandId,
    title: t.title,
    description: t.description,
    assignee_user_id: t.assigneeUserId ?? null,
    staff_id: t.staffId ?? null,
    due_date: t.dueDate ?? null,
    status: t.status,
    priority: t.priority,
    campaign_id: t.campaignId ?? null,
  };
}

export async function fetchBrandIgamingTasks(brandId: string): Promise<BrandIgamingTask[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_tasks")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_tasks: ${error.message}`);
  }
  return (data ?? []).map((r) => taskFromRow(r as Record<string, unknown>));
}

export async function upsertBrandIgamingTask(t: BrandIgamingTask): Promise<BrandIgamingTask> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_tasks")
    .upsert(taskToRow(t), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_tasks: ${error.message}`);
  if (!data) throw new Error("brand_tasks: upsert sonuç dönmedi.");
  return taskFromRow(data as Record<string, unknown>);
}

// ── Calendar events ────────────────────────────────────────────────────────────
function calendarFromRow(r: Record<string, unknown>): BrandCalendarEvent {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    eventDate: str(r.event_date).slice(0, 10),
    title: str(r.title),
    eventType: pick(r.event_type, CALENDAR_TYPES, "other"),
    refId: r.ref_id ? str(r.ref_id) : undefined,
    notes: str(r.notes),
    createdAt: str(r.created_at),
  };
}
function calendarToRow(e: BrandCalendarEvent) {
  return {
    id: e.id,
    brand_id: e.brandId,
    event_date: e.eventDate,
    title: e.title,
    event_type: e.eventType,
    ref_id: e.refId ?? null,
    notes: e.notes,
  };
}

export async function fetchBrandCalendarEvents(
  brandId: string,
  from?: string,
  to?: string,
): Promise<BrandCalendarEvent[]> {
  let q = getSupabaseAdmin()
    .from("brand_calendar_events")
    .select("*")
    .eq("brand_id", brandId)
    .order("event_date", { ascending: true });
  if (from) q = q.gte("event_date", from);
  if (to) q = q.lte("event_date", to);
  const { data, error } = await q;
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_calendar_events: ${error.message}`);
  }
  return (data ?? []).map((r) => calendarFromRow(r as Record<string, unknown>));
}

export async function upsertBrandCalendarEvent(
  e: BrandCalendarEvent,
): Promise<BrandCalendarEvent> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_calendar_events")
    .upsert(calendarToRow(e), { onConflict: "id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_calendar_events: ${error.message}`);
  if (!data) throw new Error("brand_calendar_events: upsert sonuç dönmedi.");
  return calendarFromRow(data as Record<string, unknown>);
}

// ── Import batches ─────────────────────────────────────────────────────────────
function importBatchFromRow(r: Record<string, unknown>): BrandImportBatch {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    source: str(r.source),
    status: pick(r.status, ["processing", "done", "failed"] as const, "processing"),
    rowsTotal: Math.max(0, Math.floor(num(r.rows_total))),
    rowsImported: Math.max(0, Math.floor(num(r.rows_imported))),
    errorMessage: r.error_message ? str(r.error_message) : undefined,
    createdAt: str(r.created_at),
    finishedAt: r.finished_at ? str(r.finished_at) : undefined,
  };
}

export async function findImportBatchById(id: string): Promise<BrandImportBatch | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_import_batches")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (missingTable(error)) return null;
    throw new Error(`brand_import_batches: ${error.message}`);
  }
  return data ? importBatchFromRow(data as Record<string, unknown>) : null;
}

export async function upsertImportBatch(batch: BrandImportBatch): Promise<BrandImportBatch> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_import_batches")
    .upsert(
      {
        id: batch.id,
        brand_id: batch.brandId,
        source: batch.source,
        status: batch.status,
        rows_total: batch.rowsTotal,
        rows_imported: batch.rowsImported,
        error_message: batch.errorMessage ?? null,
        finished_at: batch.finishedAt ?? null,
      },
      { onConflict: "id" },
    )
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_import_batches: ${error.message}`);
  if (!data) throw new Error("brand_import_batches: upsert sonuç dönmedi.");
  return importBatchFromRow(data as Record<string, unknown>);
}

export async function fetchLatestImportBatch(
  brandId: string,
): Promise<BrandImportBatch | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_import_batches")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (missingTable(error)) return null;
    throw new Error(`brand_import_batches: ${error.message}`);
  }
  return data ? importBatchFromRow(data as Record<string, unknown>) : null;
}

// ── Webhook logs ───────────────────────────────────────────────────────────────
export async function appendBrandWebhookLog(
  log: Omit<BrandWebhookLog, "createdAt"> & { createdAt?: string },
): Promise<void> {
  const { error } = await getSupabaseAdmin().from("brand_webhook_logs").insert({
    id: log.id,
    brand_id: log.brandId,
    operator_id: log.operatorId ?? null,
    event_type: log.eventType,
    status_code: log.statusCode ?? null,
    payload: log.payload ?? null,
    error: log.error ?? null,
  });
  if (error && !missingTable(error)) throw new Error(`brand_webhook_logs: ${error.message}`);
}

export async function fetchLatestWebhookLog(
  brandId: string,
): Promise<BrandWebhookLog | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_webhook_logs")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (missingTable(error)) return null;
    throw new Error(`brand_webhook_logs: ${error.message}`);
  }
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    operatorId: r.operator_id ? str(r.operator_id) : undefined,
    eventType: str(r.event_type),
    statusCode: r.status_code != null ? num(r.status_code) : undefined,
    payload:
      r.payload && typeof r.payload === "object" && !Array.isArray(r.payload)
        ? (r.payload as Record<string, unknown>)
        : undefined,
    error: r.error ? str(r.error) : undefined,
    createdAt: str(r.created_at),
  };
}

// ── Operators ──────────────────────────────────────────────────────────────────
export async function findBrandOperatorById(
  operatorId: string,
): Promise<{ id: string; brandId: string; name: string; status: string } | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_operators")
    .select("id, brand_id, name, status")
    .eq("id", operatorId)
    .maybeSingle();
  if (error) {
    if (missingTable(error)) return null;
    throw new Error(`brand_operators: ${error.message}`);
  }
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    name: str(r.name),
    status: str(r.status),
  };
}

// ── Dashboard summary ──────────────────────────────────────────────────────────
function monthDateRange(monthYm: string): { from: string; to: string } {
  const [y, m] = monthYm.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: `${monthYm}-01`,
    to: `${monthYm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export async function fetchIgamingDashboardSummary(
  brandId: string,
  month: string,
): Promise<IgamingDashboardSummary> {
  const admin = getSupabaseAdmin();
  const { from, to } = monthDateRange(month);

  const [statsRes, kpiRes, affRes] = await Promise.all([
    admin
      .from("brand_monthly_stats")
      .select("*")
      .eq("brand_id", brandId)
      .eq("month", month)
      .maybeSingle(),
    admin
      .from("brand_kpi_targets")
      .select("*")
      .eq("brand_id", brandId)
      .eq("month", month)
      .maybeSingle(),
    admin
      .from("affiliate_daily_stats")
      .select("clicks, registrations, ftd_count, deposit_amount, commission_due")
      .eq("brand_id", brandId)
      .gte("stat_date", from)
      .lte("stat_date", to),
  ]);

  if (statsRes.error && !missingTable(statsRes.error)) {
    throw new Error(`brand_monthly_stats: ${statsRes.error.message}`);
  }
  if (kpiRes.error && !missingTable(kpiRes.error)) {
    throw new Error(`brand_kpi_targets: ${kpiRes.error.message}`);
  }
  if (affRes.error && !missingTable(affRes.error)) {
    throw new Error(`affiliate_daily_stats: ${affRes.error.message}`);
  }

  const statsRow = statsRes.data as Record<string, unknown> | null;
  const base = statsRow ? brandMonthlyStatsFromRow(statsRow) : null;
  const ext = statsRow ?? {};

  const kpiRow = kpiRes.data as Record<string, unknown> | null;
  const targets = kpiRow
    ? kpiFromRow(kpiRow)
    : {
        targetFtd: 0,
        targetNgr: 0,
        targetRegistrations: 0,
        targetDepositAmount: 0,
      };

  let aff = {
    clicks: 0,
    registrations: 0,
    ftdCount: 0,
    depositAmount: 0,
    commissionDue: 0,
  };
  for (const row of affRes.data ?? []) {
    const r = row as Record<string, unknown>;
    aff = {
      clicks: aff.clicks + num(r.clicks),
      registrations: aff.registrations + num(r.registrations),
      ftdCount: aff.ftdCount + num(r.ftd_count),
      depositAmount: aff.depositAmount + num(r.deposit_amount),
      commissionDue: aff.commissionDue + num(r.commission_due),
    };
  }

  return {
    brandId,
    month,
    monthly: {
      newRegistrations: base?.newRegistrations ?? num(ext.new_registrations),
      ftd: base?.firstTimeDepositors ?? num(ext.first_time_depositors),
      depositAmount: base?.depositAmount ?? num(ext.deposit_amount),
      withdrawalAmount: base?.withdrawalAmount ?? num(ext.withdrawal_amount),
      ggr: num(ext.ggr),
      ngr: num(ext.ngr),
      commissionTotal: num(ext.commission_total),
      activePlayers: num(ext.active_players),
    },
    targets: {
      targetFtd: "targetFtd" in targets ? targets.targetFtd : 0,
      targetNgr: "targetNgr" in targets ? targets.targetNgr : 0,
      targetRegistrations:
        "targetRegistrations" in targets ? targets.targetRegistrations : 0,
      targetDepositAmount:
        "targetDepositAmount" in targets ? targets.targetDepositAmount : 0,
    },
    affiliate: aff,
  };
}

// ── Backward-compatible aliases (API routes) ───────────────────────────────────
export const fetchCampaigns = fetchBrandCampaigns;
export const fetchComplianceChecks = fetchBrandComplianceChecks;
export const fetchKpiTarget = async (brandId: string, month: string) => {
  const rows = await fetchBrandKpiTargets(brandId, month);
  return rows[0] ?? null;
};
export const upsertKpiTarget = saveBrandKpiTarget;
export const buildIgamingDashboard = async (brandId: string, month: string) => {
  const s = await fetchIgamingDashboardSummary(brandId, month);
  return {
    month: s.month,
    ftd: s.monthly.ftd,
    registrations: s.monthly.newRegistrations,
    depositAmount: s.monthly.depositAmount,
    withdrawalAmount: s.monthly.withdrawalAmount,
    ngr: s.monthly.ngr,
    ggr: s.monthly.ggr,
    commission: s.monthly.commissionTotal,
    activePlayers: s.monthly.activePlayers,
    targetFtd: s.targets.targetFtd,
    targetNgr: s.targets.targetNgr,
    affiliateClicks: s.affiliate.clicks,
    affiliateRegistrations: s.affiliate.registrations,
    affiliateFtd: s.affiliate.ftdCount,
    pendingOffers: 0,
    openCompliance: 0,
    contentBudgetUsd: 0,
    attributedFtd: 0,
  };
};

export async function deleteBrandCampaign(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("brand_campaigns").delete().eq("id", id);
  if (error) throw new Error(`brand_campaigns: ${error.message}`);
}

export async function deleteBrandComplianceCheck(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("brand_compliance_checks").delete().eq("id", id);
  if (error) throw new Error(`brand_compliance_checks: ${error.message}`);
}

export async function deleteBrandIgamingTask(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("brand_tasks").delete().eq("id", id);
  if (error) throw new Error(`brand_tasks: ${error.message}`);
}

export async function fetchBrandWebhookLogs(
  brandId: string,
  limit = 30,
): Promise<BrandWebhookLog[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_webhook_logs")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_webhook_logs: ${error.message}`);
  }
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: str(row.id),
      brandId: str(row.brand_id),
      operatorId: row.operator_id ? str(row.operator_id) : undefined,
      eventType: str(row.event_type),
      statusCode: row.status_code != null ? num(row.status_code) : undefined,
      payload:
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : undefined,
      error: row.error ? str(row.error) : undefined,
      createdAt: str(row.created_at),
    };
  });
}

export async function fetchBrandImportBatches(
  brandId: string,
  limit = 10,
): Promise<BrandImportBatch[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_import_batches")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_import_batches: ${error.message}`);
  }
  return (data ?? []).map((r) => importBatchFromRow(r as Record<string, unknown>));
}

export async function fetchBrandApiKeys(brandId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_api_keys")
    .select("id, brand_id, operator_id, label, key_prefix, scopes, last_used_at, expires_at, created_at, revoked_at")
    .eq("brand_id", brandId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_api_keys: ${error.message}`);
  }
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: str(row.id),
      brandId: str(row.brand_id),
      operatorId: row.operator_id ? str(row.operator_id) : undefined,
      label: str(row.label, "default"),
      keyPrefix: str(row.key_prefix),
      scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
      lastUsedAt: row.last_used_at ? str(row.last_used_at) : undefined,
      expiresAt: row.expires_at ? str(row.expires_at) : undefined,
      createdAt: row.created_at ? str(row.created_at) : undefined,
      revokedAt: row.revoked_at ? str(row.revoked_at) : undefined,
    };
  });
}

export async function createBrandApiKey(opts: {
  brandId: string;
  label: string;
  operatorId?: string;
  createdBy?: string;
}): Promise<{ key: string; apiKey: { id: string; keyPrefix: string; label: string } }> {
  const raw = `fk_${crypto.randomUUID().replace(/-/g, "")}`;
  const prefix = raw.slice(0, 12);
  const id = `bak-${crypto.randomUUID().slice(0, 10)}`;
  const { error } = await getSupabaseAdmin().from("brand_api_keys").insert({
    id,
    brand_id: opts.brandId,
    operator_id: opts.operatorId ?? null,
    label: opts.label || "default",
    key_hash: raw,
    key_prefix: prefix,
    scopes: ["webhook:read", "webhook:write"],
    created_by: opts.createdBy ?? null,
  });
  if (error) throw new Error(`brand_api_keys: ${error.message}`);
  return { key: raw, apiKey: { id, keyPrefix: prefix, label: opts.label || "default" } };
}

// ── Department budgets ─────────────────────────────────────────────────────────
function deptBudgetFromRow(r: Record<string, unknown>): BrandDepartmentBudget {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    departmentId: str(r.department_id),
    month: str(r.month),
    plannedAmount: num(r.planned_amount),
    actualAmount: num(r.actual_amount),
    currency: pick(r.currency, CURRENCY, "USD"),
  };
}

export async function fetchBrandDepartmentBudgets(
  brandId: string,
  month?: string,
): Promise<BrandDepartmentBudget[]> {
  let q = getSupabaseAdmin().from("brand_department_budgets").select("*").eq("brand_id", brandId);
  if (month) q = q.eq("month", month);
  const { data, error } = await q.order("month", { ascending: false });
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_department_budgets: ${error.message}`);
  }
  return (data ?? []).map((r) => deptBudgetFromRow(r as Record<string, unknown>));
}

export async function upsertBrandDepartmentBudget(
  b: BrandDepartmentBudget,
): Promise<BrandDepartmentBudget> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_department_budgets")
    .upsert(
      {
        id: b.id,
        brand_id: b.brandId,
        department_id: b.departmentId,
        month: b.month,
        planned_amount: b.plannedAmount,
        actual_amount: b.actualAmount,
        currency: b.currency,
      },
      { onConflict: "department_id,month" },
    )
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_department_budgets: ${error.message}`);
  if (!data) throw new Error("brand_department_budgets: upsert sonuç dönmedi.");
  return deptBudgetFromRow(data as Record<string, unknown>);
}

// ── Payment schedules ──────────────────────────────────────────────────────────
function paymentScheduleFromRow(r: Record<string, unknown>): BrandPaymentSchedule {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    dealId: r.deal_id ? str(r.deal_id) : undefined,
    dueDate: str(r.due_date).slice(0, 10),
    amountUsd: num(r.amount_usd),
    status: pick(r.status, ["scheduled", "paid", "cancelled"] as const, "scheduled"),
    notes: str(r.notes),
    createdAt: r.created_at ? str(r.created_at) : undefined,
  };
}

export async function fetchBrandPaymentSchedules(brandId: string): Promise<BrandPaymentSchedule[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_payment_schedules")
    .select("*")
    .eq("brand_id", brandId)
    .order("due_date", { ascending: true });
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_payment_schedules: ${error.message}`);
  }
  return (data ?? []).map((r) => paymentScheduleFromRow(r as Record<string, unknown>));
}

export async function upsertBrandPaymentSchedule(
  s: BrandPaymentSchedule,
): Promise<BrandPaymentSchedule> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_payment_schedules")
    .upsert(
      {
        id: s.id,
        brand_id: s.brandId,
        deal_id: s.dealId ?? null,
        due_date: s.dueDate,
        amount_usd: s.amountUsd,
        status: s.status,
        notes: s.notes,
      },
      { onConflict: "id" },
    )
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_payment_schedules: ${error.message}`);
  if (!data) throw new Error("brand_payment_schedules: upsert sonuç dönmedi.");
  return paymentScheduleFromRow(data as Record<string, unknown>);
}

// ── Notification rules ─────────────────────────────────────────────────────────
function notifRuleFromRow(r: Record<string, unknown>): BrandNotificationRule {
  const th = r.threshold;
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    eventType: str(r.event_type),
    channel: pick(r.channel, ["in_app", "email", "telegram"] as const, "in_app"),
    enabled: Boolean(r.enabled),
    threshold:
      th && typeof th === "object" && !Array.isArray(th)
        ? (th as Record<string, unknown>)
        : {},
  };
}

export async function fetchBrandNotificationRules(
  brandId: string,
): Promise<BrandNotificationRule[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_notification_rules")
    .select("*")
    .eq("brand_id", brandId)
    .order("event_type", { ascending: true });
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_notification_rules: ${error.message}`);
  }
  return (data ?? []).map((r) => notifRuleFromRow(r as Record<string, unknown>));
}

export async function upsertBrandNotificationRule(
  rule: BrandNotificationRule,
): Promise<BrandNotificationRule> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_notification_rules")
    .upsert(
      {
        id: rule.id,
        brand_id: rule.brandId,
        event_type: rule.eventType,
        channel: rule.channel,
        enabled: rule.enabled,
        threshold: rule.threshold,
      },
      { onConflict: "id" },
    )
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_notification_rules: ${error.message}`);
  if (!data) throw new Error("brand_notification_rules: upsert sonuç dönmedi.");
  return notifRuleFromRow(data as Record<string, unknown>);
}

export async function deleteBrandNotificationRule(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("brand_notification_rules").delete().eq("id", id);
  if (error) throw new Error(`brand_notification_rules: ${error.message}`);
}

// ── Onboarding progress ────────────────────────────────────────────────────────
export async function fetchBrandOnboardingProgress(
  brandId: string,
): Promise<BrandOnboardingProgress | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_onboarding_progress")
    .select("*")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) {
    if (missingTable(error)) return null;
    throw new Error(`brand_onboarding_progress: ${error.message}`);
  }
  if (!data) return null;
  const r = data as Record<string, unknown>;
  const steps = r.steps;
  return {
    brandId: str(r.brand_id),
    steps:
      steps && typeof steps === "object" && !Array.isArray(steps)
        ? (steps as Record<string, boolean | string>)
        : {},
    completedAt: r.completed_at ? str(r.completed_at) : undefined,
    updatedAt: r.updated_at ? str(r.updated_at) : undefined,
  };
}

export async function upsertBrandOnboardingProgress(
  p: BrandOnboardingProgress,
): Promise<BrandOnboardingProgress> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_onboarding_progress")
    .upsert(
      {
        brand_id: p.brandId,
        steps: p.steps,
        completed_at: p.completedAt ?? null,
      },
      { onConflict: "brand_id" },
    )
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_onboarding_progress: ${error.message}`);
  if (!data) throw new Error("brand_onboarding_progress: upsert sonuç dönmedi.");
  const r = data as Record<string, unknown>;
  return {
    brandId: str(r.brand_id),
    steps: (r.steps as Record<string, boolean | string>) ?? {},
    completedAt: r.completed_at ? str(r.completed_at) : undefined,
    updatedAt: r.updated_at ? str(r.updated_at) : undefined,
  };
}

// ── Payroll runs ───────────────────────────────────────────────────────────────
function payrollRunFromRow(r: Record<string, unknown>): BrandPayrollRun {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    month: str(r.month),
    status: pick(r.status, ["draft", "review", "approved", "paid"] as const, "draft"),
    approvedBy: r.approved_by ? str(r.approved_by) : undefined,
    approvedAt: r.approved_at ? str(r.approved_at) : undefined,
    notes: str(r.notes),
    createdAt: r.created_at ? str(r.created_at) : undefined,
    updatedAt: r.updated_at ? str(r.updated_at) : undefined,
  };
}

export async function fetchBrandPayrollRuns(
  brandId: string,
  month?: string,
): Promise<BrandPayrollRun[]> {
  let q = getSupabaseAdmin().from("brand_payroll_runs").select("*").eq("brand_id", brandId);
  if (month) q = q.eq("month", month);
  const { data, error } = await q.order("month", { ascending: false });
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_payroll_runs: ${error.message}`);
  }
  return (data ?? []).map((r) => payrollRunFromRow(r as Record<string, unknown>));
}

export async function upsertBrandPayrollRun(run: BrandPayrollRun): Promise<BrandPayrollRun> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_payroll_runs")
    .upsert(
      {
        id: run.id,
        brand_id: run.brandId,
        month: run.month,
        status: run.status,
        approved_by: run.approvedBy ?? null,
        approved_at: run.approvedAt ?? null,
        notes: run.notes,
      },
      { onConflict: "brand_id,month" },
    )
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_payroll_runs: ${error.message}`);
  if (!data) throw new Error("brand_payroll_runs: upsert sonuç dönmedi.");
  return payrollRunFromRow(data as Record<string, unknown>);
}

// ── Invoice lines ──────────────────────────────────────────────────────────────
function invoiceLineFromRow(r: Record<string, unknown>): BrandInvoiceLine {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    invoiceId: str(r.invoice_id),
    description: str(r.description),
    quantity: num(r.quantity),
    unitPrice: num(r.unit_price),
    refType: r.ref_type ? str(r.ref_type) : undefined,
    refId: r.ref_id ? str(r.ref_id) : undefined,
    sortOrder: Math.floor(num(r.sort_order)),
  };
}

export async function fetchBrandInvoiceLines(invoiceId: string): Promise<BrandInvoiceLine[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_invoice_lines")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: true });
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_invoice_lines: ${error.message}`);
  }
  return (data ?? []).map((r) => invoiceLineFromRow(r as Record<string, unknown>));
}

export async function upsertBrandInvoiceLine(line: BrandInvoiceLine): Promise<BrandInvoiceLine> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_invoice_lines")
    .upsert(
      {
        id: line.id,
        brand_id: line.brandId,
        invoice_id: line.invoiceId,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        ref_type: line.refType ?? null,
        ref_id: line.refId ?? null,
        sort_order: line.sortOrder,
      },
      { onConflict: "id" },
    )
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`brand_invoice_lines: ${error.message}`);
  if (!data) throw new Error("brand_invoice_lines: upsert sonuç dönmedi.");
  return invoiceLineFromRow(data as Record<string, unknown>);
}

// ── Offer templates ────────────────────────────────────────────────────────────
export async function fetchBrandOfferTemplates(brandId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_offer_templates")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`brand_offer_templates: ${error.message}`);
  }
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: str(row.id),
      brandId: str(row.brand_id),
      name: str(row.name),
      offerType: str(row.offer_type, "campaign"),
      commissionModel: row.commission_model ? str(row.commission_model) : undefined,
      defaultBudgetUsd: row.default_budget_usd != null ? num(row.default_budget_usd) : undefined,
      deliverables: Array.isArray(row.deliverables) ? row.deliverables : [],
      notes: str(row.notes),
    };
  });
}

// ── Brand iGaming profile fields ─────────────────────────────────────────────────
export async function fetchBrandIgamingProfile(brandId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("brands")
    .select("license_jurisdiction, restricted_geos, igaming_settings")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw new Error(`brands: ${error.message}`);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  const settings = r.igaming_settings;
  return {
    licenseJurisdiction: r.license_jurisdiction ? str(r.license_jurisdiction) : undefined,
    restrictedGeos: Array.isArray(r.restricted_geos) ? (r.restricted_geos as string[]) : [],
    igamingSettings:
      settings && typeof settings === "object" && !Array.isArray(settings)
        ? (settings as Record<string, unknown>)
        : {},
  };
}

export async function updateBrandIgamingProfile(
  brandId: string,
  patch: {
    licenseJurisdiction?: string;
    restrictedGeos?: string[];
    igamingSettings?: Record<string, unknown>;
  },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.licenseJurisdiction !== undefined) {
    update.license_jurisdiction = patch.licenseJurisdiction.trim() || null;
  }
  if (patch.restrictedGeos !== undefined) update.restricted_geos = patch.restrictedGeos;
  if (patch.igamingSettings !== undefined) update.igaming_settings = patch.igamingSettings;
  if (Object.keys(update).length === 0) return;
  const { error } = await getSupabaseAdmin().from("brands").update(update).eq("id", brandId);
  if (error) throw new Error(`brands: ${error.message}`);
}

// ── Deal milestones & tracking ───────────────────────────────────────────────
function milestoneFromRow(r: Record<string, unknown>): BrandDealMilestone {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    dealId: str(r.deal_id),
    dueDate: r.due_date ? str(r.due_date).slice(0, 10) : undefined,
    title: str(r.title),
    kpiType: r.kpi_type ? str(r.kpi_type) : undefined,
    kpiTarget: r.kpi_target != null ? num(r.kpi_target) : undefined,
    kpiActual: r.kpi_actual != null ? num(r.kpi_actual) : undefined,
    paymentAmount: r.payment_amount != null ? num(r.payment_amount) : undefined,
    status: pick(r.status, ["pending", "met", "missed", "paid"], "pending"),
  };
}

function trackingFromRow(r: Record<string, unknown>): BrandDealTrackingLink {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    dealId: str(r.deal_id),
    url: str(r.url),
    promoCode: r.promo_code ? str(r.promo_code) : undefined,
    utmSource: r.utm_source ? str(r.utm_source) : undefined,
    utmCampaign: r.utm_campaign ? str(r.utm_campaign) : undefined,
    externalRef: r.external_ref ? str(r.external_ref) : undefined,
    attributedFtd: num(r.attributed_ftd),
    attributedDeposit: num(r.attributed_deposit),
  };
}

export async function fetchBrandDealMilestones(
  brandId: string,
  dealId?: string
): Promise<BrandDealMilestone[]> {
  let q = getSupabaseAdmin()
    .from("brand_deal_milestones")
    .select("*")
    .eq("brand_id", brandId);
  if (dealId) q = q.eq("deal_id", dealId);
  const { data, error } = await q.order("due_date", { ascending: true });
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => milestoneFromRow(r as Record<string, unknown>));
}

export async function fetchBrandDealTrackingLinks(
  brandId: string,
  dealId?: string
): Promise<BrandDealTrackingLink[]> {
  let q = getSupabaseAdmin()
    .from("brand_deal_tracking_links")
    .select("*")
    .eq("brand_id", brandId);
  if (dealId) q = q.eq("deal_id", dealId);
  const { data, error } = await q;
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => trackingFromRow(r as Record<string, unknown>));
}

export async function fetchBrandTrackingDomains(
  brandId: string
): Promise<BrandTrackingDomain[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_tracking_domains")
    .select("*")
    .eq("brand_id", brandId);
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: str(row.id),
      brandId: str(row.brand_id),
      domain: str(row.domain),
      sslOk: Boolean(row.ssl_ok),
      lastCheckedAt: row.last_checked_at ? str(row.last_checked_at) : undefined,
      notes: str(row.notes),
    };
  });
}

export async function fetchBrandPostApprovals(
  brandId: string
): Promise<BrandPostApproval[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_post_approvals")
    .select("*")
    .eq("brand_id", brandId);
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: str(row.id),
      brandId: str(row.brand_id),
      postId: str(row.post_id),
      status: pick(row.status, ["pending", "approved", "rejected"], "pending"),
      reviewedBy: row.reviewed_by ? str(row.reviewed_by) : undefined,
      reviewedAt: row.reviewed_at ? str(row.reviewed_at) : undefined,
      notes: str(row.notes),
    };
  });
}

export async function fetchBrandContentViolations(
  brandId: string
): Promise<BrandContentViolation[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("brand_content_violations")
    .select("*")
    .eq("brand_id", brandId)
    .is("resolved_at", null);
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: str(row.id),
      brandId: str(row.brand_id),
      postId: row.post_id ? str(row.post_id) : undefined,
      violationType: str(row.violation_type),
      severity: pick(row.severity, ["info", "warn", "block"], "warn"),
      resolvedAt: row.resolved_at ? str(row.resolved_at) : undefined,
      notes: str(row.notes),
    };
  });
}
