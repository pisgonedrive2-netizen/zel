import type {
  Employee, Advance, SalaryExtra, MonthPaymentStatus, ExternalCompany,
  SponsorTransaction, InternalProject, InternalProjectPayment, ExpenseEntry,
  PlannedItem, PlannedItemPayment,
  StreamerAccount, ScheduleSlot, Brand, BrandLink, LinkSnapshot,
  BrandViewership, BrandMonthlyStats, Kasa, KasaTransaction, ContentExpense, WeeklyPlan,
  WeekBrandReel, AppNotification, BrandRegistrationRequest,
  StreamerRegistrationRequest,
  Organization, OrganizationMember,
  AffiliatePartner, AffiliateDailyStat, AffiliatePayout,
  StreamerPoolProfile, BrandOffer, BrandOfferDeliverable, BrandOfferMessage,
  BrandDeal, BrandDealDeliverable, BrandPost,
} from "@/store/store";
import type { AppUser } from "@/store/auth";
import { pgDate, pgTime, pgTimestamptz } from "@/lib/db/pg-value";
import { normalizeWeekAnchorIso, weekStartFromDateIso } from "@/lib/data";

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const optNum = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));
const str = (v: unknown, fallback = "") => (v == null ? fallback : String(v));
const bool = (v: unknown, fallback = false) => (v == null ? fallback : Boolean(v));

export function employeeFromRow(r: Record<string, unknown>): Employee {
  return {
    id: str(r.id),
    name: str(r.name),
    role: str(r.role),
    department: str(r.department),
    baseSalary: num(r.base_salary),
    rentSupport: num(r.rent_support),
    initialAdvance: num(r.initial_advance),
    paymentDay: str(r.payment_day, "1-5"),
    payrollStartMonth: str(r.payroll_start_month),
    startDate: str(r.start_date).slice(0, 10),
    status: r.status as Employee["status"],
    walletAddress: str(r.wallet_address),
    avatar: str(r.avatar),
    notes: str(r.notes),
    kind: r.kind as Employee["kind"],
  };
}

export function employeeToRow(e: Employee) {
  return {
    id: e.id,
    name: e.name,
    role: e.role,
    department: e.department,
    base_salary: e.baseSalary,
    rent_support: e.rentSupport,
    initial_advance: e.initialAdvance,
    payment_day: e.paymentDay,
    payroll_start_month: e.payrollStartMonth,
    start_date: e.startDate,
    status: e.status,
    wallet_address: e.walletAddress,
    avatar: e.avatar,
    notes: e.notes,
    kind: e.kind,
  };
}

export function advanceFromRow(r: Record<string, unknown>): Advance {
  return {
    id: str(r.id),
    employeeId: str(r.employee_id),
    month: str(r.month),
    amount: num(r.amount),
    date: str(r.date).slice(0, 10),
    description: str(r.description),
  };
}

export function advanceToRow(a: Advance) {
  return {
    id: a.id,
    employee_id: a.employeeId,
    month: a.month,
    amount: a.amount,
    date: a.date,
    description: a.description,
  };
}

export function salaryExtraFromRow(r: Record<string, unknown>): SalaryExtra {
  return {
    id: str(r.id),
    employeeId: str(r.employee_id),
    month: str(r.month),
    amount: num(r.amount),
    description: str(r.description),
    type: r.type as SalaryExtra["type"],
    contentExpenseId: r.content_expense_id ? str(r.content_expense_id) : undefined,
  };
}

export function salaryExtraToRow(e: SalaryExtra) {
  return {
    id: e.id,
    employee_id: e.employeeId,
    month: e.month,
    amount: e.amount,
    description: e.description,
    type: e.type,
    content_expense_id: e.contentExpenseId ?? null,
  };
}

export function paymentStatusFromRow(r: Record<string, unknown>): MonthPaymentStatus {
  return {
    employeeId: str(r.employee_id),
    month: str(r.month),
    paid: bool(r.paid),
    paidDate: r.paid_date ? str(r.paid_date).slice(0, 10) : undefined,
    paidBy: r.paid_by ? str(r.paid_by) : undefined,
    approvedAt: r.approved_at ? str(r.approved_at) : undefined,
    kasaTxId: r.kasa_tx_id ? str(r.kasa_tx_id) : undefined,
  };
}

export function paymentStatusToRow(p: MonthPaymentStatus) {
  return {
    employee_id: p.employeeId,
    month: p.month,
    paid: p.paid,
    paid_date: p.paidDate ?? null,
    paid_by: p.paidBy ?? null,
    approved_at: p.approvedAt ?? null,
    kasa_tx_id: p.kasaTxId ?? null,
  };
}

export function companyFromRow(r: Record<string, unknown>): ExternalCompany {
  return {
    id: str(r.id),
    name: str(r.name),
    category: str(r.category),
    monthlyAmount: num(r.monthly_amount),
    contactPerson: str(r.contact_person),
    status: r.status as ExternalCompany["status"],
    startDate: str(r.start_date).slice(0, 10),
    notes: str(r.notes),
    monthlyBreakdown: Array.isArray(r.monthly_breakdown)
      ? (r.monthly_breakdown as number[])
      : undefined,
  };
}

export function companyToRow(c: ExternalCompany) {
  return {
    id: c.id,
    name: c.name,
    category: c.category,
    monthly_amount: c.monthlyAmount,
    contact_person: c.contactPerson,
    status: c.status,
    start_date: c.startDate,
    notes: c.notes,
    monthly_breakdown: c.monthlyBreakdown ?? null,
  };
}

export function sponsorTxFromRow(r: Record<string, unknown>): SponsorTransaction {
  return {
    id: str(r.id),
    date: str(r.date).slice(0, 10),
    companyName: str(r.company_name),
    service: str(r.service),
    amount: num(r.amount),
    status: r.status as SponsorTransaction["status"],
    txid: str(r.txid),
  };
}

export function sponsorTxToRow(t: SponsorTransaction) {
  return {
    id: t.id,
    date: t.date,
    company_name: t.companyName,
    service: t.service,
    amount: t.amount,
    status: t.status,
    txid: t.txid,
  };
}

export function projectFromRow(r: Record<string, unknown>): InternalProject {
  const rawIds = r.employee_ids;
  const employeeIds = Array.isArray(rawIds)
    ? (rawIds as unknown[]).map((x) => String(x)).filter(Boolean)
    : [];
  return {
    id: str(r.id),
    name: str(r.name),
    category: str(r.category),
    monthlyRevenue: num(r.monthly_revenue),
    progress: Number(r.progress ?? 0),
    status: r.status as InternalProject["status"],
    startDate: str(r.start_date).slice(0, 10),
    notes: str(r.notes),
    brandId: r.brand_id ? str(r.brand_id) : undefined,
    employeeIds,
    paymentDay: str(r.payment_day ?? ""),
    reminderEnabled: r.reminder_enabled !== false,
    reminderDaysBefore: Number(r.reminder_days_before ?? 3),
    lastReminderSentAt: r.last_reminder_sent_at ? str(r.last_reminder_sent_at) : undefined,
  };
}

