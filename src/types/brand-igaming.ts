/** Marka iGaming program — DB/API tipleri */

export type BrandPlayerEventType =
  | "registration"
  | "ftd"
  | "deposit"
  | "withdrawal"
  | "chargeback"
  | "active_player";

export type IgamingCurrency = "USD" | "EUR" | "TRY";
export type PlayerEventType = BrandPlayerEventType;
export type PlayerEventChannel = "all" | "affiliate" | "organic" | "influencer";
export type PlayerEventSource = "manual" | "csv" | "api" | "webhook";

export type BrandIgamingTask = {
  id: string;
  brandId: string;
  title: string;
  description: string;
  assigneeUserId?: string;
  staffId?: string;
  dueDate?: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  campaignId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type BrandCalendarEvent = {
  id: string;
  brandId: string;
  eventDate: string;
  title: string;
  eventType: "campaign" | "compliance" | "launch" | "payout" | "content" | "other";
  refId?: string;
  notes: string;
  createdAt?: string;
};

export type BrandAuditLogEntry = {
  id: string;
  brandId: string;
  actorId?: string;
  actorName?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  detail: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type IgamingDashboardSummary = {
  brandId: string;
  month: string;
  monthly: {
    newRegistrations: number;
    ftd: number;
    depositAmount: number;
    withdrawalAmount: number;
    ggr: number;
    ngr: number;
    commissionTotal: number;
    activePlayers: number;
  };
  targets: {
    targetFtd: number;
    targetNgr: number;
    targetRegistrations: number;
    targetDepositAmount: number;
  };
  affiliate: {
    clicks: number;
    registrations: number;
    ftdCount: number;
    depositAmount: number;
    commissionDue: number;
  };
};

export type BrandOfferTemplate = {
  id: string;
  brandId: string;
  name: string;
  offerType: string;
  commissionModel?: string;
  defaultBudgetUsd?: number;
  deliverables: unknown[];
  notes: string;
};

export type BrandDealMilestone = {
  id: string;
  brandId: string;
  dealId: string;
  dueDate?: string;
  title: string;
  kpiType?: string;
  kpiTarget?: number;
  kpiActual?: number;
  paymentAmount?: number;
  status: "pending" | "met" | "missed" | "paid";
};

export type BrandDealTrackingLink = {
  id: string;
  brandId: string;
  dealId: string;
  url: string;
  promoCode?: string;
  utmSource?: string;
  utmCampaign?: string;
  externalRef?: string;
  attributedFtd: number;
  attributedDeposit: number;
};

export type BrandTrackingDomain = {
  id: string;
  brandId: string;
  domain: string;
  sslOk: boolean;
  lastCheckedAt?: string;
  notes: string;
};

export type BrandPostApproval = {
  id: string;
  brandId: string;
  postId: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
  notes: string;
};

export type BrandContentViolation = {
  id: string;
  brandId: string;
  postId?: string;
  violationType: string;
  severity: "info" | "warn" | "block";
  resolvedAt?: string;
  notes: string;
};

export type BrandPlayerEvent = {
  id: string;
  brandId: string;
  eventDate: string;
  eventType: BrandPlayerEventType;
  channel: "all" | "affiliate" | "organic" | "influencer";
  countryCode?: string;
  eventCount: number;
  amount: number;
  currency: "USD" | "EUR" | "TRY";
  importBatchId?: string;
  source: "manual" | "csv" | "api" | "webhook";
  createdAt?: string;
  updatedAt?: string;
};

export type BrandKpiTarget = {
  id: string;
  brandId: string;
  month: string;
  targetFtd: number;
  targetRegistrations: number;
  targetDepositAmount: number;
  targetNgr: number;
  targetContentDeliveries: number;
  targetAffiliateRoi?: number;
  notes: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type BrandCampaign = {
  id: string;
  brandId: string;
  name: string;
  campaignType: "bonus" | "tournament" | "landing" | "promo" | "affiliate";
  promoCode?: string;
  startDate?: string;
  endDate?: string;
  rules: Record<string, unknown>;
  status: "draft" | "active" | "paused" | "ended";
  budgetUsd?: number;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
};

export type BrandComplianceCheck = {
  id: string;
  brandId: string;
  checkType: "kyc" | "geo_restrict" | "responsible_gaming" | "ad_disclosure" | "license" | "other";
  status: "pending" | "passed" | "failed" | "waived";
  dueDate?: string;
  completedAt?: string;
  evidenceUrl?: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
};

export type BrandDepartmentBudget = {
  id: string;
  brandId: string;
  departmentId: string;
  month: string;
  plannedAmount: number;
  actualAmount: number;
  currency: "USD" | "EUR" | "TRY";
};

export type BrandTask = BrandIgamingTask;

export type BrandPaymentSchedule = {
  id: string;
  brandId: string;
  dealId?: string;
  dueDate: string;
  amountUsd: number;
  status: "scheduled" | "paid" | "cancelled";
  notes: string;
  createdAt?: string;
};

export type BrandNotificationRule = {
  id: string;
  brandId: string;
  eventType: string;
  channel: "in_app" | "email" | "telegram";
  enabled: boolean;
  threshold: Record<string, unknown>;
};

export type BrandOnboardingProgress = {
  brandId: string;
  steps: Record<string, boolean | string>;
  completedAt?: string;
  updatedAt?: string;
};

export type BrandApiKey = {
  id: string;
  brandId: string;
  operatorId?: string;
  label: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt?: string;
  revokedAt?: string;
};

export type BrandWebhookLog = {
  id: string;
  brandId: string;
  operatorId?: string;
  eventType: string;
  statusCode?: number;
  payload?: Record<string, unknown>;
  error?: string;
  createdAt: string;
};

export type BrandImportBatch = {
  id: string;
  brandId: string;
  source: string;
  status: "processing" | "done" | "failed";
  rowsTotal: number;
  rowsImported: number;
  errorMessage?: string;
  createdAt: string;
  finishedAt?: string;
};

export type BrandPayrollRun = {
  id: string;
  brandId: string;
  month: string;
  status: "draft" | "review" | "approved" | "paid";
  approvedBy?: string;
  approvedAt?: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
};

export type BrandInvoiceLine = {
  id: string;
  brandId: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  refType?: string;
  refId?: string;
  sortOrder: number;
};

export type BrandIgamingSettings = {
  timezone?: string;
  defaultCurrency?: string;
  fiscalYearStart?: string;
  [key: string]: unknown;
};

export type BrandIgamingProfile = {
  licenseJurisdiction?: string;
  restrictedGeos: string[];
  igamingSettings: BrandIgamingSettings;
};

export type BrandIgamingDashboard = {
  month: string;
  ftd: number;
  registrations: number;
  depositAmount: number;
  withdrawalAmount: number;
  ngr: number;
  ggr: number;
  commission: number;
  activePlayers: number;
  targetFtd: number;
  targetNgr: number;
  affiliateClicks: number;
  affiliateRegistrations: number;
  affiliateFtd: number;
  pendingOffers: number;
  openCompliance: number;
  contentBudgetUsd: number;
  attributedFtd: number;
};

export const CAMPAIGN_TYPE_LABELS: Record<BrandCampaign["campaignType"], string> = {
  bonus: "Bonus",
  tournament: "Turnuva",
  landing: "Landing",
  promo: "Promo kod",
  affiliate: "Affiliate",
};

export const CAMPAIGN_STATUS_LABELS: Record<BrandCampaign["status"], string> = {
  draft: "Taslak",
  active: "Aktif",
  paused: "Duraklatıldı",
  ended: "Sona erdi",
};

export const COMPLIANCE_TYPE_LABELS: Record<BrandComplianceCheck["checkType"], string> = {
  kyc: "KYC",
  geo_restrict: "Geo kısıt",
  responsible_gaming: "Sorumlu oyun",
  ad_disclosure: "Reklam bildirimi",
  license: "Lisans",
  other: "Diğer",
};

export const COMPLIANCE_STATUS_LABELS: Record<BrandComplianceCheck["status"], string> = {
  pending: "Bekliyor",
  passed: "Geçti",
  failed: "Başarısız",
  waived: "Muaf",
};

export const BRAND_MILESTONE_STATUS_LABELS: Record<BrandDealMilestone["status"], string> = {
  pending: "Bekliyor",
  met: "Karşılandı",
  missed: "Kaçırıldı",
  paid: "Ödendi",
};

export const BRAND_CALENDAR_EVENT_LABELS: Record<BrandCalendarEvent["eventType"], string> = {
  campaign: "Kampanya",
  compliance: "Uyumluluk",
  launch: "Lansman",
  payout: "Ödeme",
  content: "İçerik",
  other: "Diğer",
};

export const IGAMING_TAG_LABELS: Record<string, string> = {
  casino: "Casino",
  slots: "Slot",
  sports: "Spor bahis",
  poker: "Poker",
  live_casino: "Canlı casino",
  responsible: "Sorumlu oyun",
};

export const BRAND_TASK_STATUS_LABELS: Record<BrandTask["status"], string> = {
  open: "Açık",
  in_progress: "Devam ediyor",
  done: "Tamamlandı",
  cancelled: "İptal",
};

export const BRAND_TASK_PRIORITY_LABELS: Record<BrandTask["priority"], string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

/** @deprecated brand-personnel ile uyum — takip sayfası */
export const TASK_STATUS_LABELS = BRAND_TASK_STATUS_LABELS;
/** @deprecated brand-personnel ile uyum — takip sayfası */
export const TASK_PRIORITY_LABELS = BRAND_TASK_PRIORITY_LABELS;

export const BRAND_POST_APPROVAL_LABELS: Record<BrandPostApproval["status"], string> = {
  pending: "Bekliyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

export const PAYMENT_SCHEDULE_STATUS_LABELS: Record<BrandPaymentSchedule["status"], string> = {
  scheduled: "Planlandı",
  paid: "Ödendi",
  cancelled: "İptal",
};

export const PAYROLL_RUN_STATUS_LABELS: Record<BrandPayrollRun["status"], string> = {
  draft: "Taslak",
  review: "İncelemede",
  approved: "Onaylandı",
  paid: "Ödendi",
};

export const NOTIFICATION_EVENT_TYPES = [
  { value: "ftd_below_target", label: "FTD hedef altı" },
  { value: "compliance_breach", label: "Uyumluluk ihlali" },
  { value: "payout_ready", label: "Ödeme hazır" },
  { value: "campaign_launch", label: "Kampanya lansmanı" },
  { value: "deal_deliverable_late", label: "Teslimat gecikmesi" },
] as const;

export const ONBOARDING_STEPS = [
  { key: "license_info", label: "Lisans bilgisi", href: "/marka/profil" },
  { key: "operator_api", label: "Operatör API", href: "/marka/entegrasyon" },
  { key: "kpi_import", label: "İlk KPI import", href: "/marka/operasyon" },
  { key: "first_affiliate", label: "İlk affiliate", href: "/marka/affiliate" },
  { key: "first_offer", label: "İlk teklif", href: "/marka/teklifler" },
] as const;

/** Executive KPI kartları için özet + önceki ay karşılaştırması. */
export type ExecutiveKpiSnapshot = {
  ftd: number;
  activePlayers: number;
  depositAmount: number;
  withdrawalAmount: number;
  ngr: number;
  commission: number;
};

export type AffiliateTier = {
  id: string;
  brandId: string;
  name: string;
  minFtd: number;
  commissionPct: number;
  carryover: boolean;
  orderIndex: number;
};

export type AffiliateQualityScore = {
  partnerId: string;
  score: number;
  source: "operator" | "computed";
  updatedAt?: string;
};

export type BrandRiskFlag = {
  id: string;
  brandId: string;
  flagType: "deposit_spike" | "withdrawal_spike" | "duplicate_device" | "incentive_abuse" | "other";
  severity: "low" | "medium" | "high";
  detectedAt: string;
  resolvedAt?: string;
  notes: string;
};

export const DEFAULT_AFFILIATE_TIERS: Omit<AffiliateTier, "id" | "brandId">[] = [
  { name: "Bronz", minFtd: 0, commissionPct: 25, carryover: false, orderIndex: 0 },
  { name: "Gümüş", minFtd: 50, commissionPct: 30, carryover: true, orderIndex: 1 },
  { name: "Altın", minFtd: 200, commissionPct: 35, carryover: true, orderIndex: 2 },
  { name: "Platin", minFtd: 500, commissionPct: 40, carryover: true, orderIndex: 3 },
];
