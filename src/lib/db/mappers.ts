import type {
  Employee, Advance, SalaryExtra, MonthPaymentStatus, ExternalCompany,
  SponsorTransaction, InternalProject, InternalProjectPayment, ExpenseEntry,
  PlannedItem, PlannedItemPayment,
  StreamerAccount, ScheduleSlot, Brand, BrandLink, LinkSnapshot,
  BrandViewership, Kasa, KasaTransaction, ContentExpense, WeeklyPlan,
  WeekBrandReel, AppNotification,
} from "@/store/store";
import type { AppUser } from "@/store/auth";

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
  };
}

export function expenseEntryToRow(e: ExpenseEntry) {
  return { id: e.id, category: e.category, amount: e.amount, date: e.date, description: e.description };
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
  };
}

export function brandLinkToRow(l: BrandLink) {
  return {
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
    auto_track: l.autoTrack ?? null,
  };
}

export function linkSnapshotFromRow(r: Record<string, unknown>): LinkSnapshot {
  return {
    id: str(r.id),
    linkId: str(r.link_id),
    date: str(r.date).slice(0, 10),
    views: Number(r.views ?? 0),
    notes: str(r.notes),
  };
}

export function linkSnapshotToRow(s: LinkSnapshot) {
  return { id: s.id, link_id: s.linkId, date: s.date, views: s.views, notes: s.notes };
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
  };
}

export function contentExpenseFromRow(r: Record<string, unknown>): ContentExpense {
  return {
    id: str(r.id),
    date: str(r.date).slice(0, 10),
    month: str(r.month),
    employeeId: str(r.employee_id),
    brandId: r.brand_id ? str(r.brand_id) : undefined,
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
  };
}

export function contentExpenseToRow(e: ContentExpense) {
  return {
    id: e.id,
    date: e.date,
    month: e.month,
    employee_id: e.employeeId,
    brand_id: e.brandId ?? null,
    brand_name: e.brandName,
    category: e.category,
    description: e.description,
    amount_usd: e.amountUsd,
    amount_thb: e.amountThb ?? null,
    paid: e.paid,
    paid_date: e.paidDate ?? null,
    notes: e.notes,
    screenshot_url: e.screenshotUrl ?? null,
    submitted_at: e.submittedAt ?? null,
    submitted_by: e.submittedBy ?? null,
    review_status: e.reviewStatus ?? "pending",
    reviewed_at: e.reviewedAt ?? null,
    reviewed_by: e.reviewedBy ?? null,
    reviewer_note: e.reviewerNote ?? null,
    audited: e.audited ?? false,
  };
}

export function weeklyPlanFromRow(r: Record<string, unknown>): WeeklyPlan {
  return {
    id: str(r.id),
    employeeId: str(r.employee_id),
    weekStart: str(r.week_start).slice(0, 10),
    date: str(r.date).slice(0, 10),
    startTime: r.start_time ? str(r.start_time) : undefined,
    endTime: r.end_time ? str(r.end_time) : undefined,
    activity: str(r.activity),
    brandName: r.brand_name ? str(r.brand_name) : undefined,
    notes: str(r.notes),
    status: r.status as WeeklyPlan["status"],
    createdBy: r.created_by ? str(r.created_by) : undefined,
    createdAt: r.created_at ? str(r.created_at) : undefined,
  };
}

export function weeklyPlanToRow(p: WeeklyPlan) {
  return {
    id: p.id,
    employee_id: p.employeeId,
    week_start: p.weekStart,
    date: p.date,
    start_time: p.startTime ?? null,
    end_time: p.endTime ?? null,
    activity: p.activity,
    brand_name: p.brandName ?? null,
    notes: p.notes,
    status: p.status,
    created_by: p.createdBy ?? null,
    created_at: p.createdAt ?? new Date().toISOString(),
  };
}

export function weekBrandReelFromRow(r: Record<string, unknown>): WeekBrandReel {
  return {
    id: str(r.id),
    employeeId: str(r.employee_id),
    weekStart: str(r.week_start).slice(0, 10),
    brandId: str(r.brand_id),
    contentUrl: str(r.content_url),
    platform: str(r.platform),
    brandLinkId: r.brand_link_id ? str(r.brand_link_id) : undefined,
    notes: str(r.notes),
    createdAt: str(r.created_at),
  };
}

export function weekBrandReelToRow(r: WeekBrandReel) {
  return {
    id: r.id,
    employee_id: r.employeeId,
    week_start: r.weekStart,
    brand_id: r.brandId,
    content_url: r.contentUrl,
    platform: r.platform,
    brand_link_id: r.brandLinkId ?? null,
    notes: r.notes,
    created_at: r.createdAt,
  };
}

export function notificationFromRow(r: Record<string, unknown>): AppNotification {
  return {
    id: str(r.id),
    type: r.type as AppNotification["type"],
    title: str(r.title),
    message: str(r.message),
    forRole: r.for_role as AppNotification["forRole"],
    forUserId: r.for_user_id ? str(r.for_user_id) : undefined,
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