export function projectToRow(p: InternalProject) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    monthly_revenue: p.monthlyRevenue,
    progress: p.progress,
    status: p.status,
    start_date: p.startDate,
    notes: p.notes,
    brand_id: p.brandId ?? null,
    employee_ids: p.employeeIds ?? [],
    payment_day: p.paymentDay ?? "",
    reminder_enabled: p.reminderEnabled ?? true,
    reminder_days_before: p.reminderDaysBefore ?? 3,
    last_reminder_sent_at: p.lastReminderSentAt ?? null,
  };
}

export function projectPaymentFromRow(r: Record<string, unknown>): InternalProjectPayment {
  return {
    id: str(r.id),
    projectId: str(r.project_id),
    month: str(r.month),
    dueDate: r.due_date ? str(r.due_date).slice(0, 10) : undefined,
    amount: num(r.amount),
    status: str(r.status) as InternalProjectPayment["status"],
    paidDate: r.paid_date ? str(r.paid_date).slice(0, 10) : undefined,
    notes: str(r.notes),
  };
}

export function projectPaymentToRow(p: InternalProjectPayment) {
  return {
    id: p.id,
    project_id: p.projectId,
    month: p.month,
    due_date: p.dueDate ?? null,
    amount: p.amount,
    status: p.status,
    paid_date: p.paidDate ?? null,
    notes: p.notes,
  };
}

export function expenseEntryFromRow(r: Record<string, unknown>): ExpenseEntry {
  return {
    id: str(r.id),
    category: str(r.category),
    amount: num(r.amount),
    date: str(r.date).slice(0, 10),
    description: str(r.description),
    kasaTxId: r.kasa_tx_id ? str(r.kasa_tx_id) : undefined,
    brandId: r.brand_id ? str(r.brand_id) : undefined,
    plannedItemId: r.planned_item_id ? str(r.planned_item_id) : undefined,
  };
}

export function expenseEntryToRow(e: ExpenseEntry) {
  return {
    id: e.id,
    category: e.category,
    amount: e.amount,
    date: e.date,
    description: e.description,
    kasa_tx_id: e.kasaTxId ?? null,
    brand_id: e.brandId ?? null,
    planned_item_id: e.plannedItemId ?? null,
  };
}

export function plannedFromRow(r: Record<string, unknown>): PlannedItem {
  const cat = str(r.category, "other");
  const rec = str(r.recurrence, "none");
  return {
    id: str(r.id),
    name: str(r.name),
    category: (["capex", "opex", "revenue", "growth", "other"].includes(cat)
      ? cat
      : "other") as PlannedItem["category"],
    budget: num(r.budget),
    spent: num(r.spent),
    startDate: r.start_date ? str(r.start_date).slice(0, 10) : "",
    targetDate: r.target_date ? str(r.target_date).slice(0, 10) : "",
    priority: r.priority as PlannedItem["priority"],
    status: r.status as PlannedItem["status"],
    notes: str(r.notes),
    employeeId: r.employee_id ? str(r.employee_id) : undefined,
    brandId: r.brand_id ? str(r.brand_id) : undefined,
    internalProjectId: r.internal_project_id ? str(r.internal_project_id) : undefined,
    isRecurring: r.is_recurring === true,
    recurrence: (["none", "monthly", "quarterly", "yearly"].includes(rec)
      ? rec
      : "none") as PlannedItem["recurrence"],
    expenseEntryId: r.expense_entry_id ? str(r.expense_entry_id) : undefined,
    kasaTxId: r.kasa_tx_id ? str(r.kasa_tx_id) : undefined,
  };
}

export function plannedToRow(p: PlannedItem) {
  return {
    id: p.id,
    name: p.name,
    category: p.category ?? "other",
    budget: p.budget,
    spent: p.spent ?? 0,
    start_date: p.startDate || null,
    target_date: p.targetDate || null,
    priority: p.priority,
    status: p.status,
    notes: p.notes,
    employee_id: p.employeeId ?? null,
    brand_id: p.brandId ?? null,
    internal_project_id: p.internalProjectId ?? null,
    is_recurring: p.isRecurring ?? false,
    recurrence: p.recurrence ?? "none",
    expense_entry_id: p.expenseEntryId ?? null,
    kasa_tx_id: p.kasaTxId ?? null,
  };
}

export function plannedPaymentFromRow(r: Record<string, unknown>): PlannedItemPayment {
  return {
    id: str(r.id),
    plannedItemId: str(r.planned_item_id),
    month: str(r.month),
    dueDate: r.due_date ? str(r.due_date).slice(0, 10) : undefined,
    amount: num(r.amount),
    status: str(r.status) as PlannedItemPayment["status"],
    paidDate: r.paid_date ? str(r.paid_date).slice(0, 10) : undefined,
    notes: str(r.notes),
  };
}

export function plannedPaymentToRow(p: PlannedItemPayment) {
  return {
    id: p.id,
    planned_item_id: p.plannedItemId,
    month: p.month,
    due_date: p.dueDate ?? null,
    amount: p.amount,
    status: p.status,
    paid_date: p.paidDate ?? null,
    notes: p.notes,
  };
}

export function streamerAccountFromRow(r: Record<string, unknown>): StreamerAccount {
  return {
    id: str(r.id),
    employeeId: str(r.employee_id),
    platform: str(r.platform),
    handle: str(r.handle),
    url: str(r.url),
    notes: str(r.notes),
    status: r.status as StreamerAccount["status"],
  };
}

export function streamerAccountToRow(a: StreamerAccount) {
  return {
    id: a.id,
    employee_id: a.employeeId,
    platform: a.platform,
    handle: a.handle,
    url: a.url,
    notes: a.notes,
    status: a.status,
  };
}

export function scheduleSlotFromRow(r: Record<string, unknown>): ScheduleSlot {
  return {
    id: str(r.id),
    employeeId: str(r.employee_id),
    dayOfWeek: Number(r.day_of_week),
    startTime: str(r.start_time),
    endTime: str(r.end_time),
    platform: str(r.platform),
    notes: str(r.notes),
  };
}

export function scheduleSlotToRow(s: ScheduleSlot) {
  return {
    id: s.id,
    employee_id: s.employeeId,
    day_of_week: s.dayOfWeek,
    start_time: s.startTime,
    end_time: s.endTime,
    platform: s.platform,
    notes: s.notes,
  };
}

export function brandFromRow(r: Record<string, unknown>): Brand {
  return {
    id: str(r.id),
    name: str(r.name),
    shortName: str(r.short_name),
    category: str(r.category),
    status: r.status as Brand["status"],
    notes: str(r.notes),
    monthlyTarget: r.monthly_target != null ? Number(r.monthly_target) : undefined,
    organizationId: r.organization_id ? str(r.organization_id) : undefined,
  };
}

export function brandToRow(b: Brand) {
  return {
    id: b.id,
    name: b.name,
    short_name: b.shortName,
    category: b.category,
    status: b.status,
    notes: b.notes,
    monthly_target: b.monthlyTarget ?? null,
    organization_id: b.organizationId ?? null,
  };
}

export function organizationFromRow(r: Record<string, unknown>): Organization {
  return {
    id: str(r.id),
    name: str(r.name),
    slug: str(r.slug),
    type: r.type as Organization["type"],
    status: r.status as Organization["status"],
    plan: r.plan as Organization["plan"],
    logoUrl: r.logo_url ? str(r.logo_url) : undefined,
    primaryColor: str(r.primary_color, "#FF6B00"),
    locale: str(r.locale, "tr"),
    timezone: str(r.timezone, "Europe/Istanbul"),
    defaultCurrency: (r.default_currency as Organization["defaultCurrency"]) ?? "USD",
    contactName: r.contact_name ? str(r.contact_name) : undefined,
    contactEmail: r.contact_email ? str(r.contact_email) : undefined,
    onboardingCompleted: bool(r.onboarding_completed),
    createdFromRequestId: r.created_from_request_id ? str(r.created_from_request_id) : undefined,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function organizationToRow(o: Organization) {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    type: o.type,
    status: o.status,
    plan: o.plan,
    logo_url: o.logoUrl ?? null,
    primary_color: o.primaryColor,
    locale: o.locale,
    timezone: o.timezone,
    default_currency: o.defaultCurrency,
    contact_name: o.contactName ?? null,
    contact_email: o.contactEmail ?? null,
    onboarding_completed: o.onboardingCompleted,
    created_from_request_id: o.createdFromRequestId ?? null,
  };
}

/**
 * Üye satırı + opsiyonel brandIds. brandIds ayrı tablodan (organization_member_brands)
 * doldurulur; repository fetch sırasında map'lenir.
 */
export function organizationMemberFromRow(
  r: Record<string, unknown>,
  brandIds?: string[]
): OrganizationMember {
  return {
    id: str(r.id),
    organizationId: str(r.organization_id),
    userId: str(r.user_id),
    orgRole: r.org_role as OrganizationMember["orgRole"],
    scopeAllBrands: bool(r.scope_all_brands, true),
    title: str(r.title),
    brandIds: brandIds ?? undefined,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function organizationMemberToRow(m: OrganizationMember) {
  return {
    id: m.id,
    organization_id: m.organizationId,
    user_id: m.userId,
    org_role: m.orgRole,
    scope_all_brands: m.scopeAllBrands,
    title: m.title,
  };
}

export function brandLinkFromRow(r: Record<string, unknown>): BrandLink {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    platform: str(r.platform),
    handle: str(r.handle),
    url: str(r.url),
    ownerId: r.owner_id ? str(r.owner_id) : undefined,
    status: r.status as BrandLink["status"],
    notes: str(r.notes),
    lastSnapshotDate: r.last_snapshot_date ? str(r.last_snapshot_date).slice(0, 10) : undefined,
    lastViews: r.last_views != null ? Number(r.last_views) : undefined,
    autoTrack: r.auto_track != null ? bool(r.auto_track) : undefined,
    externalRef: r.external_ref ? str(r.external_ref) : undefined,
    lastCheckedAt: r.last_checked_at ? str(r.last_checked_at) : undefined,
    lastLikes: r.last_likes != null ? Number(r.last_likes) : undefined,
    lastComments: r.last_comments != null ? Number(r.last_comments) : undefined,
    lastShares: r.last_shares != null ? Number(r.last_shares) : undefined,
    lastCheckError: r.last_check_error ? str(r.last_check_error) : undefined,
    checkCount: r.check_count != null ? Number(r.check_count) : undefined,
    errorCount: r.error_count != null ? Number(r.error_count) : undefined,
    refreshCountTotal: r.refresh_count_total != null ? Number(r.refresh_count_total) : undefined,
    lastRefreshStatus: r.last_refresh_status ? str(r.last_refresh_status) as BrandLink["lastRefreshStatus"] : undefined,
    createdAt: r.created_at ? str(r.created_at) : undefined,
  };
}

export function brandLinkToRow(l: BrandLink) {
  const row: Record<string, unknown> = {
    id: l.id,
    brand_id: l.brandId,
    platform: l.platform,
    handle: l.handle,
    url: l.url,
    owner_id: l.ownerId ?? null,
    status: l.status,
    notes: l.notes,
    last_snapshot_date: l.lastSnapshotDate ?? null,
    last_views: l.lastViews ?? null,
    auto_track: l.autoTrack ?? true,
    // Auto-refresh alanlarını client kayıt yaparken NULL göndermek için
    // diğer kolonları açıkça `undefined` bırakıyoruz — bunlar sunucu tarafı
    // (refresh runner) tarafından yönetilir. Eğer bir admin elle düzenlediyse
    // mevcut değerleri korumak için update payload'a eklemiyoruz.
  };
  // Sadece client tarafından üretildiyse `created_at`'i yaz; DB default kolon
  // yine de devreye girer (mevcut kayıtlarda mevcut değer korunur).
  if (l.createdAt) row.created_at = l.createdAt;
  return row;
}

export function linkSnapshotFromRow(r: Record<string, unknown>): LinkSnapshot {
  return {
    id: str(r.id),
    linkId: str(r.link_id),
    date: str(r.date).slice(0, 10),
    views: Number(r.views ?? 0),
    notes: str(r.notes),
    likes: r.likes != null ? Number(r.likes) : undefined,
    comments: r.comments != null ? Number(r.comments) : undefined,
    shares: r.shares != null ? Number(r.shares) : undefined,
    refreshedAt: r.refreshed_at ? str(r.refreshed_at) : undefined,
  };
}

export function linkSnapshotToRow(s: LinkSnapshot) {
  return {
    id: s.id,
    link_id: s.linkId,
    date: s.date,
    views: s.views,
    notes: s.notes,
    likes: s.likes ?? null,
    comments: s.comments ?? null,
    shares: s.shares ?? null,
    refreshed_at: s.refreshedAt ?? null,
  };
}

export function viewershipFromRow(r: Record<string, unknown>): BrandViewership {
  return {
    id: str(r.id),
    brandName: str(r.brand_name),
    employeeId: r.employee_id ? str(r.employee_id) : undefined,
    brandId: r.brand_id ? str(r.brand_id) : undefined,
    companyId: r.company_id ? str(r.company_id) : undefined,
    month: str(r.month),
    views: Number(r.views ?? 0),
    url: str(r.url),
    notes: str(r.notes),
  };
}

export function viewershipToRow(v: BrandViewership) {
  return {
    id: v.id,
    brand_name: v.brandName,
    employee_id: v.employeeId ?? null,
    brand_id: v.brandId ?? null,
    company_id: v.companyId ?? null,
    month: v.month,
    views: v.views,
    url: v.url,
    notes: v.notes,
  };
}

export function brandMonthlyStatsFromRow(r: Record<string, unknown>): BrandMonthlyStats {
  const cur = str(r.currency, "USD");
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    month: str(r.month),
    newRegistrations: Number(r.new_registrations ?? 0),
    depositingMembers: Number(r.depositing_members ?? 0),
    firstTimeDepositors: Number(r.first_time_depositors ?? 0),
    depositCount: Number(r.deposit_count ?? 0),
    depositAmount: num(r.deposit_amount),
    withdrawalAmount: num(r.withdrawal_amount),
    currency: cur === "TRY" || cur === "EUR" ? cur : "USD",
    liveDemoAllocated: num(r.live_demo_allocated),
    liveDemoRemaining: num(r.live_demo_remaining),
    liveDemoNotes: str(r.live_demo_notes),
    notes: str(r.notes),
    updatedBy: r.updated_by ? str(r.updated_by) : undefined,
    updatedAt: r.updated_at ? str(r.updated_at) : undefined,
  };
}

export function brandMonthlyStatsToRow(s: BrandMonthlyStats) {
  return {
    id: s.id,
    brand_id: s.brandId,
    month: s.month,
    new_registrations: s.newRegistrations,
    depositing_members: s.depositingMembers,
    first_time_depositors: s.firstTimeDepositors,
    deposit_count: s.depositCount,
    deposit_amount: s.depositAmount,
    withdrawal_amount: s.withdrawalAmount,
    currency: s.currency,
    live_demo_allocated: s.liveDemoAllocated ?? 0,
    live_demo_remaining: s.liveDemoRemaining ?? 0,
    live_demo_notes: s.liveDemoNotes ?? "",
    notes: s.notes,
    updated_by: s.updatedBy ?? null,
  };
}

export function kasaAccountFromRow(r: Record<string, unknown>): Kasa {
  const kind = str(r.kind, "general");
  const allowed: Kasa["kind"][] = ["general", "usdt", "bank", "cash", "other"];
  return {
    id: str(r.id),
    name: str(r.name),
    kind: (allowed.includes(kind as Kasa["kind"]) ? kind : "general") as Kasa["kind"],
    currency: str(r.currency, "USD"),
    isDefault: bool(r.is_default),
    archived: bool(r.archived),
    orderIndex: Number(r.order_index ?? 0),
    notes: str(r.notes),
    tronAddress: r.tron_address ? str(r.tron_address) : undefined,
    tronSyncFrom: r.tron_sync_from ? str(r.tron_sync_from).slice(0, 10) : undefined,
  };
}

export function kasaAccountToRow(k: Kasa) {
  return {
    id: k.id,
    name: k.name,
    kind: k.kind,
    currency: k.currency,
    is_default: k.isDefault,
    archived: k.archived,
    order_index: k.orderIndex,
    notes: k.notes,
    tron_address: k.tronAddress ?? null,
    tron_sync_from: k.tronSyncFrom ?? null,
  };
}

export function kasaFromRow(r: Record<string, unknown>): KasaTransaction {
  return {
    id: str(r.id),
    kasaId: str(r.kasa_id, "kasa-genel"),
    date: str(r.date),
    direction: r.direction as KasaTransaction["direction"],
    amountUsd: num(r.amount_usd),
    feeUsd: num(r.fee_usd),
    purpose: str(r.purpose),
    counterparty: str(r.counterparty),
    proof: str(r.proof),
    notes: str(r.notes),
    plannedItemId: r.planned_item_id ? str(r.planned_item_id) : undefined,
    tronTxId: r.tron_tx_id ? str(r.tron_tx_id) : undefined,
    autoImported: bool(r.auto_imported),
    countInGenel: bool(r.count_in_genel),
  };
}

export function kasaToRow(t: KasaTransaction) {
  return {
    id: t.id,
    kasa_id: t.kasaId,
    date: t.date,
    direction: t.direction,
    amount_usd: t.amountUsd,
    fee_usd: t.feeUsd,
    purpose: t.purpose,
    counterparty: t.counterparty,
    proof: t.proof,
    notes: t.notes,
    planned_item_id: t.plannedItemId ?? null,
    tron_tx_id: t.tronTxId ?? null,
    auto_imported: t.autoImported ?? false,
    count_in_genel: t.countInGenel ?? false,
  };
}

export function contentExpenseFromRow(r: Record<string, unknown>): ContentExpense {
  return {
    id: str(r.id),
    date: str(r.date).slice(0, 10),
    month: str(r.month),
    employeeId: str(r.employee_id),
    brandId: r.brand_id ? str(r.brand_id) : undefined,
    brandIds: Array.isArray(r.brand_ids)
      ? (r.brand_ids as unknown[]).map((x) => str(x)).filter(Boolean)
      : undefined,
    brandName: str(r.brand_name),
    category: str(r.category),
    description: str(r.description),
    amountUsd: num(r.amount_usd),
    amountThb: optNum(r.amount_thb),
    paid: bool(r.paid),
    paidDate: r.paid_date ? str(r.paid_date).slice(0, 10) : undefined,
    notes: str(r.notes),
    screenshotUrl: r.screenshot_url ? str(r.screenshot_url) : undefined,
    submittedAt: r.submitted_at ? str(r.submitted_at) : undefined,
    submittedBy: r.submitted_by ? str(r.submitted_by) : undefined,
    reviewStatus: r.review_status as ContentExpense["reviewStatus"],
    reviewedAt: r.reviewed_at ? str(r.reviewed_at) : undefined,
    reviewedBy: r.reviewed_by ? str(r.reviewed_by) : undefined,
    reviewerNote: r.reviewer_note ? str(r.reviewer_note) : undefined,
    audited: bool(r.audited),
    kasaTxId: r.kasa_tx_id ? str(r.kasa_tx_id) : undefined,
    settlementMode: r.settlement_mode as ContentExpense["settlementMode"],
    salaryExtraId: r.salary_extra_id ? str(r.salary_extra_id) : undefined,
    reviewThread: Array.isArray(r.review_thread)
      ? (r.review_thread as ContentExpense["reviewThread"])
      : undefined,
  };
}

export function contentExpenseToRow(e: ContentExpense) {
  const date =
    pgDate(e.date, e.month ? `${e.month}-01` : null) ??
    (e.month?.length >= 7 ? `${e.month.slice(0, 7)}-01` : null) ??
    "1970-01-01";
  return {
    id: e.id,
    date,
    month: e.month,
    employee_id: e.employeeId,
    brand_id: e.brandId ?? null,
    brand_ids: e.brandIds?.length ? e.brandIds : null,
    brand_name: e.brandName,
    category: e.category,
    description: e.description,
    amount_usd: e.amountUsd,
    amount_thb: e.amountThb ?? null,
    paid: e.paid,
    paid_date: pgDate(e.paidDate),
    notes: e.notes,
    screenshot_url: e.screenshotUrl ?? null,
    submitted_at: e.submittedAt ?? null,
    submitted_by: e.submittedBy ?? null,
    review_status: e.reviewStatus ?? "pending",
    reviewed_at: e.reviewedAt ?? null,
    reviewed_by: e.reviewedBy ?? null,
    reviewer_note: e.reviewerNote ?? null,
    audited: e.audited ?? false,
    kasa_tx_id: e.kasaTxId ?? null,
    settlement_mode: e.settlementMode ?? null,
    salary_extra_id: e.salaryExtraId ?? null,
    review_thread: e.reviewThread ?? [],
  };
}

export function weeklyPlanFromRow(r: Record<string, unknown>): WeeklyPlan {
  const date = str(r.date).slice(0, 10);
  const weekStartDb = str(r.week_start).slice(0, 10);
  const weekStart = weekStartFromDateIso(date) || normalizeWeekAnchorIso(weekStartDb);
  return {
    id: str(r.id),
    employeeId: str(r.employee_id),
    weekStart,
    date,
    startTime: r.start_time ? str(r.start_time) : undefined,
    endTime: r.end_time ? str(r.end_time) : undefined,
    activity: str(r.activity),
    brandName: r.brand_name ? str(r.brand_name) : undefined,
    notes: str(r.notes),
    status: r.status as WeeklyPlan["status"],
    streamerAccountId: r.streamer_account_id ? str(r.streamer_account_id) : undefined,
    createdBy: r.created_by ? str(r.created_by) : undefined,
    createdAt: r.created_at ? str(r.created_at) : undefined,
  };
}

export function weeklyPlanToRow(p: WeeklyPlan) {
  const date =
    pgDate(p.date, p.weekStart) ?? pgDate(p.weekStart) ?? new Date().toISOString().slice(0, 10);
  const weekStart = pgDate(p.weekStart, date) ?? date;
  const row: Record<string, unknown> = {
    id: p.id,
    employee_id: p.employeeId,
    week_start: weekStart,
    date,
    start_time: pgTime(p.startTime),
    end_time: pgTime(p.endTime),
    activity: p.activity,
    brand_name: p.brandName ?? null,
    notes: p.notes,
    status: p.status,
    streamer_account_id: p.streamerAccountId ?? null,
    created_by: p.createdBy ?? null,
  };
  // Mevcut bir created_at varsa koru; yoksa sunucu DEFAULT now() kullansın.
  if (p.createdAt) row.created_at = p.createdAt;
  return row;
}

export function weekBrandReelFromRow(r: Record<string, unknown>): WeekBrandReel {
  return {
    id: str(r.id),
    employeeId: str(r.employee_id),
    weekStart: str(r.week_start).slice(0, 10),
    brandId: str(r.brand_id),
    contentUrl: str(r.content_url),
    platform: str(r.platform),
    contentType: r.content_type ? str(r.content_type) : undefined,
    brandLinkId: r.brand_link_id ? str(r.brand_link_id) : undefined,
    streamerAccountId: r.streamer_account_id ? str(r.streamer_account_id) : undefined,
    publishedAt: r.published_at ? str(r.published_at) : undefined,
    notes: str(r.notes),
    createdAt: str(r.created_at),
    externalRef: r.external_ref ? str(r.external_ref) : undefined,
    lastViews: r.last_views != null ? Number(r.last_views) : undefined,
    lastLikes: r.last_likes != null ? Number(r.last_likes) : undefined,
    lastComments: r.last_comments != null ? Number(r.last_comments) : undefined,
    lastShares: r.last_shares != null ? Number(r.last_shares) : undefined,
    lastCheckedAt: r.last_checked_at ? str(r.last_checked_at) : undefined,
    lastCheckError: r.last_check_error ? str(r.last_check_error) : undefined,
    checkCount: r.check_count != null ? Number(r.check_count) : undefined,
  };
}

export function weekBrandReelToRow(r: WeekBrandReel) {
  const weekStart = pgDate(r.weekStart) ?? r.weekStart;
  const row: Record<string, unknown> = {
    id: r.id,
    employee_id: r.employeeId,
    week_start: weekStart,
    // "Diğer" (markaya bağlı olmayan) içerikte brandId boş olabilir → NULL yaz.
    brand_id: r.brandId ? r.brandId : null,
    content_url: r.contentUrl,
    platform: r.platform,
    content_type: r.contentType ?? null,
    brand_link_id: r.brandLinkId ?? null,
    streamer_account_id: r.streamerAccountId ?? null,
    published_at: pgTimestamptz(r.publishedAt),
    notes: r.notes,
    created_at: r.createdAt,
  };
  // İzlenme metriği client state'inde varsa koru (yoksa kolonu yazma — böylece
  // sunucu refresh'inin yazdığı değerler client toplu-kaydında NULL'a ezilmez).
  if (r.lastViews != null) row.last_views = r.lastViews;
  return row;
}

export function notificationFromRow(r: Record<string, unknown>): AppNotification {
  return {
    id: str(r.id),
    type: r.type as AppNotification["type"],
    title: str(r.title),
    message: str(r.message),
    forRole: r.for_role as AppNotification["forRole"],
    forUserId: r.for_user_id ? str(r.for_user_id) : undefined,
    forBrandId: r.for_brand_id ? str(r.for_brand_id) : undefined,
    refId: r.ref_id ? str(r.ref_id) : undefined,
    triggeredBy: r.triggered_by ? str(r.triggered_by) : undefined,
    createdAt: str(r.created_at),
    read: bool(r.read),
    href: r.href ? str(r.href) : undefined,
  };
}

export function notificationToRow(n: AppNotification) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    for_role: n.forRole,
    for_user_id: n.forUserId ?? null,
    for_brand_id: n.forBrandId ?? null,
    ref_id: n.refId ?? null,
    triggered_by: n.triggeredBy ?? null,
    created_at: n.createdAt,
    read: n.read,
    href: n.href ?? null,
  };
}

export function appUserFromRow(r: Record<string, unknown>): AppUser {
  return {
    id: str(r.id),
    username: str(r.username),
    pin: "",
    name: str(r.name),
    role: r.role as AppUser["role"],
    employeeId: r.employee_id ? str(r.employee_id) : undefined,
    brandId: r.brand_id ? str(r.brand_id) : undefined,
    avatar: str(r.avatar),
    active: bool(r.active, true),
    lastLoginAt: r.last_login_at ? str(r.last_login_at) : undefined,
  };
}

export function brandRegistrationRequestFromRow(
  r: Record<string, unknown>
): BrandRegistrationRequest {
  const status = str(r.status, "pending");
  const allowed: BrandRegistrationRequest["status"][] = [
    "pending",
    "approved",
    "rejected",
    "duplicate",
  ];
  return {
    id: str(r.id),
    brandName: str(r.brand_name),
    shortName: r.short_name ? str(r.short_name) : undefined,
    category: str(r.category, "Bahis"),
    website: r.website ? str(r.website) : undefined,
    contactName: str(r.contact_name),
    contactEmail: str(r.contact_email),
    contactPhone: r.contact_phone ? str(r.contact_phone) : undefined,
    telegram: r.telegram ? str(r.telegram) : undefined,
    monthlyVolume: r.monthly_volume ? str(r.monthly_volume) : undefined,
    preferredUsername: r.preferred_username ? str(r.preferred_username) : undefined,
    notes: str(r.notes),
    status: (allowed.includes(status as BrandRegistrationRequest["status"])
      ? status
      : "pending") as BrandRegistrationRequest["status"],
    rejectionReason: r.rejection_reason ? str(r.rejection_reason) : undefined,
    reviewedBy: r.reviewed_by ? str(r.reviewed_by) : undefined,
    reviewedAt: r.reviewed_at ? str(r.reviewed_at) : undefined,
    createdBrandId: r.created_brand_id ? str(r.created_brand_id) : undefined,
    createdUserId: r.created_user_id ? str(r.created_user_id) : undefined,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function brandRegistrationRequestToRow(r: BrandRegistrationRequest) {
  return {
    id: r.id,
    brand_name: r.brandName,
    short_name: r.shortName ?? null,
    category: r.category,
    website: r.website ?? null,
    contact_name: r.contactName,
    contact_email: r.contactEmail.toLowerCase().trim(),
    contact_phone: r.contactPhone ?? null,
    telegram: r.telegram ?? null,
    monthly_volume: r.monthlyVolume ?? null,
    preferred_username: r.preferredUsername ?? null,
    notes: r.notes,
    status: r.status,
    rejection_reason: r.rejectionReason ?? null,
    reviewed_by: r.reviewedBy ?? null,
    reviewed_at: r.reviewedAt ?? null,
    created_brand_id: r.createdBrandId ?? null,
    created_user_id: r.createdUserId ?? null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export function streamerRegistrationRequestFromRow(
  r: Record<string, unknown>
): StreamerRegistrationRequest {
  const status = str(r.status, "pending");
  const allowed: StreamerRegistrationRequest["status"][] = [
    "pending",
    "approved",
    "rejected",
    "duplicate",
  ];
  return {
    id: str(r.id),
    displayName: str(r.display_name),
    realName: r.real_name ? str(r.real_name) : undefined,
    contactEmail: str(r.contact_email),
    contactPhone: r.contact_phone ? str(r.contact_phone) : undefined,
    telegram: r.telegram ? str(r.telegram) : undefined,
    platforms: str(r.platforms),
    categories: str(r.categories),
    audienceSize: r.audience_size ? str(r.audience_size) : undefined,
    preferredUsername: r.preferred_username ? str(r.preferred_username) : undefined,
    notes: str(r.notes),
    status: (allowed.includes(status as StreamerRegistrationRequest["status"])
      ? status
      : "pending") as StreamerRegistrationRequest["status"],
    rejectionReason: r.rejection_reason ? str(r.rejection_reason) : undefined,
    reviewedBy: r.reviewed_by ? str(r.reviewed_by) : undefined,
    reviewedAt: r.reviewed_at ? str(r.reviewed_at) : undefined,
    createdEmployeeId: r.created_employee_id ? str(r.created_employee_id) : undefined,
    createdUserId: r.created_user_id ? str(r.created_user_id) : undefined,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function streamerRegistrationRequestToRow(r: StreamerRegistrationRequest) {
  return {
    id: r.id,
    display_name: r.displayName,
    real_name: r.realName ?? null,
    contact_email: r.contactEmail.toLowerCase().trim(),
    contact_phone: r.contactPhone ?? null,
    telegram: r.telegram ?? null,
    platforms: r.platforms,
    categories: r.categories,
    audience_size: r.audienceSize ?? null,
    preferred_username: r.preferredUsername ?? null,
    notes: r.notes,
    status: r.status,
    rejection_reason: r.rejectionReason ?? null,
    reviewed_by: r.reviewedBy ?? null,
    reviewed_at: r.reviewedAt ?? null,
    created_employee_id: r.createdEmployeeId ?? null,
    created_user_id: r.createdUserId ?? null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export function appUserToRow(u: AppUser, pinHash: string) {
  return {
    id: u.id,
    username: u.username.toLowerCase().trim(),
    pin_hash: pinHash,
    name: u.name,
    role: u.role,
    employee_id: u.employeeId ?? null,
    brand_id: u.brandId ?? null,
    avatar: u.avatar,
    active: u.active,
    last_login_at: u.lastLoginAt ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Affiliate Tracking (Faz C)
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_AFFILIATE_CURRENCIES: AffiliatePartner["currency"][] = ["USD", "EUR", "TRY"];
const ALLOWED_PARTNER_TYPES: AffiliatePartner["partnerType"][] = [
  "streamer",
  "external",
  "agency",
  "social",
];
const ALLOWED_COMMISSION_MODELS: AffiliatePartner["commissionModel"][] = [
  "cpa",
  "revshare",
  "hybrid",
  "flat",
];
const ALLOWED_PARTNER_STATUS: AffiliatePartner["status"][] = ["active", "paused", "closed"];
const ALLOWED_STAT_SOURCES: AffiliateDailyStat["source"][] = ["manual", "csv", "api", "webhook"];
const ALLOWED_PAYOUT_STATUS: AffiliatePayout["status"][] = [
  "pending",
  "approved",
  "paid",
  "cancelled",
];

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const s = String(value ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

export function affiliatePartnerFromRow(r: Record<string, unknown>): AffiliatePartner {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    name: str(r.name),
    externalRef: r.external_ref ? str(r.external_ref) : undefined,
    partnerType: pickEnum(r.partner_type, ALLOWED_PARTNER_TYPES, "streamer"),
    commissionModel: pickEnum(r.commission_model, ALLOWED_COMMISSION_MODELS, "cpa"),
    cpaAmount: num(r.cpa_amount),
    revsharePct: num(r.revshare_pct),
    currency: pickEnum(r.currency, ALLOWED_AFFILIATE_CURRENCIES, "USD"),
    status: pickEnum(r.status, ALLOWED_PARTNER_STATUS, "active"),
    employeeId: r.employee_id ? str(r.employee_id) : undefined,
    contact: r.contact ? str(r.contact) : undefined,
    notes: str(r.notes),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function affiliatePartnerToRow(p: AffiliatePartner) {
  return {
    id: p.id,
    brand_id: p.brandId,
    name: p.name,
    external_ref: p.externalRef ?? null,
    partner_type: p.partnerType,
    commission_model: p.commissionModel,
    cpa_amount: p.cpaAmount,
    revshare_pct: p.revsharePct,
    currency: p.currency,
    status: p.status,
    employee_id: p.employeeId ?? null,
    contact: p.contact ?? null,
    notes: p.notes,
  };
}

export function affiliateDailyStatFromRow(r: Record<string, unknown>): AffiliateDailyStat {
  return {
    id: str(r.id),
    partnerId: str(r.partner_id),
    brandId: str(r.brand_id),
    statDate: str(r.stat_date).slice(0, 10),
    clicks: Number(r.clicks ?? 0),
    registrations: Number(r.registrations ?? 0),
    ftdCount: Number(r.ftd_count ?? 0),
    ftdAmount: num(r.ftd_amount),
    depositAmount: num(r.deposit_amount),
    withdrawalAmount: num(r.withdrawal_amount),
    netRevenue: num(r.net_revenue),
    commissionDue: num(r.commission_due),
    currency: pickEnum(r.currency, ALLOWED_AFFILIATE_CURRENCIES, "USD"),
    source: pickEnum(r.source, ALLOWED_STAT_SOURCES, "manual"),
    importedAt: r.imported_at ? str(r.imported_at) : undefined,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function affiliateDailyStatToRow(s: AffiliateDailyStat) {
  return {
    id: s.id,
    partner_id: s.partnerId,
    brand_id: s.brandId,
    stat_date: s.statDate,
    clicks: Math.max(0, Math.floor(s.clicks || 0)),
    registrations: Math.max(0, Math.floor(s.registrations || 0)),
    ftd_count: Math.max(0, Math.floor(s.ftdCount || 0)),
    ftd_amount: s.ftdAmount ?? 0,
    deposit_amount: s.depositAmount ?? 0,
    withdrawal_amount: s.withdrawalAmount ?? 0,
    net_revenue: s.netRevenue ?? 0,
    commission_due: s.commissionDue ?? 0,
    currency: s.currency,
    source: s.source,
    imported_at: s.importedAt ?? null,
  };
}

export function affiliatePayoutFromRow(r: Record<string, unknown>): AffiliatePayout {
  return {
    id: str(r.id),
    partnerId: str(r.partner_id),
    brandId: str(r.brand_id),
    periodStart: str(r.period_start).slice(0, 10),
    periodEnd: str(r.period_end).slice(0, 10),
    amount: num(r.amount),
    currency: pickEnum(r.currency, ALLOWED_AFFILIATE_CURRENCIES, "USD"),
    status: pickEnum(r.status, ALLOWED_PAYOUT_STATUS, "pending"),
    paidDate: r.paid_date ? str(r.paid_date).slice(0, 10) : undefined,
    notes: str(r.notes),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function affiliatePayoutToRow(p: AffiliatePayout) {
  return {
    id: p.id,
    partner_id: p.partnerId,
    brand_id: p.brandId,
    period_start: p.periodStart,
    period_end: p.periodEnd,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    paid_date: p.paidDate ?? null,
    notes: p.notes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Yayıncı havuzu + teklif (Faz G)
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_POOL_STATUS: StreamerPoolProfile["status"][] = [
  "draft",
  "published",
  "paused",
  "closed",
];
const ALLOWED_POOL_VISIBILITY: StreamerPoolProfile["visibility"][] = [
  "public",
  "brand_only",
  "invite_only",
];
const ALLOWED_OFFER_INITIATOR: BrandOffer["initiator"][] = ["brand", "streamer"];
const ALLOWED_OFFER_TYPE: BrandOffer["offerType"][] = [
  "campaign",
  "single_post",
  "long_term",
  "affiliate",
];
const ALLOWED_OFFER_STATUS: BrandOffer["status"][] = [
  "pending",
  "negotiating",
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
];
const ALLOWED_MESSAGE_ROLE: BrandOfferMessage["authorRole"][] = ["brand", "streamer", "admin"];

function toStringArray(v: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(v)) return fallback;
  return (v as unknown[]).map((x) => String(x)).filter(Boolean);
}

function parseOfferDeliverables(v: unknown): BrandOfferDeliverable[] {
  if (!Array.isArray(v)) return [];
  const out: BrandOfferDeliverable[] = [];
  for (const raw of v as unknown[]) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const type = String(r.type ?? "").trim();
    const count = Math.max(0, Math.floor(Number(r.count) || 0));
    if (!type) continue;
    out.push({
      type,
      count,
      platform: r.platform ? String(r.platform) : undefined,
      notes: r.notes ? String(r.notes) : undefined,
    });
  }
  return out;
}

function parseDealDeliverables(v: unknown): BrandDealDeliverable[] {
  if (!Array.isArray(v)) return [];
  const out: BrandDealDeliverable[] = [];
  for (const raw of v as unknown[]) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const type = String(r.type ?? "").trim();
    const count = Math.max(0, Math.floor(Number(r.count) || 0));
    if (!type) continue;
    out.push({
      type,
      count,
      platform: r.platform ? String(r.platform) : undefined,
    });
  }
  return out;
}

export function streamerPoolProfileFromRow(r: Record<string, unknown>): StreamerPoolProfile {
  return {
    id: str(r.id),
    employeeId: str(r.employee_id),
    displayName: str(r.display_name),
    headline: str(r.headline),
    bio: str(r.bio),
    categories: toStringArray(r.categories),
    languages: toStringArray(r.languages, ["tr"]),
    countries: toStringArray(r.countries, ["TR"]),
    rateMinUsd: r.rate_min_usd == null ? undefined : Number(r.rate_min_usd),
    rateMaxUsd: r.rate_max_usd == null ? undefined : Number(r.rate_max_usd),
    rateCurrency: str(r.rate_currency, "USD"),
    followersTotal: Number(r.followers_total ?? 0),
    avgViews: Number(r.avg_views ?? 0),
    avatarUrl: r.avatar_url ? str(r.avatar_url) : undefined,
    coverUrl: r.cover_url ? str(r.cover_url) : undefined,
    status: pickEnum(r.status, ALLOWED_POOL_STATUS, "draft"),
    visibility: pickEnum(r.visibility, ALLOWED_POOL_VISIBILITY, "public"),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function streamerPoolProfileToRow(p: StreamerPoolProfile) {
  return {
    id: p.id,
    employee_id: p.employeeId,
    display_name: p.displayName,
    headline: p.headline,
    bio: p.bio,
    categories: p.categories ?? [],
    languages: p.languages?.length ? p.languages : ["tr"],
    countries: p.countries?.length ? p.countries : ["TR"],
    rate_min_usd: p.rateMinUsd ?? null,
    rate_max_usd: p.rateMaxUsd ?? null,
    rate_currency: p.rateCurrency || "USD",
    followers_total: Math.max(0, Math.floor(p.followersTotal || 0)),
    avg_views: Math.max(0, Math.floor(p.avgViews || 0)),
    avatar_url: p.avatarUrl ?? null,
    cover_url: p.coverUrl ?? null,
    status: p.status,
    visibility: p.visibility,
  };
}

export function brandOfferFromRow(r: Record<string, unknown>): BrandOffer {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    employeeId: str(r.employee_id),
    initiator: pickEnum(r.initiator, ALLOWED_OFFER_INITIATOR, "brand"),
    title: str(r.title),
    description: str(r.description),
    offerType: pickEnum(r.offer_type, ALLOWED_OFFER_TYPE, "campaign"),
    budgetUsd: r.budget_usd == null ? undefined : Number(r.budget_usd),
    status: pickEnum(r.status, ALLOWED_OFFER_STATUS, "pending"),
    deliverables: parseOfferDeliverables(r.deliverables),
    startDate: r.start_date ? str(r.start_date).slice(0, 10) : undefined,
    endDate: r.end_date ? str(r.end_date).slice(0, 10) : undefined,
    notes: str(r.notes),
    expiresAt: r.expires_at ? str(r.expires_at) : undefined,
    createdBy: r.created_by ? str(r.created_by) : undefined,
    respondedBy: r.responded_by ? str(r.responded_by) : undefined,
    respondedAt: r.responded_at ? str(r.responded_at) : undefined,
    createdDealId: r.created_deal_id ? str(r.created_deal_id) : undefined,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function brandOfferToRow(o: BrandOffer) {
  return {
    id: o.id,
    brand_id: o.brandId,
    employee_id: o.employeeId,
    initiator: o.initiator,
    title: o.title,
    description: o.description,
    offer_type: o.offerType,
    budget_usd: o.budgetUsd ?? null,
    status: o.status,
    deliverables: o.deliverables ?? [],
    start_date: o.startDate ?? null,
    end_date: o.endDate ?? null,
    notes: o.notes ?? "",
    expires_at: o.expiresAt ?? null,
    created_by: o.createdBy ?? null,
    responded_by: o.respondedBy ?? null,
    responded_at: o.respondedAt ?? null,
    created_deal_id: o.createdDealId ?? null,
  };
}

export function brandOfferMessageFromRow(r: Record<string, unknown>): BrandOfferMessage {
  return {
    id: str(r.id),
    offerId: str(r.offer_id),
    authorId: str(r.author_id),
    authorRole: pickEnum(r.author_role, ALLOWED_MESSAGE_ROLE, "admin"),
    body: str(r.body),
    counterBudgetUsd:
      r.counter_budget_usd == null ? undefined : Number(r.counter_budget_usd),
    createdAt: str(r.created_at),
  };
}

export function brandOfferMessageToRow(m: BrandOfferMessage) {
  return {
    id: m.id,
    offer_id: m.offerId,
    author_id: m.authorId,
    author_role: m.authorRole,
    body: m.body,
    counter_budget_usd: m.counterBudgetUsd ?? null,
    created_at: m.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Anlaşma + post takibi (Faz H)
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_DEAL_TYPE: BrandDeal["dealType"][] = [
  "campaign",
  "single_post",
  "long_term",
  "affiliate",
];
const ALLOWED_DEAL_STATUS: BrandDeal["status"][] = [
  "active",
  "completed",
  "cancelled",
  "disputed",
];
const ALLOWED_POST_PLATFORM: BrandPost["platform"][] = [
  "instagram",
  "tiktok",
  "youtube",
  "kick",
  "twitter",
  "telegram",
  "other",
];
const ALLOWED_POST_TYPE: BrandPost["postType"][] = [
  "post",
  "reel",
  "story",
  "vlog",
  "stream",
  "vod",
  "tweet",
  "other",
];
const ALLOWED_POST_STATUS: BrandPost["status"][] = ["draft", "live", "removed", "expired"];

export function brandDealFromRow(r: Record<string, unknown>): BrandDeal {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    employeeId: str(r.employee_id),
    originOfferId: r.origin_offer_id ? str(r.origin_offer_id) : undefined,
    title: str(r.title),
    dealType: pickEnum(r.deal_type, ALLOWED_DEAL_TYPE, "campaign"),
    status: pickEnum(r.status, ALLOWED_DEAL_STATUS, "active"),
    budgetUsd: num(r.budget_usd),
    paidUsd: num(r.paid_usd),
    startDate: r.start_date ? str(r.start_date).slice(0, 10) : undefined,
    endDate: r.end_date ? str(r.end_date).slice(0, 10) : undefined,
    deliverables: parseDealDeliverables(r.deliverables),
    postsCount: Number(r.posts_count ?? 0),
    totalViews: Number(r.total_views ?? 0),
    notes: str(r.notes),
    contractUrl: r.contract_url ? str(r.contract_url) : undefined,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function brandDealToRow(d: BrandDeal) {
  return {
    id: d.id,
    brand_id: d.brandId,
    employee_id: d.employeeId,
    origin_offer_id: d.originOfferId ?? null,
    title: d.title,
    deal_type: d.dealType,
    status: d.status,
    budget_usd: d.budgetUsd ?? 0,
    paid_usd: d.paidUsd ?? 0,
    start_date: d.startDate ?? null,
    end_date: d.endDate ?? null,
    deliverables: d.deliverables ?? [],
    notes: d.notes ?? "",
    contract_url: d.contractUrl ?? null,
  };
}

export function brandPostFromRow(r: Record<string, unknown>): BrandPost {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    employeeId: r.employee_id ? str(r.employee_id) : undefined,
    dealId: r.deal_id ? str(r.deal_id) : undefined,
    platform: pickEnum(r.platform, ALLOWED_POST_PLATFORM, "other"),
    postType: pickEnum(r.post_type, ALLOWED_POST_TYPE, "post"),
    url: str(r.url),
    caption: str(r.caption),
    postedAt: r.posted_at ? str(r.posted_at) : undefined,
    screenshotUrl: r.screenshot_url ? str(r.screenshot_url) : undefined,
    views: Number(r.views ?? 0),
    likes: Number(r.likes ?? 0),
    comments: Number(r.comments ?? 0),
    status: pickEnum(r.status, ALLOWED_POST_STATUS, "live"),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

export function brandPostToRow(p: BrandPost) {
  return {
    id: p.id,
    brand_id: p.brandId,
    employee_id: p.employeeId ?? null,
    deal_id: p.dealId ?? null,
    platform: p.platform,
    post_type: p.postType,
    url: p.url,
    caption: p.caption ?? "",
    posted_at: p.postedAt ?? null,
    screenshot_url: p.screenshotUrl ?? null,
    views: Math.max(0, Math.floor(p.views || 0)),
    likes: Math.max(0, Math.floor(p.likes || 0)),
    comments: Math.max(0, Math.floor(p.comments || 0)),
    status: p.status,
  };
}
