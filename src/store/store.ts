import { create, type StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import { requestSyncFlush } from "@/lib/sync-client";
import {
  persistKasaTransaction,
  removeKasaAccount,
  removeKasaTransaction,
  bulkUpdateKasaCountInGenel,
} from "@/lib/kasa-persist";
import {
  persistRowImmediate,
  removeRowImmediate,
  type PersistEntity,
} from "@/lib/row-persist";
import { dedupeSalaryExtrasByContentExpense } from "@/lib/salary-extra-dedupe";
import { persistContentExpenseSettlement } from "@/lib/content-expense-settlement-persist";
import { findDuplicateBrandLink } from "@/lib/brand-link-url";
import {
  mergeBrandViewershipHydrate,
  mergeCanonicalBrandLinks,
  mergeLinkSnapshotsHydrate,
} from "@/lib/merge-viewership-hydrate";
import {
  isoToLocalDateOnly,
  localNoonTimestampIso,
  normalizeWeekAnchorIso,
  shiftCalendarMonthYm,
  weekStartFromDateIso,
} from "@/lib/data";
import { normalizeWeeklyPlanInput } from "@/lib/weekly-plan-normalize";
import {
  buildPayrollLinePlan,
  buildPayrollPaymentLines,
  isPayrollFullyPaid,
  markAllLinesPaid,
  removeLinePaidRecord,
  sumPaidPayrollLines,
  upsertLinePaidRecord,
  type PayrollLinePaidRecord,
} from "@/lib/payroll-lines";

/** Tam sync yedek — debounce öncesi anında satır API'si tercih edilir. */
const flushAppData = () => queueMicrotask(() => requestSyncFlush());
const flushKasaData = () => queueMicrotask(() => requestSyncFlush());

const asRow = <T extends { id: string }>(r: T): Record<string, unknown> =>
  r as unknown as Record<string, unknown>;

function persistEntity(entity: PersistEntity, row: { id: string }) {
  if (!isSupabaseClientMode()) return;
  persistRowImmediate(entity, asRow(row));
}

function removeEntity(entity: PersistEntity, id: string) {
  if (!isSupabaseClientMode()) return;
  removeRowImmediate(entity, id);
}

function persistKasaTxImmediate(tx: KasaTransaction) {
  if (!isSupabaseClientMode()) return;
  queueMicrotask(() => void persistKasaTransaction(tx));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipler
// ─────────────────────────────────────────────────────────────────────────────

export type EmployeeKind = "streamer" | "coordinator" | "moderator" | "other";

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  /** Aylık ücret (USD). Koordinatör için 0 kalabilir. */
  baseSalary: number;
  /** Aylık ev kira desteği (USD). 0 = yok. */
  rentSupport: number;
  /** Başlangıç anındaki açık avans bakiyesi (USD). */
  initialAdvance: number;
  /** Ödeme aralığı / günü etiketi: "1-5" gibi normal cycle veya "17" gibi sabit gün. */
  paymentDay: string;
  /** Maaş döngüsünün başladığı ilk ay (ISO YYYY-MM). Bu aydan önce maaş hesaplanmaz. */
  payrollStartMonth: string;
  startDate: string;
  status: "active" | "inactive";
  walletAddress: string;
  avatar: string;
  notes: string;
  kind: EmployeeKind;
}

export interface Advance {
  id: string;
  employeeId: string;
  month: string;
  amount: number;
  date: string;
  description: string;
}

export interface SalaryExtra {
  id: string;
  employeeId: string;
  month: string;
  amount: number;
  description: string;
  type: "bonus" | "expense" | "deduction" | "rent" | "other";
  /** İçerik harcamasından otomatik oluşturulduysa kaynak id. */
  contentExpenseId?: string;
}

export interface MonthPaymentStatus {
  employeeId: string;
  month: string;
  paid: boolean;
  paidDate?: string;
  paidBy?: string;
  approvedAt?: string;
  /** Bu maaş ödemesini temsil eden kasa hareketinin id'si (varsa). */
  kasaTxId?: string;
  /** Kalem bazlı ödemeler (temel maaş, kira, prim vb.). */
  linePayments?: import("@/lib/payroll-lines").PayrollLinePaidRecord[];
}

export interface ExternalCompany {
  id: string;
  name: string;
  category: string;
  monthlyAmount: number;
  contactPerson: string;
  status: "active" | "inactive" | "ended";
  startDate: string;
  notes: string;
  /** Aylık tutar dağılımı — CSV "Firma Bazlı Gelir Detayı" satırı. Index 0=Oca … 11=Ara, USD. */
  monthlyBreakdown?: number[];
}

export interface InternalProject {
  id: string;
  name: string;
  category: string;
  monthlyRevenue: number;
  progress: number;
  status: "active" | "ongoing" | "paused";
  startDate: string;
  notes: string;
  /** İlişkili marka (iç gelir marka anlaşması). */
  brandId?: string;
  /** Bu gelirden pay alan yayıncılar (employee id listesi). */
  employeeIds: string[];
  /** Ödeme günü: "1-5", "15", "17" vb. */
  paymentDay: string;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  /** Son marka hatırlatma bildirimi (ISO). */
  lastReminderSentAt?: string;
}

/** Marka iç gelir tahsilat kaydı (aylık). */
export interface InternalProjectPayment {
  id: string;
  projectId: string;
  month: string;
  dueDate?: string;
  amount: number;
  status: "pending" | "paid" | "overdue" | "cancelled";
  paidDate?: string;
  notes: string;
}

export interface ExpenseEntry {
  id: string;
  category: string;
  amount: number;
  date: string;
  description: string;
  /** Bu gideri temsil eden kasa hareketinin id'si (varsa). */
  kasaTxId?: string;
  /** Markaya atanmış genel gider (marka panelinde görünür). */
  brandId?: string;
  /** Planlanan kalemden aktarıldıysa kaynak plan id'si. */
  plannedItemId?: string;
}

export type PlannedCategory = "capex" | "opex" | "revenue" | "growth" | "other";
export type PlannedRecurrence = "none" | "monthly" | "quarterly" | "yearly";
export type PlannedStatus =
  | "planned"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "postponed";

export interface PlannedItem {
  id: string;
  name: string;
  /** CapEx, OpEx, gelir hedefi, büyüme, diğer. */
  category: PlannedCategory;
  budget: number;
  /** Gerçekleşen / harcanan tutar (manuel veya aktarımdan). */
  spent: number;
  startDate: string;
  targetDate: string;
  priority: "high" | "medium" | "low";
  status: PlannedStatus;
  notes: string;
  /** Sorumlu çalışan. */
  employeeId?: string;
  brandId?: string;
  internalProjectId?: string;
  isRecurring: boolean;
  recurrence: PlannedRecurrence;
  /** Giderlere aktarım sonrası expense_entries.id */
  expenseEntryId?: string;
  /** Kasaya aktarım sonrası kasa_transactions.id */
  kasaTxId?: string;
}

/** Planlanan kalemin taksit / dönem ödemesi. */
export interface PlannedItemPayment {
  id: string;
  plannedItemId: string;
  month: string;
  dueDate?: string;
  amount: number;
  status: "pending" | "paid" | "cancelled";
  paidDate?: string;
  notes: string;
}

/** Sponsor anlaşması satır işlemi (CSV "Tarih Bazlı Tüm Sponsor İşlemleri"). */
export interface SponsorTransaction {
  id: string;
  date: string;
  companyName: string;
  service: string;
  amount: number;
  status: "active" | "ended";
  txid: string;
}

/** Bir yayıncının kullandığı sosyal medya / yayın platformu hesabı. */
export interface StreamerAccount {
  id: string;
  employeeId: string;
  platform: string;
  handle: string;
  url: string;
  notes: string;
  status: "active" | "inactive";
}

/** Haftalık takvim slotu (yayıncı bazlı). */
export interface ScheduleSlot {
  id: string;
  employeeId: string;
  /** 1=Pazartesi … 7=Pazar (ISO). */
  dayOfWeek: number;
  startTime: string; // "20:00"
  endTime: string;   // "23:00"
  platform: string;
  notes: string;
}

/** Marka bazlı aylık operasyon özeti (kayıt, yatırım, tutarlar). */
export interface BrandMonthlyStats {
  id: string;
  brandId: string;
  /** YYYY-MM */
  month: string;
  /** Bu ay yeni kayıt olan üye sayısı. */
  newRegistrations: number;
  /** Bu ay en az bir yatırım yapan benzersiz üye. */
  depositingMembers: number;
  /** İlk kez yatırım yapan üye (FTD). */
  firstTimeDepositors: number;
  /** Yatırım işlem adedi. */
  depositCount: number;
  depositAmount: number;
  withdrawalAmount: number;
  currency: "TRY" | "USD" | "EUR";
  /** Brüt oyun geliri (GGR). */
  ggr?: number;
  /** Net oyun geliri (NGR). */
  ngr?: number;
  /** Aktif oyuncu sayısı (aylık). */
  activePlayers?: number;
  /** Bonus maliyeti. */
  bonusCost?: number;
  /** Toplam affiliate komisyonu. */
  commissionTotal?: number;
  /** Canlı yayın demo oyun bakiyesi — aylık tahsis. */
  liveDemoAllocated: number;
  /** Kalan demo bakiye (oyun için). */
  liveDemoRemaining: number;
  liveDemoNotes: string;
  notes: string;
  /** Son kaydı güncelleyen admin (app_users.id). */
  updatedBy?: string;
  updatedAt?: string;
}

/** Marka izlenme raporu — ay bazlı izlenme adetleri (toplam). */
export interface BrandViewership {
  id: string;
  /** Yayıncı veya marka adı. */
  brandName: string;
  /** Bu satır belirli bir yayıncının aylık toplamıysa (boş = genel / yönetici). */
  employeeId?: string;
  /** İlişkili marka (varsa). */
  brandId?: string;
  /** İlişkili sponsor firması (geçmiş). */
  companyId?: string;
  month: string;
  views: number;
  url: string;
  notes: string;
}

/** Aktif olarak tanıtılan / izlenmesi takip edilen marka. */
export interface Brand {
  id: string;
  name: string;        // "Galabet"
  shortName: string;   // "Gala"
  category: string;    // "Bahis", "Casino" gibi
  status: "active" | "paused" | "inactive";
  notes: string;
  /** Aylık hedef izlenme (opsiyonel). */
  monthlyTarget?: number;
  /** Bağlı olduğu organizasyon (kiracı). Faz 0 multi-tenant. */
  organizationId?: string;
  /** Onaylanan B2B başvurudan oluşturulduysa başvuru id — landing marquee'de gösterilmez. */
  createdFromRequestId?: string;
}

export type OrgType = "agency" | "brand" | "network";
export type OrgRole = "owner" | "admin" | "finance" | "marketing" | "hr" | "viewer" | "auditor";

/** Kiracı (tenant) sınırı. Dahili ajans + dışarıdan kayıt olan markalar. */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: OrgType;
  status: "active" | "suspended" | "closed";
  plan: "starter" | "growth" | "enterprise" | "agency";
  logoUrl?: string;
  primaryColor: string;
  locale: string;
  timezone: string;
  defaultCurrency: "USD" | "EUR" | "TRY";
  contactName?: string;
  contactEmail?: string;
  /** İlk-giriş onboarding sihirbazı tamamlandı mı? */
  onboardingCompleted: boolean;
  createdFromRequestId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Bir organizasyondaki kullanıcı + rolü. */
export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  orgRole: OrgRole;
  /** Tüm markalara mı, yoksa member_brands ile sınırlı markalara mı erişir? */
  scopeAllBrands: boolean;
  title: string;
  /** scopeAllBrands=false ise erişilen marka id'leri. */
  brandIds?: string[];
  createdAt: string;
  updatedAt: string;
}

/** Markanın takip edilen sosyal medya / yayın platformu linki. */
export interface BrandLink {
  id: string;
  brandId: string;
  platform: string;    // "Instagram" | "Kick" | "TikTok" | "YouTube" | "Twitter" | ...
  handle: string;
  url: string;
  /** Yayıncı sahibi (Ramiz / Lucy / Acelya). Opsiyonel. */
  ownerId?: string;
  status: "active" | "inactive";
  notes: string;
  /** Son manuel snapshot. */
  lastSnapshotDate?: string;
  lastViews?: number;
  /** Otomatik takip için ipucu (ileride API entegrasyonu için). */
  autoTrack?: boolean;
  // --- Otomatik yenileme metadata'sı (sunucu/cron tarafından yönetilir) ----
  /** Platform-spesifik external ID (videoId / shortcode / TT video id). */
  externalRef?: string;
  /** Son API kontrol zaman damgası (ISO). */
  lastCheckedAt?: string;
  /** Son ölçülen begeni / yorum / paylaşım sayıları (varsa). */
  lastLikes?: number;
  lastComments?: number;
  lastShares?: number;
  /** Son hata mesajı — başarılıysa null. */
  lastCheckError?: string;
  /** Toplam başarılı kontrol sayısı. */
  checkCount?: number;
  /** Toplam hatalı kontrol sayısı. */
  errorCount?: number;
  /** Toplam başarılı API yenileme sayısı. */
  refreshCountTotal?: number;
  /** Son yenileme sonucu: ok | error | quota | not_supported */
  lastRefreshStatus?: "ok" | "error" | "quota" | "not_supported";
  /** DB tarafından üretilen oluşturulma zamanı (ISO). */
  createdAt?: string;
}

/** Bir linke ait belirli bir tarihteki izlenme/abone snapshot'ı. */
export interface LinkSnapshot {
  id: string;
  linkId: string;
  date: string;        // YYYY-MM-DD
  views: number;
  notes: string;
  /** O günkü engagement (null = ölçülmedi). */
  likes?: number;
  comments?: number;
  shares?: number;
  /** API yenileme anının zaman damgası. */
  refreshedAt?: string;
}

/** Kasa hesabı — birden çok kasa açılabilir (Genel, USDT, Banka vb.). */
export interface Kasa {
  id: string;
  name: string;
  /** Sınıflandırma — analitik ve filtreleme için. */
  kind: "general" | "usdt" | "bank" | "cash" | "other";
  /** Para birimi etiketi (USD/USDT/TRY); tüm hesaplama USD baz alındığı için bilgisel. */
  currency: string;
  isDefault: boolean;
  archived: boolean;
  orderIndex: number;
  notes: string;
  /** TRC20 USDT cüzdan adresi (otomatik hareket çekimi). */
  tronAddress?: string;
  /** Bu tarihten itibaren zincir hareketleri içe aktarılır (YYYY-MM-DD). */
  tronSyncFrom?: string;
}

/** Kasa hareketi — Denetim grubuna iletilen tüm para giriş/çıkışları. */
export interface KasaTransaction {
  id: string;
  /** Hangi kasaya ait olduğu (FK → kasas.id). */
  kasaId: string;
  date: string;             // ISO YYYY-MM-DDTHH:MM
  direction: "in" | "out";
  amountUsd: number;
  /** Network fee (USDT vs.) — opsiyonel ek kesinti. */
  feeUsd: number;
  purpose: string;
  /** Alıcı (out için) veya gönderici (in için). */
  counterparty: string;
  /** TRON işlem kimliği (otomatik import). */
  tronTxId?: string;
  /** Zincirden otomatik oluşturuldu. */
  autoImported?: boolean;
  /**
   * TRON cüzdanından çıkan harcama, Genel Kasa / işletme giderine de dahil
   * edilsin mi? true ise işletme bakiyesinden de düşülmüş sayılır.
   */
  countInGenel?: boolean;
  /** TXID / dekont / kanıt link. */
  proof: string;
  notes: string;
  /** Planlanan kalemden oluşan kasa hareketiyse kaynak plan id'si. */
  plannedItemId?: string;
}

/** İçerik üretim / vlog harcaması — Ramiz vb. yayıncıların aylık raporu. */
export interface ContentExpense {
  id: string;
  date: string;          // YYYY-MM-DD
  month: string;         // YYYY-MM
  employeeId: string;    // Harcamayı yapan/rapor eden
  brandId?: string;      // İlgili marka (varsa) — çoklu seçimde birincil
  /** Ortak harcama: tutar bu markalar arasında eşit bölünür. */
  brandIds?: string[];
  brandName: string;     // "Padi", "Pipo", "Siteler" vb.
  category: string;      // "Vlog", "Yetişkin İçerik", "Yol", "Reklam"
  description: string;
  amountUsd: number;
  amountThb?: number;
  paid: boolean;
  paidDate?: string;
  notes: string;
  // ── Yayıncı self-service & onay akışı ──
  /** Kanıt görseli URL'si (Gyazo / Imgur / dekont link). */
  screenshotUrl?: string;
  /** Yayıncı tarafından gönderildiği zaman (ISO). */
  submittedAt?: string;
  /** Hangi user gönderdi (auth.users.id). */
  submittedBy?: string;
  /** İnceleme durumu — admin onayı sonrası `paid: true` set edilir. */
  reviewStatus?: "pending" | "approved" | "rejected" | "needs_info" | "cancelled";
  /** İnceleme zamanı. */
  reviewedAt?: string;
  /** İnceleyen admin/denetçi user id. */
  reviewedBy?: string;
  /** Admin/Denetçi notu (red sebebi vb.). */
  reviewerNote?: string;
  /** Denetçi tarafından incelendi mi? */
  audited?: boolean;
  /** "Ödendi" olarak işaretlenirken oluşturulan kasa hareketinin id'si. */
  kasaTxId?: string;
  /** Ödeme yolu: kasa çıkışı veya bordro masrafı. */
  settlementMode?: "kasa" | "payroll";
  /** Bordroya eklendiyse bağlı salary_extra id. */
  salaryExtraId?: string;
  /** Yönetici ↔ yayıncı inceleme mesajları. */
  reviewThread?: ExpenseReviewMessage[];
}

export interface ExpenseReviewMessage {
  authorId: string;
  authorRole: "admin" | "auditor" | "streamer";
  message: string;
  at: string;
}

export type ExpenseReviewAuthorRole = ExpenseReviewMessage["authorRole"];

/** Yayıncı haftalık plan kaydı — `ScheduleSlot`'tan ayrı, tarihli ve özel. */
export interface WeeklyPlan {
  id: string;
  employeeId: string;
  /** Haftanın Pazartesi'si (YYYY-MM-DD). */
  weekStart: string;
  /** Plan tarihi (YYYY-MM-DD). */
  date: string;
  startTime?: string;    // "20:00"
  endTime?: string;      // "23:00"
  activity: string;      // "Yayın" | "Vlog Çekimi" | "Edit" | "Toplantı" | "İzin"
  brandName?: string;
  notes: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  /** Planın hangi yayıncı hesabıyla ilişkili olduğu. */
  streamerAccountId?: string;
  /** Hangi user oluşturdu (auth.users.id). */
  createdBy?: string;
  createdAt?: string;
}

/** Haftalık marka reel — o hafta hangi marka için içerik hangi URL’de yayınlandı. */
export interface WeekBrandReel {
  id: string;
  employeeId: string;
  /** Haftanın Pazartesi’si (YYYY-MM-DD). */
  weekStart: string;
  brandId: string;
  /** Yayınlanan reel / post doğrudan linki. */
  contentUrl: string;
  platform: string;
  /** İçerik türü: reels / post / story / video / canlı / diğer (opsiyonel). */
  contentType?: string;
  /** Varsa kayıtlı marka linki (şablondan seçim). */
  brandLinkId?: string;
  /** Kişisel yayıncı hesabı (streamer_accounts) — achievement API kaynağı. */
  streamerAccountId?: string;
  /** Instagram vb. içeriğin yayınlandığı tarih (API). */
  publishedAt?: string;
  notes: string;
  createdAt: string;
  // --- İzlenme (RapidAPI) metrikleri — sunucu/refresh tarafından yönetilir ----
  /** Platform-spesifik external ID (shortcode / video id). */
  externalRef?: string;
  /** Son ölçülen izlenme. */
  lastViews?: number;
  lastLikes?: number;
  lastComments?: number;
  lastShares?: number;
  /** Son API kontrol zaman damgası (ISO). */
  lastCheckedAt?: string;
  /** Son hata mesajı — başarılıysa boş. */
  lastCheckError?: string;
  /** Toplam başarılı kontrol sayısı. */
  checkCount?: number;
}

/**
 * Self-serve marka kayıt başvurusu (Faz A).
 * Dışarıdan gelen kayıt formunu temsil eder; admin onayı sonrası `brands` ve
 * `app_users` satırları otomatik üretilir. ID prefix'i: `req-`.
 */
export interface BrandRegistrationRequest {
  id: string;
  brandName: string;
  shortName?: string;
  category: string;
  website?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  telegram?: string;
  /** Aralık ifadesi: "1M-5M", "5M+" vb. */
  monthlyVolume?: string;
  preferredUsername?: string;
  notes: string;
  status: "pending" | "approved" | "rejected" | "duplicate";
  rejectionReason?: string;
  /** İnceleyen admin (app_users.id). */
  reviewedBy?: string;
  reviewedAt?: string;
  /** Onaylandıysa oluşturulan marka. */
  createdBrandId?: string;
  /** Onaylandıysa oluşturulan marka kullanıcısı. */
  createdUserId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Dışarıdan gelen yayıncı self-serve başvurusu (Faz 2). */
export interface StreamerRegistrationRequest {
  id: string;
  displayName: string;
  realName?: string;
  contactEmail: string;
  contactPhone?: string;
  telegram?: string;
  /** Serbest metin: platform + handle (virgülle ayrılmış). */
  platforms: string;
  categories: string;
  audienceSize?: string;
  preferredUsername?: string;
  notes: string;
  status: "pending" | "approved" | "rejected" | "duplicate";
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  /** Onaylandıysa oluşturulan employee. */
  createdEmployeeId?: string;
  /** Onaylandıysa oluşturulan kullanıcı. */
  createdUserId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Faz C — Affiliate Tracking MVP
 *
 * Marka başına affiliate / partner kaydı. UI ileride; backend tüm CRUD + CSV import'u
 * destekler. ID prefix önerisi: `ap-` (partner), `ads-` (daily stat), `apo-` (payout).
 */
export interface AffiliatePartner {
  id: string;
  brandId: string;
  name: string;
  /** Operatör tarafındaki aff_id; CSV importunda eşleştirme anahtarı. */
  externalRef?: string;
  partnerType: "streamer" | "external" | "agency" | "social";
  commissionModel: "cpa" | "revshare" | "hybrid" | "flat";
  cpaAmount: number;
  /** Yüzde (0-100). */
  revsharePct: number;
  currency: "USD" | "EUR" | "TRY";
  status: "active" | "paused" | "closed";
  /** Foxstream yayıncı eşleştirmesi (varsa). */
  employeeId?: string;
  contact?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** Partner × gün performans satırı. UNIQUE (partnerId, statDate). */
export interface AffiliateDailyStat {
  id: string;
  partnerId: string;
  brandId: string;
  /** YYYY-MM-DD */
  statDate: string;
  clicks: number;
  registrations: number;
  ftdCount: number;
  ftdAmount: number;
  depositAmount: number;
  withdrawalAmount: number;
  netRevenue: number;
  commissionDue: number;
  currency: "USD" | "EUR" | "TRY";
  source: "manual" | "csv" | "api" | "webhook";
  /** Otomatik veya CSV import zaman damgası (ISO). */
  importedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Partner ödeme dönemi (komisyon ödemesi). */
export interface AffiliatePayout {
  id: string;
  partnerId: string;
  brandId: string;
  /** YYYY-MM-DD */
  periodStart: string;
  /** YYYY-MM-DD */
  periodEnd: string;
  amount: number;
  currency: "USD" | "EUR" | "TRY";
  status: "pending" | "approved" | "paid" | "cancelled";
  /** YYYY-MM-DD; status === 'paid' ise dolu olmalı (uygulama doğrulaması). */
  paidDate?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Faz G — Yayıncı Havuzu + Teklif Sistemi
 *
 * `streamer_pool_profiles` 1:1 employees.id — yayıncının halka açık profili.
 * `brand_offers` marka↔yayıncı teklif başlığı; `brand_offer_messages` sohbeti.
 * ID prefix önerisi: `spp-` profile, `bo-` offer, `bom-` message.
 */
export interface StreamerPoolProfile {
  id: string;
  employeeId: string;
  displayName: string;
  headline: string;
  bio: string;
  categories: string[];
  languages: string[];
  countries: string[];
  rateMinUsd?: number;
  rateMaxUsd?: number;
  rateCurrency: string;
  followersTotal: number;
  avgViews: number;
  avatarUrl?: string;
  coverUrl?: string;
  status: "draft" | "published" | "paused" | "closed";
  visibility: "public" | "brand_only" | "invite_only";
  igamingTags: string[];
  restrictedMarkets: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BrandOfferDeliverable {
  type: string;
  count: number;
  platform?: string;
  notes?: string;
}

export interface BrandOffer {
  id: string;
  brandId: string;
  employeeId: string;
  initiator: "brand" | "streamer";
  title: string;
  description: string;
  offerType: "campaign" | "single_post" | "long_term" | "affiliate";
  budgetUsd?: number;
  status: "pending" | "negotiating" | "accepted" | "rejected" | "withdrawn" | "expired";
  deliverables: BrandOfferDeliverable[];
  startDate?: string;
  endDate?: string;
  notes: string;
  expiresAt?: string;
  createdBy?: string;
  respondedBy?: string;
  respondedAt?: string;
  /** Accept ile oluşturulan brand_deals.id. */
  createdDealId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandOfferMessage {
  id: string;
  offerId: string;
  authorId: string;
  authorRole: "brand" | "streamer" | "admin";
  body: string;
  counterBudgetUsd?: number;
  createdAt: string;
}

/**
 * Faz H — Aktif Anlaşma + İçerik Post Takibi
 *
 * `brand_deals` kabul edilmiş teklif sonrası yaşam döngüsü;
 * `brand_posts` yayıncının attığı içerik URL'leri.
 * ID prefix: `bd-` deal, `bp-` post.
 */
export interface BrandDealDeliverable {
  type: string;
  count: number;
  platform?: string;
}

export interface BrandDeal {
  id: string;
  brandId: string;
  employeeId: string;
  originOfferId?: string;
  title: string;
  dealType: "campaign" | "single_post" | "long_term" | "affiliate";
  status: "active" | "completed" | "cancelled" | "disputed";
  budgetUsd: number;
  paidUsd: number;
  startDate?: string;
  endDate?: string;
  deliverables: BrandDealDeliverable[];
  /** Trigger ile güncellenir — istemcide elle değişmemeli. */
  postsCount: number;
  /** Trigger ile güncellenir — istemcide elle değişmemeli. */
  totalViews: number;
  notes: string;
  contractUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandPost {
  id: string;
  brandId: string;
  employeeId?: string;
  dealId?: string;
  platform: "instagram" | "tiktok" | "youtube" | "kick" | "twitter" | "telegram" | "other";
  postType: "post" | "reel" | "story" | "vlog" | "stream" | "vod" | "tweet" | "other";
  url: string;
  caption: string;
  postedAt?: string;
  screenshotUrl?: string;
  views: number;
  likes: number;
  comments: number;
  status: "draft" | "live" | "removed" | "expired";
  createdAt: string;
  updatedAt: string;
}

/** Yöneticiye veya denetçiye gönderilen bildirim. */
export interface AppNotification {
  id: string;
  type:
    | "expense_submitted"
    | "expense_approved"
    | "expense_rejected"
    | "schedule_updated"
    | "advance_request"
    | "kasa_low"
    | "payroll_reminder"
    | "brand_payment_reminder"
    | "expense_paid"
    | "password_reset_request"
    | "account_registration_request"
    | "api_refresh_alert"
    | "content_published"
    | "deliverable_late"
    | "general";
  title: string;
  message: string;
  /** Bildirim hangi rol için? */
  forRole: "admin" | "auditor" | "streamer" | "brand";
  /** Belirli kullanıcıya yönelik (opsiyonel, ör. yayıncıya geri bildirim). */
  forUserId?: string;
  /** Belirli markaya yönelik (brand izolasyonu — o markanın tüm ekibi görür). */
  forBrandId?: string;
  /** İlgili kaydın id'si (ör. ContentExpense.id). */
  refId?: string;
  /** Hangi kullanıcı tetikledi (auth.users.id). */
  triggeredBy?: string;
  /** ISO zaman damgası. */
  createdAt: string;
  read: boolean;
  /** Action linki (sayfayı açma kısayolu). */
  href?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

interface AppStore {
  // Organizasyon / multi-tenant (Faz 0)
  organizations: Organization[];
  organizationMembers: OrganizationMember[];

  employees: Employee[];
  advances: Advance[];
  salaryExtras: SalaryExtra[];
  paymentStatuses: MonthPaymentStatus[];

  companies: ExternalCompany[];
  sponsorTransactions: SponsorTransaction[];
  projects: InternalProject[];
  projectPayments: InternalProjectPayment[];
  expenses: ExpenseEntry[];
  plannedItems: PlannedItem[];
  plannedItemPayments: PlannedItemPayment[];

  streamerAccounts: StreamerAccount[];
  scheduleSlots: ScheduleSlot[];

  // Marka izleme
  brands: Brand[];
  brandLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  brandViewership: BrandViewership[];
  brandMonthlyStats: BrandMonthlyStats[];

  // Affiliate Tracking (Faz C)
  affiliatePartners: AffiliatePartner[];
  affiliateDailyStats: AffiliateDailyStat[];
  affiliatePayouts: AffiliatePayout[];

  // Yayıncı havuzu + teklif (Faz G)
  streamerPoolProfiles: StreamerPoolProfile[];
  brandOffers: BrandOffer[];
  brandOfferMessages: BrandOfferMessage[];

  // Anlaşma + post takibi (Faz H)
  brandDeals: BrandDeal[];
  brandPosts: BrandPost[];

  // Kasa & İçerik harcamaları
  kasas: Kasa[];
  kasaTransactions: KasaTransaction[];
  contentExpenses: ContentExpense[];

  // Yayıncı haftalık planı ve bildirimler
  weeklyPlans: WeeklyPlan[];
  weekBrandReels: WeekBrandReel[];
  notifications: AppNotification[];

  // Employee
  addEmployee: (e: Omit<Employee, "id">) => void;
  updateEmployee: (id: string, e: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;

  // Advance
  addAdvance: (a: Omit<Advance, "id">) => void;
  updateAdvance: (id: string, a: Partial<Advance>) => void;
  deleteAdvance: (id: string) => void;

  // Salary extra
  addSalaryExtra: (e: Omit<SalaryExtra, "id">) => void;
  updateSalaryExtra: (id: string, e: Partial<SalaryExtra>) => void;
  deleteSalaryExtra: (id: string) => void;
  syncRentSupportFromMonth: (employeeId: string, fromMonth: string, amount: number) => void;
  /** Seçilen aylara kira tutarı (ay bazlı salary_extras). */
  setRentForMonths: (employeeId: string, months: string[], amount: number) => void;
  /** Sözleşme `rentSupport` alanı — mevcut ay kalemlerini silmeden varsayılanı günceller. */
  setEmployeeRentSupport: (employeeId: string, amount: number) => void;

  setPaymentStatus: (employeeId: string, month: string, paid: boolean, paidDate?: string, paidBy?: string) => void;

  /**
   * Atomik maaş ödemesi: hem `payment_statuses` günceller hem de seçilen kasada
   * `out` yönlü bir hareket oluşturup `kasaTxId` ile bağlar.
   */
  payEmployeeSalary: (args: {
    employeeId: string;
    month: string;
    amountUsd: number;
    kasaId: string;
    paidDate: string;          // YYYY-MM-DD
    feeUsd?: number;
    notes?: string;
    proof?: string;
    paidBy?: string;
  }) => void;

  /** "Geri al" — bağlı kasa hareketini siler, ödeme durumunu beklemeye çeker. */
  unpayEmployeeSalary: (employeeId: string, month: string) => void;

  /** Tek bordro kalemini öde (temel maaş, kira, prim vb.). */
  payPayrollLine: (args: {
    employeeId: string;
    month: string;
    lineId: string;
    amountUsd: number;
    kasaId: string;
    paidDate: string;
    feeUsd?: number;
    notes?: string;
    proof?: string;
    paidBy?: string;
  }) => void;

  /** Tek kalemin ödemesini geri al (kasa hareketi silinir). */
  unpayPayrollLine: (employeeId: string, month: string, lineId: string) => void;

  /** Kasa hareketi olmadan tek kalemi ödendi işaretle. */
  markPayrollLinePaid: (args: {
    employeeId: string;
    month: string;
    lineId: string;
    paidDate: string;
    paidBy?: string;
  }) => void;

  /** Kasa hareketi olmadan bekleyen kalemleri (veya seçilenleri) ödendi işaretle. */
  markEmployeePayrollLinesPaid: (args: {
    employeeId: string;
    month: string;
    paidDate: string;
    paidBy?: string;
    lineIds?: string[];
  }) => void;

  // Company
  addCompany: (c: Omit<ExternalCompany, "id">) => void;
  updateCompany: (id: string, c: Partial<ExternalCompany>) => void;
  deleteCompany: (id: string) => void;

  // Sponsor transaction
  addSponsorTransaction: (t: Omit<SponsorTransaction, "id">) => void;
  updateSponsorTransaction: (id: string, t: Partial<SponsorTransaction>) => void;
  deleteSponsorTransaction: (id: string) => void;

  // Project
  addProject: (p: Omit<InternalProject, "id">) => void;
  updateProject: (id: string, p: Partial<InternalProject>) => void;
  deleteProject: (id: string) => void;

  addProjectPayment: (p: Omit<InternalProjectPayment, "id">) => void;
  updateProjectPayment: (id: string, p: Partial<InternalProjectPayment>) => void;
  deleteProjectPayment: (id: string) => void;

  // Expense
  addExpense: (e: Omit<ExpenseEntry, "id">) => void;
  updateExpense: (id: string, e: Partial<ExpenseEntry>) => void;
  deleteExpense: (id: string) => void;
  /**
   * Atomik gider kaydı: hem `expenses` tablosuna ekler hem (opsiyonel) seçilen
   * kasada `out` yönlü bir hareket oluşturup `kasaTxId` ile bağlar.
   */
  recordExpense: (
    e: Omit<ExpenseEntry, "id" | "kasaTxId">,
    kasa?: { kasaId: string; feeUsd?: number; notes?: string; proof?: string },
  ) => void;

  // Planned
  addPlannedItem: (i: Omit<PlannedItem, "id">) => void;
  updatePlannedItem: (id: string, i: Partial<PlannedItem>) => void;
  deletePlannedItem: (id: string) => void;

  addPlannedItemPayment: (p: Omit<PlannedItemPayment, "id">) => void;
  updatePlannedItemPayment: (id: string, p: Partial<PlannedItemPayment>) => void;
  deletePlannedItemPayment: (id: string) => void;
  transferPlannedToExpense: (args: {
    plannedItemId: string;
    amount: number;
    date: string;
    description?: string;
    category?: string;
    markCompleted?: boolean;
  }) => void;
  transferPlannedToKasa: (args: {
    plannedItemId: string;
    kasaId: string;
    amount: number;
    date: string;
    feeUsd?: number;
    notes?: string;
    proof?: string;
    markCompleted?: boolean;
  }) => void;

  // Streamer accounts
  addStreamerAccount: (a: Omit<StreamerAccount, "id">) => void;
  updateStreamerAccount: (id: string, a: Partial<StreamerAccount>) => void;
  deleteStreamerAccount: (id: string) => void;

  // Schedule
  addScheduleSlot: (s: Omit<ScheduleSlot, "id">) => void;
  updateScheduleSlot: (id: string, s: Partial<ScheduleSlot>) => void;
  deleteScheduleSlot: (id: string) => void;

  // Viewership
  addBrandViewership: (v: Omit<BrandViewership, "id">) => void;
  updateBrandViewership: (id: string, v: Partial<BrandViewership>) => void;
  deleteBrandViewership: (id: string) => void;

  /** Marka + ay için operasyon özeti (varsa günceller, yoksa ekler). */
  upsertBrandMonthlyStats: (
    stats: Omit<BrandMonthlyStats, "id" | "updatedAt"> & { id?: string; updatedBy?: string }
  ) => void;

  // Brand
  addBrand: (b: Omit<Brand, "id">) => void;
  updateBrand: (id: string, b: Partial<Brand>) => void;
  deleteBrand: (id: string) => void;

  // Brand link
  addBrandLink: (l: Omit<BrandLink, "id">) => void;
  updateBrandLink: (id: string, l: Partial<BrandLink>) => void;
  deleteBrandLink: (id: string) => void;

  // Link snapshot
  addLinkSnapshot: (s: Omit<LinkSnapshot, "id">) => void;
  /** Aynı id varsa günceller (API otomatik snapshot ile uyumlu). */
  upsertLinkSnapshot: (s: LinkSnapshot) => void;
  updateLinkSnapshot: (id: string, s: Partial<LinkSnapshot>) => void;
  deleteLinkSnapshot: (id: string) => void;

  // Kasa hesapları
  addKasa: (k: Omit<Kasa, "id">) => void;
  updateKasa: (id: string, k: Partial<Kasa>) => void;
  deleteKasa: (id: string, opts?: { force?: boolean }) => void;

  // Kasa
  addKasaTransaction: (t: Omit<KasaTransaction, "id">) => void;
  updateKasaTransaction: (id: string, t: Partial<KasaTransaction>) => void;
  /** Birden çok kasa hareketinin Genel Kasa dahil bayrağını tek istekte günceller. */
  bulkSetKasaCountInGenel: (ids: string[], include: boolean) => void;
  deleteKasaTransaction: (id: string) => void;

  // Content expense
  addContentExpense: (e: Omit<ContentExpense, "id">) => string;
  updateContentExpense: (id: string, e: Partial<ContentExpense>) => void;
  deleteContentExpense: (id: string) => void;
  /** Onaylı harcamayı bordroya masraf kalemi olarak ekler (maaş netine dahil). */
  settleContentExpenseToPayroll: (contentExpenseId: string) => void;
  /** Bordro bağlantısını kaldırır; salary_extra silinir. */
  unsettleContentExpenseFromPayroll: (contentExpenseId: string) => void;
  /**
   * Atomik "ödendi" işaretleme: hem ilgili `content_expense` satırını günceller
   * hem seçilen kasada `out` yönlü hareket yaratıp `kasaTxId` ile bağlar.
   */
  payContentExpense: (args: {
    contentExpenseId: string;
    kasaId: string;
    paidDate: string;
    feeUsd?: number;
    notes?: string;
    proof?: string;
  }) => void;
  /** Bağlı kasa hareketini siler, ödeme bayrağını kaldırır. */
  unpayContentExpense: (id: string) => void;

  // Weekly plan
  addWeeklyPlan: (p: Omit<WeeklyPlan, "id">) => string;
  updateWeeklyPlan: (id: string, p: Partial<WeeklyPlan>) => void;
  deleteWeeklyPlan: (id: string) => void;

  // Haftalık marka reel
  addWeekBrandReel: (r: Omit<WeekBrandReel, "id" | "createdAt">) => void;
  updateWeekBrandReel: (id: string, r: Partial<WeekBrandReel>) => void;
  deleteWeekBrandReel: (id: string) => void;
  /** Sunucu refresh sonucu izlenme metriklerini yerel state'e uygular (DB'ye tekrar yazmaz). */
  applyWeekReelMetrics: (id: string, patch: Partial<WeekBrandReel>) => void;

  // Notifications
  pushNotification: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (forRole: "admin" | "auditor" | "streamer" | "brand", forUserId?: string) => void;
  deleteNotification: (id: string) => void;

  /** Yedek dosyasından uygulama verisini birleştirir (mevcut alanların üzerine yazar). */
  hydrateFromBackup: (data: AppHydratePayload) => void;
}

export const APP_SNAPSHOT_KEYS = [
  "organizations",
  "organizationMembers",
  "employees",
  "advances",
  "salaryExtras",
  "paymentStatuses",
  "companies",
  "sponsorTransactions",
  "projects",
  "projectPayments",
  "expenses",
  "plannedItems",
  "plannedItemPayments",
  "streamerAccounts",
  "scheduleSlots",
  "brands",
  "brandLinks",
  "linkSnapshots",
  "brandViewership",
  "brandMonthlyStats",
  "affiliatePartners",
  "affiliateDailyStats",
  "affiliatePayouts",
  "streamerPoolProfiles",
  "brandOffers",
  "brandOfferMessages",
  "brandDeals",
  "brandPosts",
  "kasas",
  "kasaTransactions",
  "contentExpenses",
  "weeklyPlans",
  "weekBrandReels",
  "notifications",
] as const;

/** Tam yedek JSON içindeki `app` nesnesi için tip (döngüsel AppStore referansı yok). */
export type AppHydratePayload = Partial<
  Pick<AppStore, (typeof APP_SNAPSHOT_KEYS)[number]>
>;

const uid = () => crypto.randomUUID();

const MONTH_NAMES_TR_SHORT = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
] as const;

/** "2026-05" → "Mayıs 2026". Geçersiz girdi olduğu gibi döner. */
function formatPayrollMonthLabel(ym: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(ym);
  if (!m) return ym;
  const idx = Number(m[2]) - 1;
  if (idx < 0 || idx > 11) return ym;
  return `${MONTH_NAMES_TR_SHORT[idx]} ${m[1]}`;
}

function paidPlannedTotal(
  payments: PlannedItemPayment[],
  plannedItemId: string,
  extraPaid = 0,
): number {
  const paid = payments
    .filter((p) => p.plannedItemId === plannedItemId && p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  return paid + extraPaid;
}

function plannedStatusAfterSpend(
  item: PlannedItem,
  spent: number,
  markCompleted?: boolean,
): PlannedStatus {
  if (markCompleted || spent >= item.budget) return "completed";
  if (spent > 0 && item.status === "planned") return "in-progress";
  return item.status;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed Data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sistemdeki 3 aktif yayıncı + 1 proje koordinatörü.
 * Tüm maaş ödemeleri Haziran 2026'dan itibaren bir sonraki ayın 1–5'i arasında yapılır.
 * (Lucy Mayıs 2026 dönemi yarım yapıldı — plan geçişi, 1 Haziran'da ödendi.)
 */
export const initialEmployees: Employee[] = [
  {
    id: "emp-ramiz",
    name: "Ramiz",
    role: "İçerik & Prodüksiyon · Yayıncı",
    department: "Yayın",
    baseSalary: 10000,
    rentSupport: 1400,
    initialAdvance: 8000,
    paymentDay: "1-5",
    payrollStartMonth: "2026-04",
    startDate: "2025-04-01",
    status: "active",
    walletAddress: "TEFigtFTbqZf47pwXPJCGdZv9jPgrgTcUE",
    avatar: "R",
    notes:
      "Maaş $10.000/ay. Başlangıçta $20.000 avans alınmış, $12.000 geri ödenmiş, " +
      "kalan $8.000 borç var. Nisan 2026: $2.000 kesinti (bu ay net $8.000 ödendi 1 May 2026). " +
      "Mayıs 2026: $3.000 kesinti (1 Haziran 2026 ödemesi · kalan borç $3.000). " +
      "Temmuz 2026 bordrosunda son $3.000 kesinti yapılır (1 Ağustos 2026 ödemesi) ve borç kapanır. " +
      "Haziran 2026 ek kesinti yok. Aylık $1.400 ev kira desteği — şirket öder. " +
      "Aylık içerik/marka harcamaları ay sonu raporla iletilir; şirket karşılar.",
    kind: "streamer",
  },
  {
    id: "emp-lucy",
    name: "Lucy",
    role: "Yayıncı",
    department: "Yayın",
    baseSalary: 3000,
    rentSupport: 500,
    initialAdvance: 0,
    paymentDay: "1-5",
    payrollStartMonth: "2026-04",
    startDate: "2026-01-01",
    status: "active",
    walletAddress: "",
    avatar: "L",
    notes:
      "Maaş $3.000/ay + $500 ev kira desteği. " +
      "Nisan 2026 bordrosu nakit ödendi: $3.000 maaş + $500 kira + $1.600 telefon desteği (tek seferlik). " +
      "Mayıs 2026 plan geçişi: 1 Haziran 2026'da yarım dönem maaş ($1.500) ödendi · kira ($500) ayrı onaylanır. " +
      "Haziran 2026'dan itibaren standart 1–5 takvimi: Haziran bordrosu (tam $3.500) 1–5 Temmuz 2026'da ödenir.",
    kind: "streamer",
  },
  {
    id: "emp-acelya",
    name: "Acelya (acebaby)",
    role: "Yayıncı",
    department: "Yayın",
    baseSalary: 3500,
    rentSupport: 650,
    initialAdvance: 900,
    paymentDay: "1-5",
    payrollStartMonth: "2026-05",
    startDate: "2026-05-03",
    status: "active",
    walletAddress: "",
    avatar: "A",
    notes:
      "3 Mayıs 2026'da aramıza katıldı. Toplam $900 avans; Mayıs 2026 ilk bordro: " +
      "$300 avans kesintisi (1/3) · Mayıs kira desteği $1.550 · net $4.750 ($3.500 + $1.550 − $300) · 1–5 Haziran ödemesi. " +
      "Haziran'dan itibaren $650/ay kira (Lucy ile $1.300 kap) + avans kesintisi planı.",
    kind: "streamer",
  },
  {
    id: "emp-orkun",
    name: "Orkun",
    role: "Proje Koordinatörü",
    department: "Yönetim",
    baseSalary: 0,
    rentSupport: 0,
    initialAdvance: 0,
    paymentDay: "—",
    payrollStartMonth: "2026-04",
    startDate: "2025-01-01",
    status: "active",
    walletAddress: "",
    avatar: "O",
    notes: "Proje koordinatörü. Maaş bordrosunda yer almıyor.",
    kind: "coordinator",
  },
];

/** Aylık otomatik kira desteği & avans geri ödemeleri (2026 takvim yılı). */
const buildInitialSalaryExtras = (): SalaryExtra[] => {
  const list: SalaryExtra[] = [];

  // Ramiz — Nisan 2026 ve sonrası
  const ramizMonths = [
    "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09",
    "2026-10", "2026-11", "2026-12",
  ];
  ramizMonths.forEach((m) => {
    list.push({
      id: `se-ramiz-rent-${m}`,
      employeeId: "emp-ramiz",
      month: m,
      amount: 1400,
      description: "Ev kira desteği (aylık)",
      type: "rent",
    });
  });
  // Avans geri ödemesi — Nis $2k (paid), May $3k (paid 1 Haz), Tem $3k (paid 1 Ağu = final). Toplam $8k.
  // Haziran bordrosunda kesinti YOKTUR.
  const advancePlan: Array<{ month: string; amount: number; note: string }> = [
    { month: "2026-04", amount: 2000, note: "Açık avans geri ödemesi (1/3) · $8.000 → kalan $6.000" },
    { month: "2026-05", amount: 3000, note: "Açık avans geri ödemesi (2/3) · 1 Haziran 2026 · kalan $3.000" },
    { month: "2026-07", amount: 3000, note: "Açık avans geri ödemesi (3/3 · final) · 1 Ağustos 2026 · borç kapanır" },
  ];
  advancePlan.forEach((p) => {
    list.push({
      id: `se-ramiz-adv-${p.month}`,
      employeeId: "emp-ramiz",
      month: p.month,
      amount: p.amount,
      description: p.note,
      type: "deduction",
    });
  });

  // Lucy — Nisan 2026'dan itibaren $500 kira/ay (Acelya'nın $650 + Lucy $500 = ortak ev gideri).
  // Mayıs 2026 plan geçiş ayı: yarım maaş + tam kira = $2.000 ödendi 1 Haziran 2026.
  ramizMonths.forEach((m) => {
    list.push({
      id: `se-lucy-rent-${m}`,
      employeeId: "emp-lucy",
      month: m,
      amount: 500,
      description: "Ev kira desteği (aylık)",
      type: "rent",
    });
  });

  // Lucy Nisan 2026 — tek seferlik telefon desteği (gerçekte ödenen kalem).
  list.push({
    id: "se-lucy-phone-2026-04",
    employeeId: "emp-lucy",
    month: "2026-04",
    amount: 1600,
    description: "Nisan 2026 telefon desteği (tek seferlik)",
    type: "other",
  });

  // Lucy Mayıs 2026 — plan geçişi: yarım maaş (2 hafta) ödendi.
  // $3.000 baseSalary'den $1.500 kesinti → net $1.500 maaş + $500 kira = $2.000 ödendi 1 Haziran 2026.
  list.push({
    id: "se-lucy-transition-2026-05",
    employeeId: "emp-lucy",
    month: "2026-05",
    amount: 1500,
    description: "Plan geçişi — yarım dönem (2 hafta · 1 Haziran 2026'da $2.000 net ödendi)",
    type: "deduction",
  });

  // Acelya — $900 avans · $300/ay geri ödeme (May–Tem 2026, 1–5 ödeme takvimi)
  const acelyaAdvancePlan: Array<{ month: string; amount: number; note: string }> = [
    {
      month: "2026-05",
      amount: 300,
      note: "Açık avans geri ödemesi (1/3 · ilk maaş) · 1–5 Haziran 2026 · kalan $600",
    },
    {
      month: "2026-06",
      amount: 300,
      note: "Açık avans geri ödemesi (2/3) · 1–5 Temmuz 2026 · kalan $300",
    },
    {
      month: "2026-07",
      amount: 300,
      note: "Açık avans geri ödemesi (3/3 · final) · 1–5 Ağustos 2026 · borç kapanır",
    },
  ];
  acelyaAdvancePlan.forEach((p) => {
    list.push({
      id: `se-acelya-adv-${p.month}`,
      employeeId: "emp-acelya",
      month: p.month,
      amount: p.amount,
      description: p.note,
      type: "deduction",
    });
  });
  list.push({
    id: "se-acelya-rent-2026-05",
    employeeId: "emp-acelya",
    month: "2026-05",
    amount: 1550,
    description: "Ev kira desteği (Mayıs 2026 · ilk bordro)",
    type: "rent",
  });
  const acelyaStandardRentMonths: string[] = [];
  for (let y = 2026; y <= 2027; y++) {
    const startM = y === 2026 ? 6 : 1;
    for (let m = startM; m <= 12; m++) {
      acelyaStandardRentMonths.push(`${y}-${String(m).padStart(2, "0")}`);
    }
  }
  acelyaStandardRentMonths.forEach((m) => {
    list.push({
      id: `se-acelya-rent-${m}`,
      employeeId: "emp-acelya",
      month: m,
      amount: 650,
      description: "Ev kira desteği (aylık · Lucy ile birlikte $1.300 kap)",
      type: "rent",
    });
  });

  return list;
};

export const initialSalaryExtras: SalaryExtra[] = buildInitialSalaryExtras();

/** Seed kira kalemleri — reconcile/propagate sözleşme tutarını bunların üzerine yazmaz. */
export const CANONICAL_RENT_BY_EXTRA_ID: Readonly<Record<string, number>> = {
  "se-acelya-rent-2026-05": 1550,
};

function isLockedCanonicalRent(e: SalaryExtra): boolean {
  return e.type === "rent" && e.id in CANONICAL_RENT_BY_EXTRA_ID;
}

/** Kilitli ilk bordro kira ayından sonraki ay (Acelya: Haziran 2026). */
function rentPropagateStartMonth(
  employee: Employee,
  salaryExtras: SalaryExtra[],
): string {
  const lockedMonths = salaryExtras
    .filter(
      (e) =>
        e.employeeId === employee.id &&
        e.type === "rent" &&
        isLockedCanonicalRent(e),
    )
    .map((e) => e.month)
    .sort();
  if (lockedMonths.length === 0) return employee.payrollStartMonth;
  return shiftCalendarMonthYm(lockedMonths[lockedMonths.length - 1]!, 1);
}

/** Standart dönem kira tutarı: kilitli aylar hariç en güncel kalem veya sözleşme. */
function standardRentAmountForEmployee(
  employee: Employee,
  salaryExtras: SalaryExtra[],
): number {
  const from = rentPropagateStartMonth(employee, salaryExtras);
  const rows = salaryExtras
    .filter(
      (e) =>
        e.employeeId === employee.id &&
        e.type === "rent" &&
        ymGte(e.month, from) &&
        !isLockedCanonicalRent(e),
    )
    .sort((a, b) => b.month.localeCompare(a.month));
  return rows[0]?.amount ?? employee.rentSupport;
}

/** Kritik bordro kalemleri (Mayıs kira vb.) bootstrap/persist ile kaybolmaz. */
export function mergeCanonicalSalaryExtras(stored: SalaryExtra[]): SalaryExtra[] {
  const byId = new Map(stored.map((e) => [e.id, e]));
  for (const seed of initialSalaryExtras) {
    const locked = CANONICAL_RENT_BY_EXTRA_ID[seed.id];
    if (locked != null) {
      const cur = byId.get(seed.id);
      if (!cur) {
        byId.set(seed.id, { ...seed, amount: locked });
      } else if (cur.amount !== locked) {
        byId.set(seed.id, { ...cur, amount: locked, description: seed.description });
      }
      continue;
    }
    if (seed.type === "rent" && !byId.has(seed.id)) {
      byId.set(seed.id, seed);
    }
  }
  return Array.from(byId.values());
}

/**
 * Geçmişten gelen `Advance` kayıtları kullanılmıyor — Ramiz'in açık avans bakiyesi
 * `Employee.initialAdvance` ($8.000) + `SalaryExtra` türünde "deduction" satırlarıyla
 * (Nis −$2.000, May −$3.000, Tem −$3.000 · Haz kesintisiz) yönetiliyor.
 *
 * Tarihsel referans: Ramiz Nisan 2025'te $20.000 avans almıştır, $12.000'ı zaten
 * geçmiş aylarda geri ödenmiştir; sisteme yalnızca proje devri (1 Nis 2026) anındaki
 * AÇIK BAKİYE girilir, böylece carry-forward hesabı şişmez.
 */
/** Nakit avans kayıtları — Acelya avansı `initialAdvance` + bordro kesintileriyle yönetilir. */
export const initialAdvances: Advance[] = [];

/**
 * Dış Gelir firmaları — `lanetkelorkunp.xlsx - 📥 Dış Gelir.csv`.
 *
 * Önemli: Bu firmaların TAMAMI artık çalışılan firmalar değildir. Tablodaki tutarlar
 * GEÇMİŞ TOPLAM TAHSİLAT verisidir. Proje 1 Nisan 2026'da devralındığında bunlar
 * artık aktif değildi — sadece geçmiş gelir kayıtları olarak tutuluyor.
 *
 * Şu an aktif olarak tanıtım yapılan markalar `brands` koleksiyonunda
 * (Gala / Boffice / Pipo / Hit / Padi). Onlardan henüz tahsilat yapılmadı.
 */
export const initialCompanies: ExternalCompany[] = [
  // ── Tahsilat geçmişi olan firmalar (hepsi geçmişte kaldı) ──
  { id: "co-trbet", name: "TRbet", category: "Website+SosyalMedya+Telegram", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-03-20", notes: "Toplam $32.000 tahsil edildi (8 ay)", monthlyBreakdown: [0,0,4000,4000,0,0,4000,4000,4000,4000,4000,4000] },
  { id: "co-atlasbet", name: "Atlasbet", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-12-31", notes: "Aralık 2025 · $12.500 tek seferlik tahsilat" },
  { id: "co-betplay", name: "Betplay", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-12-31", notes: "Aralık 2025 · $12.500 tek seferlik tahsilat" },
  { id: "co-mersobahis", name: "MersoBahis", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2026-01-10", notes: "Ocak 2026 · $10.000 + Temmuz 2025 $4.000 = $14.000 toplam" },
  { id: "co-amg", name: "AMG Bahis", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2026-01-12", notes: "Ocak 2026 · $10.000 tek seferlik" },
  { id: "co-betpuan", name: "Betpuan", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2026-01-21", notes: "Ocak 2026 · $12.000 tek seferlik" },
  { id: "co-mrbahis", name: "Mrbahis", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-11-04", notes: "Kasım 2025 + Ocak 2026 · toplam $9.000" },
  { id: "co-betra", name: "Betra", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2026-02-09", notes: "Şubat 2026 · $14.000 tek seferlik" },
  { id: "co-netbahis", name: "Netbahis", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2026-02-09", notes: "Şubat 2026 · anlaşma kayıtlı, ödeme yok" },
  { id: "co-maxwin", name: "Maxwin", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2026-02-10", notes: "Şubat 2026 · $10.000 tek seferlik" },
  { id: "co-exonbet", name: "Exonbet", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2026-02-22", notes: "Şubat 2026 · $10.000 tek seferlik" },
  { id: "co-dbbet", name: "DBbet", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2026-03-03", notes: "Mart 2026 · $10.000 tek seferlik" },
  { id: "co-eypbet", name: "Eypbet", category: "Tişört Tanıtım (Website)", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2026-03-27", notes: "Mart 2026 · $6.000 tek seferlik" },

  // ── Sona eren eski anlaşmalar ──
  { id: "co-betcom", name: "Betcom", category: "Website+SosyalMedya+Telegram+Youtube", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-03-14", notes: "Mart 2025 · $45.000 (tek seferlik) · sona erdi" },
  { id: "co-madridbet", name: "Madridbet", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-07-18", notes: "Tem-Eki 2025 · $29.000 · sona erdi" },
  { id: "co-pusulabet", name: "Pusulabet", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-04-02", notes: "Nis-Eki 2025 · $27.700 · sona erdi" },
  { id: "co-pasacasino", name: "PasaCasino", category: "Website VIP", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-07-21", notes: "Tem-Ağu 2025 · $27.000 · sona erdi" },
  { id: "co-ganobet", name: "Ganobet", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-10-03", notes: "Eki-Kas 2025 · $11.500 · sona erdi" },
  { id: "co-grandpashabet", name: "Grandpashabet", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-04-01", notes: "Nis-Tem 2025 · $10.000 · sona erdi" },
  { id: "co-truvabet", name: "Truvabet", category: "Website+Video", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-09-17", notes: "Eylül 2025 · $10.000 · sona erdi" },
  { id: "co-betovis", name: "Betovis", category: "Website+Video", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-09-21", notes: "Eylül 2025 · $10.000 · sona erdi" },
  { id: "co-mistycasino", name: "MistyCasino", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-06-26", notes: "Haz-Tem 2025 · $9.000 · sona erdi" },
  { id: "co-betci", name: "Betci", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-08-29", notes: "Ağustos 2025 · $7.000 · sona erdi" },
  { id: "co-cassinox", name: "Cassinox", category: "Website+SosyalMedya+Telegram", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-12-20", notes: "Aralık 2025 · $6.500 · sona erdi" },
  { id: "co-bettilt", name: "Bettilt", category: "Website+SosyalMedya+Telegram", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-03-20", notes: "Mart 2025 · $5.000 · sona erdi" },
  { id: "co-nycbahis", name: "NYC Bahis", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-05-04", notes: "Mayıs 2025 · $5.000 · sona erdi" },
  { id: "co-moldebet", name: "Moldebet", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-10-19", notes: "Ekim 2025 · $5.000 · sona erdi" },
  { id: "co-endorphina", name: "Endorphina", category: "Oyun Tanıtımı", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-04-22", notes: "Nis-May 2025 · $4.500 · sona erdi" },
  { id: "co-casibom", name: "Casibom", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-08-02", notes: "Ağustos 2025 · $3.500 · sona erdi" },
  { id: "co-oynacasino", name: "Oynacasino", category: "Website", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-09-26", notes: "Eylül 2025 · $3.499 · sona erdi" },
  { id: "co-mariobet", name: "Mariobet", category: "Website+SosyalMedya", monthlyAmount: 0, contactPerson: "", status: "ended", startDate: "2025-03-14", notes: "Mart 2025 anlaşma · ödeme yok · sona erdi" },
];

/** CSV "Tarih Bazlı Tüm Sponsor İşlemleri" — Ramiz Bey döneminde tahsil edilen ödemeler. */
export const initialSponsorTransactions: SponsorTransaction[] = [
  { id: "t01", date: "2025-03-14", companyName: "Betcom",        service: "Website+SosyalMedya+Telegram+Youtube", amount: 45000, status: "ended",  txid: "98acbd6e6f928b90518994eeae100d2f33930b6594a62a130088b30f3b24ab2f" },
  { id: "t07", date: "2025-03-20", companyName: "TRbet",         service: "Website+SosyalMedya+Telegram",         amount:  4000, status: "active", txid: "9ce4317c670265fa967a2580864e694fa3928f52e191bdb1392d5b00b00c861e" },
  { id: "t08", date: "2025-03-20", companyName: "Bettilt",       service: "Website+SosyalMedya+Telegram",         amount:  5000, status: "ended",  txid: "0eaa847d329e3bf8795b73f8a3bba2ac30cb48d94fab4a9670b25f04d7652125" },
  { id: "t09", date: "2025-04-01", companyName: "Grandpashabet", service: "Website",                              amount:  4000, status: "ended",  txid: "49d7fd20c60d3c57b6309c577eed0e7d41821bb2833ea4b099e69cb2bd74b1da" },
  { id: "t10", date: "2025-04-02", companyName: "Pusulabet",     service: "Website",                              amount:  5000, status: "ended",  txid: "3a736e613300c664dd4fa9e9b34220a2ea7155df3195ec4409390c25b1e36397" },
  { id: "t11", date: "2025-04-22", companyName: "Endorphina",    service: "Oyun Tanıtımı",                        amount:  2500, status: "ended",  txid: "187852e84873c1239b808d8a26bf3ec0802a805e38b6cc931e504d386fd464ce" },
  { id: "t12", date: "2025-04-23", companyName: "TRbet",         service: "Website+SosyalMedya+Telegram",         amount:  4000, status: "active", txid: "a8afe956484455b7253efe56df0cf614b365e564502688aeec469fafb1d1a162" },
  { id: "t13", date: "2025-05-02", companyName: "Grandpashabet", service: "Website",                              amount:  4000, status: "ended",  txid: "e880e4200fe94840d7b3730ff67770cabaaab31e96735af1ee5c7c5272f0d532" },
  { id: "t14", date: "2025-05-04", companyName: "NYC Bahis",     service: "Website",                              amount:  5000, status: "ended",  txid: "83376b4ae4ccaab14cceab982bfff8d9cccf3174d8bcc51057268fc723d31b50" },
  { id: "t15", date: "2025-05-10", companyName: "Pusulabet",     service: "Website",                              amount:  5000, status: "ended",  txid: "73a05c9ee79b7fc5f5abc3c4d371c77676b1906a6c1363df61288bbb001453c9" },
  { id: "t16", date: "2025-05-19", companyName: "Endorphina",    service: "Oyun Tanıtımı",                        amount:  2000, status: "ended",  txid: "4f99ea045733e9ac325b15fff144bd09e4a16976fd8fd9f19207a2d1af76615a" },
  { id: "t17", date: "2025-06-12", companyName: "Pusulabet",     service: "Website",                              amount:  5000, status: "ended",  txid: "00133a0ef63802bbe4463da4b7ba91ff53bb3ac3ac4c44435628b94b3744a109" },
  { id: "t18", date: "2025-06-26", companyName: "MistyCasino",   service: "Website",                              amount:  6000, status: "ended",  txid: "a1961aca5148cd9f3f1c72831020fca51525e09a3dd217143c9146548c20d942" },
  { id: "t19", date: "2025-07-02", companyName: "MersoBahis",    service: "Website",                              amount:  4000, status: "active", txid: "6a8335a46efe0aaa38b56cc4325fb89f1120f49e4bee4494d20915456e7e5457" },
  { id: "t20", date: "2025-07-07", companyName: "TRbet",         service: "Website+SosyalMedya+Telegram",         amount:  4000, status: "active", txid: "fa53e8d0d78182be20e81278457e64ff8c4c63b0442c90ec9a3f3042b3b0c15b" },
  { id: "t21", date: "2025-07-12", companyName: "Grandpashabet", service: "Website",                              amount:  2000, status: "ended",  txid: "fc8b70356ca3d1fb0c89ba838ddda4099fa4cc430f968ab3ef12c50062882759" },
  { id: "t22", date: "2025-07-14", companyName: "Pusulabet",     service: "Website",                              amount:  3500, status: "ended",  txid: "e39f54f30dc281a30627ba2751c155deac597adcb3cfb6fa3edbaa0154209ddd" },
  { id: "t23", date: "2025-07-18", companyName: "Madridbet",     service: "Website",                              amount:  4000, status: "ended",  txid: "9414cea5d7792552d13b45c5e7027aa30c4313b3f4db69c60380d41f99b2a2c6" },
  { id: "t24", date: "2025-07-21", companyName: "PasaCasino",    service: "Website VIP",                          amount: 17000, status: "ended",  txid: "13318aa404f19e903d2314cb24ab652d244c84c1249e0846eeb0cd641f9ca849" },
  { id: "t28", date: "2025-07-28", companyName: "MistyCasino",   service: "Website",                              amount:  3000, status: "ended",  txid: "8627a35e5fb7e82235f487fdc9e82118ea9c75c19d8c9d444ec46766f6fab13b" },
  { id: "t29", date: "2025-08-02", companyName: "Casibom",       service: "Website",                              amount:  3500, status: "ended",  txid: "ed7205556777479dfd7bae54ed840d29839c33efe1f6ab6d8de157c86e972e4a" },
  { id: "t30", date: "2025-08-08", companyName: "TRbet",         service: "Website+SosyalMedya+Telegram",         amount:  4000, status: "active", txid: "4866444c77b8ff4e293a463f637c2085169f7a56f85cab8c3e77e7d04e4a7916" },
  { id: "t31", date: "2025-08-14", companyName: "Pusulabet",     service: "Website",                              amount:  3200, status: "ended",  txid: "1de76fc0c6cb6cc2a0678188fb681fb2e37a2f3a6400fce1113996ee3fb54022" },
  { id: "t32", date: "2025-08-28", companyName: "Madridbet",     service: "Website",                              amount:  6000, status: "ended",  txid: "164884b0ccdd8aac490e1d8c3b66f09567e63dd0ae1b5959365e7471b76d14a0" },
  { id: "t34", date: "2025-08-28", companyName: "PasaCasino",    service: "Website VIP",                          amount: 10000, status: "ended",  txid: "de154cd3f9174408df85474d007d0a7eb77d11f1fe2b740dd29adbe0545e240c" },
  { id: "t38", date: "2025-08-29", companyName: "Betci",         service: "Website",                              amount:  7000, status: "ended",  txid: "a7ec9308a9a06440fd2855d5ca5d79f1f129e1f232ec8c115690bc71a0d216bd" },
  { id: "t39", date: "2025-09-12", companyName: "TRbet",         service: "Website+SosyalMedya+Telegram",         amount:  4000, status: "active", txid: "8fdcd7a7d5fe6e08228c7bf5c1c56e4daaa1269a35f6967e08579968bbfd541d" },
  { id: "t40", date: "2025-09-17", companyName: "Truvabet",      service: "Website+Video",                        amount: 10000, status: "ended",  txid: "7c4c862bedabeb178a2312d5a5c7f21228415323512d6b7d6dce3c822ce18f89" },
  { id: "t41", date: "2025-09-17", companyName: "Pusulabet",     service: "Website",                              amount:  3000, status: "ended",  txid: "9c901fd7e78d509269b9031a6c504180ec373d97b0b95215b8dfbcb24a88595d" },
  { id: "t42", date: "2025-09-21", companyName: "Betovis",       service: "Website+Video",                        amount: 10000, status: "ended",  txid: "2c9b7e697b70ce4820b3e5f18fb7f868e29d0c1944c1f53717e22f633bc42992" },
  { id: "t43", date: "2025-09-26", companyName: "Oynacasino",    service: "Website",                              amount:  3499, status: "ended",  txid: "1774297a200e21f91b0c3d5877a5dba66316a7a83c5f8866295217d72697843b" },
  { id: "t44", date: "2025-10-03", companyName: "Ganobet",       service: "Website",                              amount:  6500, status: "ended",  txid: "b575c691c8f817201518571046614d8545e2f997ba16f0e45e807c2bd932e151" },
  { id: "t45", date: "2025-10-15", companyName: "TRbet",         service: "Website+SosyalMedya+Telegram",         amount:  4000, status: "active", txid: "1d0afdef17d62755535977baa523d1bb663ba91d5d9d0b40219bff8f6f53d9a7" },
  { id: "t46", date: "2025-10-19", companyName: "Moldebet",      service: "Website",                              amount:  5000, status: "ended",  txid: "7706163689160a3c21caab28df373cda4748ec445fdc8725d8e2cd5139198c53" },
  { id: "t47", date: "2025-10-22", companyName: "Pusulabet",     service: "Website",                              amount:  3000, status: "ended",  txid: "2dab61b0e733228e249926ee93fc2a73e86ebca9cb168ef95e7f616f9eab9dc7" },
  { id: "t48", date: "2025-10-22", companyName: "Madridbet",     service: "Website",                              amount:  9500, status: "ended",  txid: "6c7a24a7a346bd54d4e9b11dccd5b43043831317ce1a6e56b43cd2ea584e0022" },
  { id: "t50", date: "2025-11-03", companyName: "Ganobet",       service: "Website",                              amount:  5000, status: "ended",  txid: "238ad40ec2c3dbda7e1272a604665c905c47c26a7606b09c1bdd0687b364e1de" },
  { id: "t51", date: "2025-11-04", companyName: "Mrbahis",       service: "Website",                              amount:  4500, status: "active", txid: "a49d3d739afa85a5a5e2b57178b6acc5336505324168bf835c1c75e760102f1e" },
  { id: "t52", date: "2025-11-26", companyName: "TRbet",         service: "Website+SosyalMedya+Telegram",         amount:  4000, status: "active", txid: "448d68841e1d2e0ec4801c48754d76e1f9f6739a2f55fd951bc0de895cc42aa3" },
  { id: "t53", date: "2025-11-26", companyName: "Madridbet",     service: "Website",                              amount:  9500, status: "ended",  txid: "c8886431784cb1975093edc869289677c20c9f7ea6d6b02499978dbfe33ffe5f" },
  { id: "t55", date: "2025-12-20", companyName: "Cassinox",      service: "Website+SosyalMedya+Telegram",         amount:  6500, status: "ended",  txid: "f540ef2741e8653258f60d1fcf33284b1ed100a1364b6a2a025f912e296d5db8" },
  { id: "t56", date: "2025-12-29", companyName: "TRbet",         service: "Website+SosyalMedya+Telegram",         amount:  4000, status: "active", txid: "a30178ffeb64963866b47abf518dd1d4550eed66c4b60d3c1b94656036501ee9" },
  { id: "t57", date: "2025-12-31", companyName: "Atlasbet",      service: "Website",                              amount: 12500, status: "active", txid: "ad0176be612c6b8ea0bef09ec5a4205a9039a36eac3ccc88988028d3c26d532a" },
  { id: "t58", date: "2025-12-31", companyName: "Betplay",       service: "Website",                              amount: 12500, status: "active", txid: "cc03e167055766be06d32da1f58cd8fc25913c8eed6f9a2b239ea81b0bb1d359" },
  { id: "t59", date: "2026-01-10", companyName: "MersoBahis",    service: "Website",                              amount: 10000, status: "active", txid: "34495c6d646eac6a01613c9bd3ea0e6eac11585cbc79ee4cf506eb09d2624b46" },
  { id: "t60", date: "2026-01-12", companyName: "AMG Bahis",     service: "Website",                              amount: 10000, status: "active", txid: "2d2f73b1b2a504f4c3b884a5f0e63102a8d9a9a7ab2da0cdd0cc6e7972a7cf75" },
  { id: "t61", date: "2026-01-21", companyName: "Betpuan",       service: "Website",                              amount: 12000, status: "active", txid: "3cc95894572d5d4deb7445fe1cc56599f49f7e20d86f27fe34fc3bc7ac23a4f1" },
  { id: "t62", date: "2026-01-28", companyName: "Mrbahis",       service: "Website",                              amount:  4500, status: "active", txid: "3a60b7c913fc44f82fd82aeaed62c31f496c5f78b9495939e4978f7a3c82a71a" },
  { id: "t63", date: "2026-02-09", companyName: "Betra",         service: "Website",                              amount: 14000, status: "active", txid: "27c312ee6f66b36ab4485ce590729d539ad9095d58519984439902a71c892e0c" },
  { id: "t65", date: "2026-02-10", companyName: "Maxwin",        service: "Website",                              amount: 10000, status: "active", txid: "41abaa2b7794dcc607cb00205eb3be5a222270d35ea8ff918e943f0a7851fb15" },
  { id: "t66", date: "2026-02-22", companyName: "Exonbet",       service: "Website",                              amount: 10000, status: "active", txid: "41539ee162ee25a29b2ead22e77bfa4a5dcd10d6e66770b27c4c8c26d31e5319" },
  { id: "t67", date: "2026-03-03", companyName: "DBbet",         service: "Website",                              amount: 10000, status: "active", txid: "c213da229a9c4dc1b20404ac50f4f70c70985eccf1ac70d800b2944d6e565319" },
  { id: "t68", date: "2026-03-27", companyName: "Eypbet",        service: "Tişört Tanıtım (Website)",             amount:  6000, status: "active", txid: "2ecd80060c064e3d589cbb8a97ded10085319bd5858ad2baf4365456958e7678" },
];

/** Eski sürümdeki örnek projeler — persist migrate ile temizlenir (bkz. merge). */
const LEGACY_IC_GELIR_SEED_IDS = new Set(["p1", "p2", "p3", "p4", "p5"]);

const initialProjects: InternalProject[] = [];
const initialProjectPayments: InternalProjectPayment[] = [];

function defaultProjectFields(
  p: Partial<InternalProject> & Pick<InternalProject, "name" | "category" | "monthlyRevenue" | "progress" | "status" | "startDate" | "notes">
): Omit<InternalProject, "id"> {
  return {
    name: p.name,
    category: p.category,
    monthlyRevenue: p.monthlyRevenue,
    progress: p.progress,
    status: p.status,
    startDate: p.startDate,
    notes: p.notes,
    brandId: p.brandId,
    employeeIds: p.employeeIds ?? [],
    paymentDay: p.paymentDay ?? "",
    reminderEnabled: p.reminderEnabled ?? true,
    reminderDaysBefore: p.reminderDaysBefore ?? 3,
    lastReminderSentAt: p.lastReminderSentAt,
  };
}

const initialExpenses: ExpenseEntry[] = [
  { id: "x1", category: "Yazılım & Araçlar", amount: 400,  date: "2026-01-01", description: "SaaS abonelikleri" },
  { id: "x2", category: "Sunucu & Altyapı",  amount: 300,  date: "2026-01-01", description: "Hosting & CDN" },
  { id: "x3", category: "Ofis & Kira",       amount: 300,  date: "2026-01-01", description: "Ofis kirası" },
  { id: "x4", category: "Pazarlama Gideri",  amount: 200,  date: "2026-01-01", description: "Reklam harcamaları" },
  { id: "x5", category: "Hukuki & Mali",     amount: 117,  date: "2026-01-01", description: "Muhasebe & hukuk" },
];

const initialPlanned: PlannedItem[] = [
  { id: "pl1", name: "Yeni İçerik Stüdyosu", category: "capex", budget: 50000, spent: 12000, startDate: "2026-06-01", targetDate: "2026-09-01", priority: "high", status: "planned", notes: "", employeeId: "emp-ramiz", isRecurring: false, recurrence: "none" },
  { id: "pl2", name: "Mobil Uygulama Geliştir.", category: "capex", budget: 35000, spent: 18000, startDate: "2026-03-01", targetDate: "2026-08-01", priority: "high", status: "in-progress", notes: "", isRecurring: false, recurrence: "none" },
  { id: "pl3", name: "AI İçerik Araçları", category: "opex", budget: 20000, spent: 8500, startDate: "2026-01-01", targetDate: "2026-07-01", priority: "medium", status: "in-progress", notes: "", isRecurring: true, recurrence: "monthly" },
  { id: "pl4", name: "Uluslararası Genişleme", category: "growth", budget: 80000, spent: 0, startDate: "2026-09-01", targetDate: "2026-12-01", priority: "high", status: "planned", notes: "", isRecurring: false, recurrence: "none" },
  { id: "pl5", name: "CDN Altyapı Yükseltme", category: "opex", budget: 15000, spent: 15000, startDate: "2026-02-01", targetDate: "2026-04-01", priority: "low", status: "completed", notes: "", isRecurring: false, recurrence: "none" },
  { id: "pl6", name: "Yeni İşe Alımlar (x3)", category: "opex", budget: 36000, spent: 0, startDate: "2026-08-01", targetDate: "2026-10-01", priority: "medium", status: "planned", notes: "", isRecurring: false, recurrence: "none" },
];

const initialPlannedItemPayments: PlannedItemPayment[] = [];

/** Yayıncı hesap örnekleri — kullanıcı tarafından düzenlenebilir. */
const initialStreamerAccounts: StreamerAccount[] = [
  { id: "sa-ramiz-1",  employeeId: "emp-ramiz",  platform: "YouTube",  handle: "@ramiz",   url: "https://youtube.com/@ramiz",   notes: "Ana yayın kanalı",   status: "active" },
  { id: "sa-ramiz-2",  employeeId: "emp-ramiz",  platform: "Kick",     handle: "ramiz",    url: "https://kick.com/ramiz",       notes: "Canlı yayın",        status: "active" },
  { id: "sa-ramiz-3",  employeeId: "emp-ramiz",  platform: "Telegram", handle: "@ramiz",   url: "https://t.me/ramiz",           notes: "Duyuru kanalı",      status: "active" },
  { id: "sa-lucy-1",   employeeId: "emp-lucy",   platform: "Kick",     handle: "lucy",     url: "https://kick.com/lucy",        notes: "Canlı yayın",        status: "active" },
  { id: "sa-lucy-2",   employeeId: "emp-lucy",   platform: "Instagram",handle: "@lucy",    url: "https://instagram.com/lucy",   notes: "",                   status: "active" },
  { id: "sa-acelya-1", employeeId: "emp-acelya", platform: "Kick",     handle: "acebaby",  url: "https://kick.com/acebaby",     notes: "Ana yayın",          status: "active" },
  { id: "sa-acelya-2", employeeId: "emp-acelya", platform: "Instagram",handle: "@acebaby", url: "https://instagram.com/acebaby",notes: "",                   status: "active" },
];

/** Boş başlangıç — kullanıcı /izlenme sayfasından girişleri ekleyecek. */
const initialBrandViewership: BrandViewership[] = [];
const initialBrandMonthlyStats: BrandMonthlyStats[] = [];
const initialScheduleSlots: ScheduleSlot[] = [];
const initialAffiliatePartners: AffiliatePartner[] = [];
const initialAffiliateDailyStats: AffiliateDailyStat[] = [];
const initialAffiliatePayouts: AffiliatePayout[] = [];
const initialStreamerPoolProfiles: StreamerPoolProfile[] = [];
const initialBrandOffers: BrandOffer[] = [];
const initialBrandOfferMessages: BrandOfferMessage[] = [];
const initialBrandDeals: BrandDeal[] = [];
const initialBrandPosts: BrandPost[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// Organizasyon (multi-tenant) — dahili "Foxstream Ajansı"
// ─────────────────────────────────────────────────────────────────────────────
const AGENCY_ORG_ID = "org-foxstream";

export const initialOrganizations: Organization[] = [
  {
    id: AGENCY_ORG_ID,
    name: "Foxstream Ajansı",
    slug: "foxstream",
    type: "agency",
    status: "active",
    plan: "agency",
    primaryColor: "#FF6B00",
    locale: "tr",
    timezone: "Europe/Istanbul",
    defaultCurrency: "USD",
    onboardingCompleted: true,
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  },
];

export const initialOrganizationMembers: OrganizationMember[] = [
  { id: "om-u-admin", organizationId: AGENCY_ORG_ID, userId: "u-admin", orgRole: "owner", scopeAllBrands: true, title: "Yönetici", createdAt: "2026-05-15T00:00:00.000Z", updatedAt: "2026-05-15T00:00:00.000Z" },
  { id: "om-u-brand-gala",    organizationId: AGENCY_ORG_ID, userId: "u-brand-gala",    orgRole: "admin", scopeAllBrands: false, title: "Marka", brandIds: ["br-gala"],    createdAt: "2026-05-15T00:00:00.000Z", updatedAt: "2026-05-15T00:00:00.000Z" },
  { id: "om-u-brand-boffice", organizationId: AGENCY_ORG_ID, userId: "u-brand-boffice", orgRole: "admin", scopeAllBrands: false, title: "Marka", brandIds: ["br-boffice"], createdAt: "2026-05-15T00:00:00.000Z", updatedAt: "2026-05-15T00:00:00.000Z" },
  { id: "om-u-brand-pipo",    organizationId: AGENCY_ORG_ID, userId: "u-brand-pipo",    orgRole: "admin", scopeAllBrands: false, title: "Marka", brandIds: ["br-pipo"],    createdAt: "2026-05-15T00:00:00.000Z", updatedAt: "2026-05-15T00:00:00.000Z" },
  { id: "om-u-brand-hit",     organizationId: AGENCY_ORG_ID, userId: "u-brand-hit",     orgRole: "admin", scopeAllBrands: false, title: "Marka", brandIds: ["br-hit"],     createdAt: "2026-05-15T00:00:00.000Z", updatedAt: "2026-05-15T00:00:00.000Z" },
  { id: "om-u-brand-padi",    organizationId: AGENCY_ORG_ID, userId: "u-brand-padi",    orgRole: "admin", scopeAllBrands: false, title: "Marka", brandIds: ["br-padi"],    createdAt: "2026-05-15T00:00:00.000Z", updatedAt: "2026-05-15T00:00:00.000Z" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Markalar — şu an aktif olarak tanıtımı yapılan 5 marka
// ─────────────────────────────────────────────────────────────────────────────
export const initialBrands: Brand[] = [
  { id: "br-gala",    name: "Galabet",    shortName: "Gala",    category: "Bahis",  status: "active", notes: "Aktif marka · Galagrup tişört baskısı vs.", monthlyTarget: 500_000, organizationId: AGENCY_ORG_ID },
  { id: "br-boffice", name: "Betoffice",  shortName: "Boffice", category: "Bahis",  status: "active", notes: "Aktif marka · Trans kadın vlog vb. içerikler",        monthlyTarget: 400_000, organizationId: AGENCY_ORG_ID },
  { id: "br-pipo",    name: "Betpipo",    shortName: "Pipo",    category: "Bahis",  status: "active", notes: "Aktif marka · Vlog ve yetişkin içerik bölümleri",     monthlyTarget: 500_000, organizationId: AGENCY_ORG_ID },
  { id: "br-hit",     name: "Hitbet",     shortName: "Hit",     category: "Bahis",  status: "active", notes: "Aktif marka · Hayvanat bahçesi vlogu, yetişkin içerik", monthlyTarget: 400_000, organizationId: AGENCY_ORG_ID },
  { id: "br-padi",    name: "Padişahbet", shortName: "Padi",    category: "Bahis",  status: "active", notes: "Aktif marka · Muay thai, ocakbaşı, yetişkin içerik",   monthlyTarget: 500_000, organizationId: AGENCY_ORG_ID },
];

/**
 * Her marka için platform link slot'ları — kullanıcı handle/URL'i sonradan dolduracak.
 * Bu placeholder'lar otomatik takip için altyapı sağlar.
 */
export const initialBrandLinks: BrandLink[] = (() => {
  const platforms: Array<{ platform: string; sample: string }> = [
    { platform: "Instagram", sample: "https://instagram.com/" },
    { platform: "Kick",      sample: "https://kick.com/" },
    { platform: "TikTok",    sample: "https://tiktok.com/@" },
    { platform: "YouTube",   sample: "https://youtube.com/@" },
  ];
  const links: BrandLink[] = [];
  initialBrands.forEach((b) => {
    platforms.forEach((p) => {
      links.push({
        id: `bl-${b.id}-${p.platform.toLowerCase()}`,
        brandId: b.id,
        platform: p.platform,
        handle: "",
        url: "",
        status: "active",
        notes: "Handle/URL girilince otomatik takip aktifleşir",
        autoTrack: true,
      });
    });
  });
  return links;
})();

const initialLinkSnapshots: LinkSnapshot[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// Kasa — Denetim grubuna iletilen tüm para giriş/çıkışları
// Kaynak: Telegram grubu mesaj kayıtları (27 Nisan 2026'dan başlayarak)
// ─────────────────────────────────────────────────────────────────────────────
/** Varsayılan kasa id'si — migrasyonda Supabase tarafında da aynı id kullanılır. */
export const DEFAULT_KASA_ID = "kasa-genel";

export const initialKasas: Kasa[] = [
  {
    id: DEFAULT_KASA_ID,
    name: "Genel Kasa",
    kind: "general",
    currency: "USD",
    isDefault: true,
    archived: false,
    orderIndex: 0,
    notes: "Varsayılan kasa. Henüz başka bir kasa açılmadıysa tüm hareketler buraya bağlanır.",
  },
  {
    id: "kasa-tron",
    name: "TRON USDT cüzdan",
    kind: "usdt",
    currency: "USD",
    isDefault: false,
    archived: false,
    orderIndex: 90,
    notes: "TronGrid otomatik çekim için ayrılmış kasa. Manuel kasa bakiyesi etkilenmez.",
    tronAddress: process.env.NEXT_PUBLIC_TRON_KASA_ADDRESS ?? "",
    tronSyncFrom: "2025-04-01",
  },
];

export const initialKasaTransactions: KasaTransaction[] = [
  { id: "ka-01", kasaId: DEFAULT_KASA_ID, date: "2026-04-27T16:41", direction: "in",  amountUsd:  681, feeUsd: 0, purpose: "Kasa devir alındı (proje devri)",            counterparty: "Proje öncesi bakiye",      proof: "", notes: "Foxstream Medya Grubu / Faturalar sekmesi" },
  { id: "ka-02", kasaId: DEFAULT_KASA_ID, date: "2026-04-28T16:16", direction: "in",  amountUsd: 5000, feeUsd: 0, purpose: "Kasaya transfer girişi",                       counterparty: "Şirket havalesi",         proof: "2f7c8ebabf81a9a6476cbade594d08ad0db8275152ec3f4e776085e49cc29402", notes: "TronScan TX · 5.000 USDT" },
  { id: "ka-03", kasaId: DEFAULT_KASA_ID, date: "2026-04-28T17:34", direction: "out", amountUsd:  300, feeUsd: 4, purpose: "Galagrup tişört baskısı",                       counterparty: "Lucy",                    proof: "", notes: "Kasa: 5.681 → 5.377 USDT (300 + 4 fee)" },
  { id: "ka-04", kasaId: DEFAULT_KASA_ID, date: "2026-04-28T21:12", direction: "out", amountUsd: 2000, feeUsd: 4, purpose: "Acelya bilet + ekstra giderler",               counterparty: "Acelya",                  proof: "", notes: "Yeni yayıncı bilet harcama tutarı · yol desteği. Kasa: 5.377 → 3.373" },
  { id: "ka-05", kasaId: DEFAULT_KASA_ID, date: "2026-04-30T14:49", direction: "out", amountUsd:  800, feeUsd: 4, purpose: "Konaklama / havaalanı transferi / elzem",      counterparty: "Operasyon",               proof: "", notes: "Kasa: 3.373 → 2.569 USDT" },
  { id: "ka-06", kasaId: DEFAULT_KASA_ID, date: "2026-05-01T09:27", direction: "out", amountUsd:  500, feeUsd: 0, purpose: "1 Mayıs harçlık (5 kişi)",                     counterparty: "Açelya/Lucy/Karo/Ramiz/Ege", proof: "", notes: "Açelya $100, Lucy $100, Karo $100, Ramiz $100, Ege $80 (önceden $20 vardı). 5×$4 zincir ücreti harçlık transferlerine dahil; kasa net −500 USDT. Kasa: 2.569 → 2.069 USDT" },
  { id: "ka-07", kasaId: DEFAULT_KASA_ID, date: "2026-05-04T09:47", direction: "out", amountUsd:  900, feeUsd: 5, purpose: "Acelya bagaj ücreti",                          counterparty: "Acelya",                  proof: "", notes: "Kasa: 2.069 → 1.164 USDT" },
  { id: "ka-08", kasaId: DEFAULT_KASA_ID, date: "2026-05-04T11:32", direction: "out", amountUsd:  500, feeUsd: 4, purpose: "Lucy aylık maaş ödemesi (kısmi)",              counterparty: "Lucy",                    proof: "https://teamzone.gyazo.com/c53d91ab8f64767362bf8d777c683119", notes: "Grup mesajı talimatı · Lucy cüzdan adresi" },
  { id: "ka-09", kasaId: DEFAULT_KASA_ID, date: "2026-05-04T11:32", direction: "out", amountUsd:  200, feeUsd: 4, purpose: "Acelya doğum günü hediyesi",                   counterparty: "Acelya",                  proof: "", notes: "Grup mesajı talimatı · Acelya cüzdan adresi · Kasa: 1.164 → 456 USDT (500+200+8 fee)" },
  { id: "ka-10", kasaId: DEFAULT_KASA_ID, date: "2026-05-06T16:13", direction: "out", amountUsd:   20, feeUsd: 0, purpose: "Telegram Premium (foxstreamkaro)",              counterparty: "Karo (Telegram)",         proof: "", notes: "HongKong Doları · tutar tahmini · Kasa: 456 → 436 USDT" },
  { id: "ka-11", kasaId: DEFAULT_KASA_ID, date: "2026-05-08T12:47", direction: "out", amountUsd:  170, feeUsd: 3, purpose: "Çekim ve edit ücreti",                         counterparty: "Lucy",                    proof: "", notes: "Kasa: 436 → 263 USDT" },
  { id: "ka-12", kasaId: DEFAULT_KASA_ID, date: "2026-05-11T20:42", direction: "out", amountUsd:  100, feeUsd: 0, purpose: "Stake döviz — TRX alımı (transfer ödemeleri için)", counterparty: "TRX cüzdan",              proof: "", notes: "~100 USDT karşılığı TRX · Kasa: 263 → 163 USDT" },
];

/**
 * Eski kayıtlarda ka-06 için 20 USD fee yanlışlıkla kasadan düşüyordu; net −500
 * olmalı (163 güncel bakiye). Ayrıca yeni `kasaId` alanı eksik olabilir; eksikse
 * varsayılan kasaya bağlanır.
 */
function migrateKasaTransactions(txns: KasaTransaction[]): KasaTransaction[] {
  return txns.map((t) => {
    let next = t.kasaId ? t : { ...t, kasaId: DEFAULT_KASA_ID };
    if (next.id === "ka-06" && next.feeUsd === 20) {
      next = {
        ...next,
        feeUsd: 0,
        notes:
          "Açelya $100, Lucy $100, Karo $100, Ramiz $100, Ege $80 (önceden $20 vardı). 5×$4 zincir ücreti harçlık transferlerine dahil; kasa net −500 USDT. Kasa: 2.569 → 2.069 USDT",
      };
    }
    return next;
  });
}
// ─────────────────────────────────────────────────────────────────────────────
// İçerik harcamaları — Ramiz Nisan 2026 raporu (29.04.2026 grup mesajı)
// Toplam $13.095 — 1 Mayıs 2026'da ödendi ve onaylandı
// ─────────────────────────────────────────────────────────────────────────────
const RAMIZ_APR_BASE = {
  date: "2026-04-29",
  month: "2026-04",
  employeeId: "emp-ramiz",
  paid: true,
  paidDate: "2026-05-01",
  submittedAt: "2026-04-29T17:56",
  submittedBy: "u-ramiz",
  reviewStatus: "approved" as const,
  reviewedAt: "2026-04-30T10:00",
  reviewedBy: "u-admin",
  reviewerNote: "Tüm kalemler onaylandı, 1 Mayıs ödemesinde tahsil edildi.",
  audited: false,
};

export const initialContentExpenses: ContentExpense[] = [
  { ...RAMIZ_APR_BASE, id: "ce-r-01", brandId: "br-padi",    brandName: "Padi",    category: "Vlog",            description: "Muay thai vlogu · mekan, aksesuar, yol dahil",          amountUsd:  154, amountThb:  5000, notes: "" },
  { ...RAMIZ_APR_BASE, id: "ce-r-02", brandId: "br-pipo",    brandName: "Pipo",    category: "Vlog",            description: "Dünyanın en tuhaf yemeklerini yedim · genel giderler", amountUsd:  123, amountThb:  4000, notes: "" },
  { ...RAMIZ_APR_BASE, id: "ce-r-03", brandId: "br-padi",    brandName: "Padi",    category: "Yetişkin İçerik", description: "Üvey şıllık · kameraman + yemek (1.400 baht + $500)",  amountUsd:  543, amountThb:  1400, notes: "$500 + 1.400 baht ($43) = $543" },
  { ...RAMIZ_APR_BASE, id: "ce-r-04",                       brandName: "Siteler", category: "Site Videoları",  description: "5 video çekimi · kıza verilen ücret",                  amountUsd:   31, amountThb:  1000, notes: "" },
  { ...RAMIZ_APR_BASE, id: "ce-r-05", brandId: "br-hit",     brandName: "Hit",     category: "Vlog",            description: "Hayvanat bahçesi vlogu (Bangkok) · taksi dahil",        amountUsd:  368, amountThb: 12000, notes: "" },
  { ...RAMIZ_APR_BASE, id: "ce-r-06", brandId: "br-gala",    brandName: "Gala",    category: "Vlog",            description: "Songkran bölümü",                                       amountUsd:   77, amountThb:  2500, notes: "" },
  { ...RAMIZ_APR_BASE, id: "ce-r-07", brandId: "br-pipo",    brandName: "Pipo",    category: "Yetişkin İçerik", description: "POWER NECMİ bölümü",                                    amountUsd:  531, amountThb:     0, notes: "" },
  { ...RAMIZ_APR_BASE, id: "ce-r-08",                       brandName: "Siteler", category: "Site Videoları",  description: "5 video çekimi (2. parti)",                             amountUsd:   31, amountThb:  1000, notes: "" },
  { ...RAMIZ_APR_BASE, id: "ce-r-09", brandId: "br-boffice", brandName: "Boffice", category: "Vlog",            description: "Trans kadın vlog",                                      amountUsd:  153, amountThb:  5000, notes: "" },
  { ...RAMIZ_APR_BASE, id: "ce-r-10", brandId: "br-padi",    brandName: "Padi",    category: "Vlog",            description: "OCAKBAŞI vlogu",                                        amountUsd:   77, amountThb:  2500, notes: "" },
  { ...RAMIZ_APR_BASE, id: "ce-r-11", brandId: "br-gala",    brandName: "Gala",    category: "Yetişkin İçerik", description: "Uzaktan kumanda bölümü",                                amountUsd:  531, amountThb:     0, notes: "" },
  { ...RAMIZ_APR_BASE, id: "ce-r-12",                       brandName: "Siteler", category: "Site Videoları",  description: "5 video çekimi (3. parti)",                             amountUsd:   31, amountThb:  1000, notes: "" },
  { ...RAMIZ_APR_BASE, id: "ce-r-13", brandId: "br-pipo",    brandName: "Pipo",    category: "Vlog",            description: "Sıra gecesi vlogu",                                     amountUsd:  245, amountThb:  8000, notes: "" },
  { ...RAMIZ_APR_BASE, id: "ce-r-14", brandId: "br-hit",     brandName: "Hit",     category: "Yetişkin İçerik", description: "Yetişkin içeriği bölümü",                                amountUsd:  500, amountThb:     0, notes: "" },
  { ...RAMIZ_APR_BASE, id: "ce-r-15",                       brandName: "Reklam",  category: "Reklam",          description: "3 vlog için reklam çıkıldı",                            amountUsd:  300, amountThb:     0, notes: "" },
];

/** Ramiz Nisan 2026 raporu (ce-r-01 … ce-r-15) — persist/bootstrap ile silinmez. */
export function mergeCanonicalContentExpenses(
  stored: ContentExpense[],
): ContentExpense[] {
  const byId = new Map<string, ContentExpense>();
  for (const row of stored) byId.set(row.id, row);
  for (const seed of initialContentExpenses) {
    if (!byId.has(seed.id)) byId.set(seed.id, seed);
  }
  return Array.from(byId.values());
}

// Boş başlangıç — yayıncı kullanıcıları kendi planlarını ekleyecek.
const initialWeeklyPlans: WeeklyPlan[] = [];
const initialWeekBrandReels: WeekBrandReel[] = [];
const initialNotifications: AppNotification[] = [];

/**
 * Ödeme durumları (gerçekleşen ödemeler).
 * - Ramiz Nisan 2026: 1 Mayıs 2026 net $8.000 (Telegram: "Bu ay yatacak olan maaş tutarı: 8 bin $").
 * - Lucy Nisan 2026: nakit ödendi 30 Nisan 2026 — $3.000 maaş + $500 kira + $1.600 telefon desteği.
 * - Lucy Mayıs 2026: plan geçişi · 1 Haziran 2026 net $2.000 (yarım dönem).
 */
export const initialPaymentStatuses: MonthPaymentStatus[] = [
  { employeeId: "emp-ramiz", month: "2026-04", paid: true, paidDate: "2026-05-01" },
  { employeeId: "emp-lucy",  month: "2026-04", paid: true, paidDate: "2026-04-30" },
  // Mayıs plan geçişi: yarım maaş ($1.500) ödendi · kira ($500) bekliyor.
  {
    employeeId: "emp-lucy",
    month: "2026-05",
    paid: false,
    linePayments: [
      {
        lineId: "base",
        kind: "base_salary",
        label: "Temel maaş",
        amountUsd: 1500,
        paid: true,
        paidDate: "2026-06-01",
      },
    ],
  },
];

/** Eski tam-ödendi kayıtlarını kalem bazlı kısmi ödemeye yükseltir (Lucy Mayıs 2026). */
export function mergeCanonicalPaymentStatuses(
  stored: MonthPaymentStatus[],
): MonthPaymentStatus[] {
  const lucyMayPartial: MonthPaymentStatus = {
    employeeId: "emp-lucy",
    month: "2026-05",
    paid: false,
    linePayments: [
      {
        lineId: "base",
        kind: "base_salary",
        label: "Temel maaş",
        amountUsd: 1500,
        paid: true,
        paidDate: "2026-06-01",
      },
    ],
  };
  const idx = stored.findIndex(
    (p) => p.employeeId === "emp-lucy" && p.month === "2026-05",
  );
  if (idx < 0) {
    const hasLucyMay = initialPaymentStatuses.some(
      (p) => p.employeeId === "emp-lucy" && p.month === "2026-05",
    );
    return hasLucyMay ? [...stored, lucyMayPartial] : stored;
  }
  const existing = stored[idx];
  if (existing.paid && !(existing.linePayments?.length)) {
    const next = [...stored];
    next[idx] = lucyMayPartial;
    return next;
  }
  return stored;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: kira propagasyonu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `Employee.rentSupport` her değiştiğinde tip="rent" salaryExtras kayıtlarını
 * verilen aydan itibaren 12 aylık ufka kadar otomatik senkronlar:
 * - Mevcut kayıtların `amount` değeri güncellenir (description korunur).
 * - Eksik aylar için yeni kayıt üretilir (id deterministik).
 * - `amount === 0` ise ilgili aralıktaki kira kayıtları silinir.
 *
 * Önemli: `fromMonth < payrollStartMonth` ise propagasyon `payrollStartMonth`
 * itibarıyla başlar (bordro dışı aylara kira yazılmaz).
 */
export function propagateRentForEmployee(
  salaryExtras: SalaryExtra[],
  employee: Employee,
  amount: number,
  fromMonth: string
): SalaryExtra[] {
  const effectiveFrom = ymGte(fromMonth, employee.payrollStartMonth)
    ? fromMonth
    : employee.payrollStartMonth;

  const horizonMonths: string[] = [];
  const [y0, m0] = effectiveFrom.split("-").map(Number);
  for (let i = 0; i < 12; i++) {
    const y = y0 + Math.floor((m0 - 1 + i) / 12);
    const m = ((m0 - 1 + i) % 12) + 1;
    horizonMonths.push(`${y}-${String(m).padStart(2, "0")}`);
  }

  const existingMonths = new Set(
    salaryExtras
      .filter((e) => e.employeeId === employee.id && e.type === "rent")
      .map((e) => e.month)
  );

  // 1) Mevcut kayıtları güncelle (description korunur; seed kilitleri dokunulmaz).
  let next = salaryExtras.map((e) =>
    e.employeeId === employee.id &&
    e.type === "rent" &&
    ymGte(e.month, effectiveFrom) &&
    !isLockedCanonicalRent(e)
      ? { ...e, amount }
      : e
  );

  // 2) Eksik ayları üret (yalnızca amount > 0).
  if (amount > 0) {
    const toCreate = horizonMonths
      .filter((m) => !existingMonths.has(m))
      .map((m) => ({
        id: `se-${employee.id.replace(/^emp-/, "")}-rent-${m}`,
        employeeId: employee.id,
        month: m,
        amount,
        description: "Ev kira desteği (aylık)",
        type: "rent" as const,
      }));
    next = [...next, ...toCreate];
  } else {
    // amount = 0 → effectiveFrom ve sonrası rent kayıtlarını sil.
    next = next.filter(
      (e) => !(e.employeeId === employee.id && e.type === "rent" && ymGte(e.month, effectiveFrom))
    );
  }

  return next;
}

/** Tek ay için kira kalemi oluşturur veya günceller; amount ≤ 0 ise siler. */
export function upsertRentExtraForMonth(
  salaryExtras: SalaryExtra[],
  employee: Employee,
  monthYm: string,
  amount: number
): SalaryExtra[] {
  const existing = salaryExtras.find(
    (e) => e.employeeId === employee.id && e.type === "rent" && e.month === monthYm
  );
  if (amount <= 0) {
    if (!existing) return salaryExtras;
    return salaryExtras.filter((e) => e.id !== existing.id);
  }
  if (existing) {
    return salaryExtras.map((e) =>
      e.id === existing.id ? { ...e, amount } : e
    );
  }
  return [
    ...salaryExtras,
    {
      id: `se-${employee.id.replace(/^emp-/, "")}-rent-${monthYm}`,
      employeeId: employee.id,
      month: monthYm,
      amount,
      description: "Ev kira desteği (aylık)",
      type: "rent" as const,
    },
  ];
}

/** Seçilen aylara aynı kira tutarını yazar (yayıncı profili `getRentForMonth` ile okur). */
export function applyRentToMonths(
  salaryExtras: SalaryExtra[],
  employee: Employee,
  months: string[],
  amount: number
): SalaryExtra[] {
  const unique = [...new Set(months)].sort();
  let next = salaryExtras;
  for (const m of unique) {
    if (!isPayrollActive(employee, m)) continue;
    next = upsertRentExtraForMonth(next, employee, m, amount);
  }
  return next;
}

/**
 * Çalışan sözleşmesindeki `rentSupport` ile bu ayın `salary_extras` (tip=rent)
 * kaydı uyumsuzsa otomatik düzeltir. Eski bug sonrası DB/localStorage'ta kalan
 * eski kira tutarlarını girişte onarır.
 */
export function reconcileRentExtrasForAllEmployees(
  employees: Employee[],
  salaryExtras: SalaryExtra[]
): SalaryExtra[] {
  let next = salaryExtras;
  for (const emp of employees) {
    if (emp.rentSupport <= 0 || emp.status !== "active") continue;

    const propagateFrom = rentPropagateStartMonth(emp, next);
    const targetRent = standardRentAmountForEmployee(emp, next);

    const expectedRent = (e: SalaryExtra) =>
      CANONICAL_RENT_BY_EXTRA_ID[e.id] ?? targetRent;

    const hasMismatch = next.some(
      (e) =>
        e.employeeId === emp.id &&
        e.type === "rent" &&
        ymGte(e.month, propagateFrom) &&
        e.amount !== expectedRent(e)
    );

    const hasAnyStandard = next.some(
      (e) =>
        e.employeeId === emp.id &&
        e.type === "rent" &&
        ymGte(e.month, propagateFrom)
    );

    if (hasMismatch || !hasAnyStandard) {
      next = propagateRentForEmployee(next, emp, targetRent, propagateFrom);
    }
  }
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store implementasyonu
// ─────────────────────────────────────────────────────────────────────────────

const storeCreator: StateCreator<AppStore> = (set, get) => ({
      employees:           initialEmployees,
      advances:            initialAdvances,
      salaryExtras:        initialSalaryExtras,
      paymentStatuses:     initialPaymentStatuses,
      organizations:       initialOrganizations,
      organizationMembers: initialOrganizationMembers,
      companies:           initialCompanies,
      sponsorTransactions: initialSponsorTransactions,
      projects:            initialProjects,
      projectPayments:     initialProjectPayments,
      expenses:            initialExpenses,
      plannedItems:        initialPlanned,
      plannedItemPayments: initialPlannedItemPayments,
      streamerAccounts:    initialStreamerAccounts,
      scheduleSlots:       initialScheduleSlots,
      brands:              initialBrands,
      brandLinks:          initialBrandLinks,
      linkSnapshots:       initialLinkSnapshots,
      brandViewership:     initialBrandViewership,
      brandMonthlyStats:   initialBrandMonthlyStats,
      affiliatePartners:   initialAffiliatePartners,
      affiliateDailyStats: initialAffiliateDailyStats,
      affiliatePayouts:    initialAffiliatePayouts,
      streamerPoolProfiles: initialStreamerPoolProfiles,
      brandOffers:         initialBrandOffers,
      brandOfferMessages:  initialBrandOfferMessages,
      brandDeals:          initialBrandDeals,
      brandPosts:          initialBrandPosts,
      kasas:               initialKasas,
      kasaTransactions:    initialKasaTransactions,
      contentExpenses:     initialContentExpenses,
      weeklyPlans:         initialWeeklyPlans,
      weekBrandReels:      initialWeekBrandReels,
      notifications:       initialNotifications,

      // Employee
      addEmployee:    (e)        => set((s) => {
        const emp: Employee = { ...e, id: uid() };
        let salaryExtras = s.salaryExtras;
        if (emp.rentSupport > 0) {
          salaryExtras = propagateRentForEmployee(
            salaryExtras,
            emp,
            emp.rentSupport,
            emp.payrollStartMonth
          );
        }
        return { employees: [...s.employees, emp], salaryExtras };
      }),
      updateEmployee: (id, e)    => set((s) => {
        const before = s.employees.find((x) => x.id === id);
        if (!before) return {};
        const after = { ...before, ...e } as Employee;
        const employees = s.employees.map((x) => (x.id === id ? after : x));
        // rentSupport değiştiyse: salaryExtras üzerinde tip="rent" kayıtları
        // mevcut ay ve sonraki tüm aylar için otomatik güncellensin.
        if (typeof e.rentSupport === "number" && e.rentSupport !== before.rentSupport) {
          return {
            employees,
            salaryExtras: propagateRentForEmployee(
              s.salaryExtras,
              after,
              e.rentSupport,
              after.payrollStartMonth
            ),
          };
        }
        if (
          e.payrollStartMonth &&
          e.payrollStartMonth !== before.payrollStartMonth &&
          after.rentSupport > 0
        ) {
          return {
            employees,
            salaryExtras: propagateRentForEmployee(
              s.salaryExtras,
              after,
              after.rentSupport,
              after.payrollStartMonth
            ),
          };
        }
        return { employees };
      }),
      deleteEmployee: (id)       => set((s) => ({ employees: s.employees.filter((x) => x.id !== id) })),

      // Advance
      addAdvance:    (a)         => set((s) => ({ advances: [...s.advances, { ...a, id: uid() }] })),
      updateAdvance: (id, a)     => set((s) => ({ advances: s.advances.map((x) => (x.id === id ? { ...x, ...a } : x)) })),
      deleteAdvance: (id)        => set((s) => ({ advances: s.advances.filter((x) => x.id !== id) })),

      // Salary extra
      addSalaryExtra: (e) =>
        set((s) => {
          let salaryExtras = [...s.salaryExtras, { ...e, id: uid() }];
          if (e.type === "rent") {
            const employee = s.employees.find((emp) => emp.id === e.employeeId);
            const monthLocked = s.salaryExtras.some(
              (x) =>
                x.employeeId === e.employeeId &&
                x.month === e.month &&
                isLockedCanonicalRent(x),
            );
            if (employee && !monthLocked) {
              salaryExtras = propagateRentForEmployee(
                salaryExtras,
                employee,
                e.amount,
                e.month,
              );
            }
          }
          return { salaryExtras };
        }),
      updateSalaryExtra: (id, e) =>
        set((s) => {
          const before = s.salaryExtras.find((x) => x.id === id);
          let salaryExtras = s.salaryExtras.map((x) =>
            x.id === id ? { ...x, ...e } : x
          );
          const after = salaryExtras.find((x) => x.id === id);
          if (
            after?.type === "rent" &&
            !isLockedCanonicalRent(after) &&
            typeof after.amount === "number"
          ) {
            const employee = s.employees.find((emp) => emp.id === after.employeeId);
            if (employee) {
              salaryExtras = propagateRentForEmployee(
                salaryExtras,
                employee,
                after.amount,
                after.month,
              );
            }
          }
          return { salaryExtras };
        }),
      deleteSalaryExtra: (id) =>
        set((s) => {
          const extra = s.salaryExtras.find((x) => x.id === id);
          return {
            salaryExtras: s.salaryExtras.filter((x) => x.id !== id),
            contentExpenses: extra?.contentExpenseId
              ? s.contentExpenses.map((ce) =>
                  ce.id === extra.contentExpenseId
                    ? { ...ce, salaryExtraId: undefined, settlementMode: undefined }
                    : ce
                )
              : s.contentExpenses,
          };
        }),
      syncRentSupportFromMonth: (employeeId, fromMonth, amount) =>
        set((s) => {
          const employee = s.employees.find((e) => e.id === employeeId);
          if (!employee) return {};
          return {
            salaryExtras: propagateRentForEmployee(s.salaryExtras, employee, amount, fromMonth),
          };
        }),
      setRentForMonths: (employeeId, months, amount) =>
        set((s) => {
          const employee = s.employees.find((e) => e.id === employeeId);
          if (!employee) return {};
          const sorted = [...new Set(months)].sort();
          let salaryExtras = applyRentToMonths(s.salaryExtras, employee, sorted, amount);
          const fromMonth = sorted[0];
          if (fromMonth) {
            salaryExtras = propagateRentForEmployee(
              salaryExtras,
              employee,
              amount,
              fromMonth,
            );
          }
          return { salaryExtras };
        }),
      setEmployeeRentSupport: (employeeId, amount) =>
        set((s) => ({
          employees: s.employees.map((e) =>
            e.id === employeeId ? { ...e, rentSupport: Math.max(0, amount) } : e
          ),
        })),

      setPaymentStatus: (employeeId, month, paid, paidDate, paidBy) =>
        set((s) => {
          const existing = s.paymentStatuses.find(
            (p) => p.employeeId === employeeId && p.month === month
          );
          const approvedAt = paid ? new Date().toISOString() : undefined;
          if (existing) {
            return {
              paymentStatuses: s.paymentStatuses.map((p) =>
                p.employeeId === employeeId && p.month === month
                  ? {
                      ...p,
                      paid,
                      paidDate,
                      paidBy: paid ? paidBy : undefined,
                      approvedAt,
                      kasaTxId: paid ? p.kasaTxId : undefined,
                    }
                  : p
              ),
            };
          }
          return {
            paymentStatuses: [
              ...s.paymentStatuses,
              {
                employeeId,
                month,
                paid,
                paidDate,
                paidBy: paid ? paidBy : undefined,
                approvedAt,
              },
            ],
          };
        }),

      payEmployeeSalary: ({
        employeeId, month, amountUsd, kasaId, paidDate,
        feeUsd = 0, notes = "", proof = "", paidBy,
      }) =>
        set((s) => {
          const employee = s.employees.find((e) => e.id === employeeId);
          if (!employee) return {};
          const targetKasa =
            s.kasas.find((k) => k.id === kasaId && !k.archived) ??
            s.kasas.find((k) => k.isDefault && !k.archived) ??
            s.kasas[0];
          if (!targetKasa) return {};

          const existing = s.paymentStatuses.find(
            (p) => p.employeeId === employeeId && p.month === month
          );
          const plan = buildPayrollLinePlan(
            employee,
            month,
            s.advances,
            s.salaryExtras,
            s.contentExpenses,
            s.paymentStatuses,
          );
          const currentLines = buildPayrollPaymentLines(
            employee,
            month,
            s.advances,
            s.salaryExtras,
            s.contentExpenses,
            existing ? [existing] : [],
          );
          const unpaidPlan = plan.filter(
            (p) => !currentLines.find((l) => l.lineId === p.lineId && l.paid),
          );
          if (unpaidPlan.length === 0) return {};

          const unpaidLineIds = new Set(unpaidPlan.map((p) => p.lineId));
          const lineTxIds = new Set(
            (existing?.linePayments ?? [])
              .filter((lp) => unpaidLineIds.has(lp.lineId))
              .map((lp) => lp.kasaTxId)
              .filter((id): id is string => Boolean(id)),
          );
          if (existing?.kasaTxId && unpaidPlan.length === plan.length) {
            lineTxIds.add(existing.kasaTxId);
          }
          const trimmedTx = s.kasaTransactions.filter((t) => !lineTxIds.has(t.id));

          const txId = uid();
          const monthLabel = formatPayrollMonthLabel(month);
          const newTx: KasaTransaction = {
            id: txId,
            kasaId: targetKasa.id,
            date: `${paidDate}T00:00`,
            direction: "out",
            amountUsd,
            feeUsd,
            purpose:
              unpaidPlan.length === plan.length
                ? `${employee.name} · ${monthLabel} maaş ödemesi (tüm kalemler)`
                : `${employee.name} · ${monthLabel} maaş ödemesi (kalan kalemler)`,
            counterparty: employee.name,
            proof,
            notes,
          };

          const keptLinePayments = (existing?.linePayments ?? []).filter(
            (lp) => lp.paid && !unpaidLineIds.has(lp.lineId),
          );
          const newLinePayments = markAllLinesPaid(
            unpaidPlan.map((p) => ({ ...p, paid: false })),
            { paidDate, paidBy, kasaTxId: txId },
          );
          const linePayments = [...keptLinePayments, ...newLinePayments];
          const fullyPaid = linePayments.length >= plan.length && plan.length > 0;
          const now = new Date().toISOString();
          const baseStatus: MonthPaymentStatus = {
            employeeId,
            month,
            paid: fullyPaid,
            paidDate: fullyPaid ? paidDate : existing?.paidDate,
            paidBy: fullyPaid ? paidBy : existing?.paidBy,
            approvedAt: fullyPaid ? now : existing?.approvedAt,
            kasaTxId: fullyPaid ? txId : existing?.kasaTxId,
            linePayments,
          };

          const paymentStatuses = existing
            ? s.paymentStatuses.map((p) =>
                p.employeeId === employeeId && p.month === month ? baseStatus : p
              )
            : [...s.paymentStatuses, baseStatus];

          return {
            kasaTransactions: [...trimmedTx, newTx],
            paymentStatuses,
          };
        }),

      unpayEmployeeSalary: (employeeId, month) =>
        set((s) => {
          const existing = s.paymentStatuses.find(
            (p) => p.employeeId === employeeId && p.month === month
          );
          const removeIds = new Set<string>();
          if (existing?.kasaTxId) removeIds.add(existing.kasaTxId);
          for (const lp of existing?.linePayments ?? []) {
            if (lp.kasaTxId) removeIds.add(lp.kasaTxId);
          }
          const kasaTransactions = s.kasaTransactions.filter((t) => !removeIds.has(t.id));
          const paymentStatuses = s.paymentStatuses.map((p) =>
            p.employeeId === employeeId && p.month === month
              ? {
                  ...p,
                  paid: false,
                  paidDate: undefined,
                  paidBy: undefined,
                  approvedAt: undefined,
                  kasaTxId: undefined,
                  linePayments: [],
                }
              : p
          );
          return { kasaTransactions, paymentStatuses };
        }),

      payPayrollLine: ({
        employeeId, month, lineId, amountUsd, kasaId, paidDate,
        feeUsd = 0, notes = "", proof = "", paidBy,
      }) =>
        set((s) => {
          const employee = s.employees.find((e) => e.id === employeeId);
          if (!employee) return {};
          const targetKasa =
            s.kasas.find((k) => k.id === kasaId && !k.archived) ??
            s.kasas.find((k) => k.isDefault && !k.archived) ??
            s.kasas[0];
          if (!targetKasa) return {};

          const plan = buildPayrollLinePlan(
            employee,
            month,
            s.advances,
            s.salaryExtras,
            s.contentExpenses,
            s.paymentStatuses,
          );
          const line = plan.find((l) => l.lineId === lineId);
          if (!line) return {};

          const existing = s.paymentStatuses.find(
            (p) => p.employeeId === employeeId && p.month === month
          );
          const prevLine = existing?.linePayments?.find((lp) => lp.lineId === lineId);
          const trimmedTx = prevLine?.kasaTxId
            ? s.kasaTransactions.filter((t) => t.id !== prevLine.kasaTxId)
            : s.kasaTransactions;

          const txId = uid();
          const monthLabel = formatPayrollMonthLabel(month);
          const newTx: KasaTransaction = {
            id: txId,
            kasaId: targetKasa.id,
            date: `${paidDate}T00:00`,
            direction: "out",
            amountUsd,
            feeUsd,
            purpose: `${employee.name} · ${monthLabel} · ${line.label}`,
            counterparty: employee.name,
            proof,
            notes,
          };

          const record: PayrollLinePaidRecord = {
            lineId: line.lineId,
            kind: line.kind,
            label: line.label,
            amountUsd,
            refId: line.refId,
            paid: true,
            paidDate,
            paidBy,
            kasaTxId: txId,
          };
          const linePayments = upsertLinePaidRecord(
            existing?.linePayments,
            record,
          );
          const lines = buildPayrollPaymentLines(
            employee,
            month,
            s.advances,
            s.salaryExtras,
            s.contentExpenses,
            [{
              employeeId,
              month,
              paid: false,
              linePayments,
            }],
          );
          const fullyPaid = isPayrollFullyPaid(lines);
          const now = new Date().toISOString();
          const baseStatus: MonthPaymentStatus = {
            employeeId,
            month,
            paid: fullyPaid,
            paidDate: fullyPaid ? paidDate : existing?.paidDate,
            paidBy: fullyPaid ? paidBy : existing?.paidBy,
            approvedAt: fullyPaid ? now : existing?.approvedAt,
            kasaTxId: fullyPaid ? txId : existing?.kasaTxId,
            linePayments,
          };

          const paymentStatuses = existing
            ? s.paymentStatuses.map((p) =>
                p.employeeId === employeeId && p.month === month ? baseStatus : p
              )
            : [...s.paymentStatuses, baseStatus];

          return {
            kasaTransactions: [...trimmedTx, newTx],
            paymentStatuses,
          };
        }),

      unpayPayrollLine: (employeeId, month, lineId) =>
        set((s) => {
          const existing = s.paymentStatuses.find(
            (p) => p.employeeId === employeeId && p.month === month
          );
          if (!existing) return {};
          const removed = existing.linePayments?.find((lp) => lp.lineId === lineId);
          const kasaTransactions = removed?.kasaTxId
            ? s.kasaTransactions.filter((t) => t.id !== removed.kasaTxId)
            : s.kasaTransactions;
          const linePayments = removeLinePaidRecord(existing.linePayments, lineId);
          const employee = s.employees.find((e) => e.id === employeeId);
          const fullyPaid = employee
            ? isPayrollFullyPaid(
                buildPayrollPaymentLines(
                  employee,
                  month,
                  s.advances,
                  s.salaryExtras,
                  s.contentExpenses,
                  [{ ...existing, paid: false, linePayments }],
                ),
              )
            : false;

          const paymentStatuses = s.paymentStatuses.map((p) =>
            p.employeeId === employeeId && p.month === month
              ? {
                  ...p,
                  paid: fullyPaid,
                  paidDate: fullyPaid ? p.paidDate : undefined,
                  paidBy: fullyPaid ? p.paidBy : undefined,
                  approvedAt: fullyPaid ? p.approvedAt : undefined,
                  kasaTxId: fullyPaid ? p.kasaTxId : undefined,
                  linePayments,
                }
              : p
          );
          return { kasaTransactions, paymentStatuses };
        }),

      markPayrollLinePaid: ({ employeeId, month, lineId, paidDate, paidBy }) =>
        set((s) => {
          const employee = s.employees.find((e) => e.id === employeeId);
          if (!employee) return {};
          const plan = buildPayrollLinePlan(
            employee,
            month,
            s.advances,
            s.salaryExtras,
            s.contentExpenses,
            s.paymentStatuses,
          );
          const line = plan.find((l) => l.lineId === lineId);
          if (!line) return {};

          const existing = s.paymentStatuses.find(
            (p) => p.employeeId === employeeId && p.month === month,
          );
          const record: PayrollLinePaidRecord = {
            lineId: line.lineId,
            kind: line.kind,
            label: line.label,
            amountUsd: line.amountUsd,
            refId: line.refId,
            paid: true,
            paidDate,
            paidBy,
          };
          const linePayments = upsertLinePaidRecord(existing?.linePayments, record);
          const lines = buildPayrollPaymentLines(
            employee,
            month,
            s.advances,
            s.salaryExtras,
            s.contentExpenses,
            [{ employeeId, month, paid: false, linePayments }],
          );
          const fullyPaid = isPayrollFullyPaid(lines);
          const now = new Date().toISOString();
          const baseStatus: MonthPaymentStatus = {
            employeeId,
            month,
            paid: fullyPaid,
            paidDate: fullyPaid ? paidDate : existing?.paidDate,
            paidBy: fullyPaid ? paidBy : existing?.paidBy,
            approvedAt: fullyPaid ? now : existing?.approvedAt,
            kasaTxId: existing?.kasaTxId,
            linePayments,
          };
          const paymentStatuses = existing
            ? s.paymentStatuses.map((p) =>
                p.employeeId === employeeId && p.month === month ? baseStatus : p,
              )
            : [...s.paymentStatuses, baseStatus];
          return { paymentStatuses };
        }),

      markEmployeePayrollLinesPaid: ({ employeeId, month, paidDate, paidBy, lineIds }) =>
        set((s) => {
          const employee = s.employees.find((e) => e.id === employeeId);
          if (!employee) return {};
          const existing = s.paymentStatuses.find(
            (p) => p.employeeId === employeeId && p.month === month,
          );
          const currentLines = buildPayrollPaymentLines(
            employee,
            month,
            s.advances,
            s.salaryExtras,
            s.contentExpenses,
            existing ? [existing] : [],
          );
          const unpaid = currentLines.filter((l) => !l.paid);
          const toMark = lineIds?.length
            ? unpaid.filter((l) => lineIds.includes(l.lineId))
            : unpaid;
          if (toMark.length === 0) return {};

          const newRecords = markAllLinesPaid(toMark, { paidDate, paidBy });
          const kept = (existing?.linePayments ?? []).filter(
            (lp) => lp.paid && !toMark.some((l) => l.lineId === lp.lineId),
          );
          const linePayments = [...kept, ...newRecords];
          const lines = buildPayrollPaymentLines(
            employee,
            month,
            s.advances,
            s.salaryExtras,
            s.contentExpenses,
            [{ employeeId, month, paid: false, linePayments }],
          );
          const fullyPaid = isPayrollFullyPaid(lines);
          const now = new Date().toISOString();
          const baseStatus: MonthPaymentStatus = {
            employeeId,
            month,
            paid: fullyPaid,
            paidDate: fullyPaid ? paidDate : existing?.paidDate,
            paidBy: fullyPaid ? paidBy : existing?.paidBy,
            approvedAt: fullyPaid ? now : existing?.approvedAt,
            kasaTxId: existing?.kasaTxId,
            linePayments,
          };
          const paymentStatuses = existing
            ? s.paymentStatuses.map((p) =>
                p.employeeId === employeeId && p.month === month ? baseStatus : p,
              )
            : [...s.paymentStatuses, baseStatus];
          return { paymentStatuses };
        }),

      // Company
      addCompany:    (c)         => set((s) => ({ companies: [...s.companies, { ...c, id: uid() }] })),
      updateCompany: (id, c)     => set((s) => ({ companies: s.companies.map((x) => (x.id === id ? { ...x, ...c } : x)) })),
      deleteCompany: (id)        => set((s) => ({ companies: s.companies.filter((x) => x.id !== id) })),

      // Sponsor transaction
      addSponsorTransaction:    (t)     => set((s) => ({ sponsorTransactions: [...s.sponsorTransactions, { ...t, id: uid() }] })),
      updateSponsorTransaction: (id, t) => set((s) => ({ sponsorTransactions: s.sponsorTransactions.map((x) => (x.id === id ? { ...x, ...t } : x)) })),
      deleteSponsorTransaction: (id)    => set((s) => ({ sponsorTransactions: s.sponsorTransactions.filter((x) => x.id !== id) })),

      // Project
      addProject:    (p)         => set((s) => ({ projects: [...s.projects, { ...defaultProjectFields(p), id: uid() }] })),
      updateProject: (id, p)     => set((s) => ({ projects: s.projects.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      deleteProject: (id)        => set((s) => ({
        projects: s.projects.filter((x) => x.id !== id),
        projectPayments: s.projectPayments.filter((pay) => pay.projectId !== id),
      })),

      addProjectPayment: (p) => set((s) => ({
        projectPayments: [...s.projectPayments, { ...p, id: uid() }],
      })),
      updateProjectPayment: (id, p) => set((s) => ({
        projectPayments: s.projectPayments.map((x) => (x.id === id ? { ...x, ...p } : x)),
      })),
      deleteProjectPayment: (id) => set((s) => ({
        projectPayments: s.projectPayments.filter((x) => x.id !== id),
      })),

      // Expense
      addExpense:    (e)         => set((s) => ({ expenses: [...s.expenses, { ...e, id: uid() }] })),
      updateExpense: (id, e)     => set((s) => {
        const before = s.expenses.find((x) => x.id === id);
        const nextExpense = before ? { ...before, ...e } : undefined;
        return {
          expenses: s.expenses.map((x) => (x.id === id ? { ...x, ...e } : x)),
          kasaTransactions:
            before?.kasaTxId && nextExpense
              ? s.kasaTransactions.map((tx) =>
                  tx.id === before.kasaTxId
                    ? {
                        ...tx,
                        amountUsd: nextExpense.amount,
                        date: `${nextExpense.date}T00:00`,
                        purpose: `[Gider] ${nextExpense.category} · ${nextExpense.description}`,
                        counterparty: nextExpense.description || nextExpense.category,
                      }
                    : tx
                )
              : s.kasaTransactions,
        };
      }),
      deleteExpense: (id)        => set((s) => {
        const target = s.expenses.find((x) => x.id === id);
        const kasaTransactions = target?.kasaTxId
          ? s.kasaTransactions.filter((t) => t.id !== target.kasaTxId)
          : s.kasaTransactions;
        return {
          expenses: s.expenses.filter((x) => x.id !== id),
          kasaTransactions,
          plannedItems: target
            ? s.plannedItems.map((p) =>
                p.expenseEntryId === target.id
                  ? { ...p, expenseEntryId: undefined, spent: paidPlannedTotal(s.plannedItemPayments, p.id) }
                  : p
              )
            : s.plannedItems,
        };
      }),

      recordExpense: (data, kasa) =>
        set((s) => {
          const expenseId = uid();
          if (!kasa) {
            return { expenses: [...s.expenses, { ...data, id: expenseId }] };
          }
          const targetKasa =
            s.kasas.find((k) => k.id === kasa.kasaId && !k.archived) ??
            s.kasas.find((k) => k.isDefault && !k.archived) ??
            s.kasas[0];
          if (!targetKasa) {
            return { expenses: [...s.expenses, { ...data, id: expenseId }] };
          }
          const txId = uid();
          const newTx: KasaTransaction = {
            id: txId,
            kasaId: targetKasa.id,
            date: `${data.date || new Date().toISOString().slice(0, 10)}T00:00`,
            direction: "out",
            amountUsd: data.amount,
            feeUsd: kasa.feeUsd ?? 0,
            purpose: `[Gider] ${data.category} · ${data.description}`,
            counterparty: data.description || data.category,
            proof: kasa.proof ?? "",
            notes: kasa.notes ?? "",
            plannedItemId: data.plannedItemId,
          };
          return {
            expenses: [...s.expenses, { ...data, id: expenseId, kasaTxId: txId }],
            kasaTransactions: [...s.kasaTransactions, newTx],
          };
        }),

      // Planned
      addPlannedItem: (i) => set((s) => ({
        plannedItems: [...s.plannedItems, {
          ...i,
          id: uid(),
          category: i.category ?? "other",
          spent: i.spent ?? 0,
          startDate: i.startDate ?? "",
          isRecurring: i.isRecurring ?? false,
          recurrence: i.recurrence ?? "none",
        }],
      })),
      updatePlannedItem: (id, i) => set((s) => ({
        plannedItems: s.plannedItems.map((x) => (x.id === id ? { ...x, ...i } : x)),
      })),
      deletePlannedItem: (id) => set((s) => ({
        plannedItems: s.plannedItems.filter((x) => x.id !== id),
        plannedItemPayments: s.plannedItemPayments.filter((p) => p.plannedItemId !== id),
        expenses: s.expenses.map((e) =>
          e.plannedItemId === id ? { ...e, plannedItemId: undefined } : e
        ),
        kasaTransactions: s.kasaTransactions.map((t) =>
          t.plannedItemId === id ? { ...t, plannedItemId: undefined } : t
        ),
      })),

      addPlannedItemPayment: (p) => set((s) => {
        const existing = s.plannedItemPayments.find(
          (x) => x.plannedItemId === p.plannedItemId && x.month === p.month
        );
        const plannedItemPayments = existing
          ? s.plannedItemPayments.map((x) => (x.id === existing.id ? { ...x, ...p } : x))
          : [...s.plannedItemPayments, { ...p, id: uid() }];
        return {
          plannedItemPayments,
          plannedItems: s.plannedItems.map((item) =>
            item.id === p.plannedItemId
              ? {
                  ...item,
                  spent: paidPlannedTotal(plannedItemPayments, item.id),
                  status: plannedStatusAfterSpend(
                    item,
                    paidPlannedTotal(plannedItemPayments, item.id),
                  ),
                }
              : item
          ),
        };
      }),
      updatePlannedItemPayment: (id, p) => set((s) => {
        const before = s.plannedItemPayments.find((x) => x.id === id);
        const plannedItemPayments = s.plannedItemPayments.map((x) => (x.id === id ? { ...x, ...p } : x));
        const affectedId = (p.plannedItemId ?? before?.plannedItemId);
        return {
          plannedItemPayments,
          plannedItems: affectedId
            ? s.plannedItems.map((item) =>
                item.id === affectedId
                  ? {
                      ...item,
                      spent: paidPlannedTotal(plannedItemPayments, item.id),
                      status: plannedStatusAfterSpend(
                        item,
                        paidPlannedTotal(plannedItemPayments, item.id),
                      ),
                    }
                  : item
              )
            : s.plannedItems,
        };
      }),
      deletePlannedItemPayment: (id) => set((s) => {
        const before = s.plannedItemPayments.find((x) => x.id === id);
        const plannedItemPayments = s.plannedItemPayments.filter((x) => x.id !== id);
        return {
          plannedItemPayments,
          plannedItems: before
            ? s.plannedItems.map((item) =>
                item.id === before.plannedItemId
                  ? {
                      ...item,
                      spent: paidPlannedTotal(plannedItemPayments, item.id),
                      status:
                        paidPlannedTotal(plannedItemPayments, item.id) > 0 && item.status === "completed"
                          ? "in-progress"
                          : item.status,
                    }
                  : item
              )
            : s.plannedItems,
        };
      }),

      transferPlannedToExpense: ({ plannedItemId, amount, date, description, category, markCompleted }) =>
        set((s) => {
          const item = s.plannedItems.find((x) => x.id === plannedItemId);
          if (!item || amount <= 0) return {};
          const expenseId = uid();
          const expense: ExpenseEntry = {
            id: expenseId,
            category: category ?? "Diğer",
            amount,
            date,
            description: description || `[Planlanan] ${item.name}`,
            brandId: item.brandId,
            plannedItemId: item.id,
          };
          const spent = Math.min(item.budget, paidPlannedTotal(s.plannedItemPayments, item.id, amount));
          return {
            expenses: [...s.expenses, expense],
            plannedItems: s.plannedItems.map((x) =>
              x.id === item.id
                ? {
                    ...x,
                    spent,
                    expenseEntryId: expenseId,
                    status: plannedStatusAfterSpend(x, spent, markCompleted),
                  }
                : x
            ),
          };
        }),

      transferPlannedToKasa: ({ plannedItemId, kasaId, amount, date, feeUsd = 0, notes = "", proof = "", markCompleted }) =>
        set((s) => {
          const item = s.plannedItems.find((x) => x.id === plannedItemId);
          if (!item || amount <= 0) return {};
          const targetKasa =
            s.kasas.find((k) => k.id === kasaId && !k.archived) ??
            s.kasas.find((k) => k.isDefault && !k.archived) ??
            s.kasas[0];
          if (!targetKasa) return {};
          const txId = uid();
          const tx: KasaTransaction = {
            id: txId,
            kasaId: targetKasa.id,
            date: `${date}T12:00`,
            direction: "out",
            amountUsd: amount,
            feeUsd,
            purpose: `[Planlanan] ${item.name}`,
            counterparty: "Planlanan yatırım",
            proof,
            notes: notes || item.notes,
            plannedItemId: item.id,
          };
          const spent = Math.min(item.budget, paidPlannedTotal(s.plannedItemPayments, item.id, amount));
          return {
            kasaTransactions: [...s.kasaTransactions, tx],
            plannedItems: s.plannedItems.map((x) =>
              x.id === item.id
                ? {
                    ...x,
                    spent,
                    kasaTxId: txId,
                    status: plannedStatusAfterSpend(x, spent, markCompleted),
                  }
                : x
            ),
          };
        }),

      // Streamer accounts
      addStreamerAccount:    (a)     => set((s) => {
        const row = { ...a, id: uid() };
        persistEntity("streamer_account", row);
        void import("@/lib/achievement-account-sync-side-effect").then(({ queueAchievementSyncAfterAccountChange }) =>
          queueAchievementSyncAfterAccountChange(row),
        );
        return { streamerAccounts: [...s.streamerAccounts, row] };
      }),
      updateStreamerAccount: (id, a) => set((s) => {
        const streamerAccounts = s.streamerAccounts.map((x) => (x.id === id ? { ...x, ...a } : x));
        const row = streamerAccounts.find((x) => x.id === id);
        if (row) {
          persistEntity("streamer_account", row);
          void import("@/lib/achievement-account-sync-side-effect").then(({ queueAchievementSyncAfterAccountChange }) =>
            queueAchievementSyncAfterAccountChange(row),
          );
        }
        return { streamerAccounts };
      }),
      deleteStreamerAccount: (id)    => {
        removeEntity("streamer_account", id);
        set((s) => ({ streamerAccounts: s.streamerAccounts.filter((x) => x.id !== id) }));
      },

      // Schedule
      addScheduleSlot:    (sl)    => set((s) => {
        const row = { ...sl, id: uid() };
        persistEntity("schedule_slot", row);
        return { scheduleSlots: [...s.scheduleSlots, row] };
      }),
      updateScheduleSlot: (id, sl)=> set((s) => {
        const scheduleSlots = s.scheduleSlots.map((x) => (x.id === id ? { ...x, ...sl } : x));
        const row = scheduleSlots.find((x) => x.id === id);
        if (row) persistEntity("schedule_slot", row);
        return { scheduleSlots };
      }),
      deleteScheduleSlot: (id)    => {
        removeEntity("schedule_slot", id);
        set((s) => ({ scheduleSlots: s.scheduleSlots.filter((x) => x.id !== id) }));
      },

      // Viewership
      addBrandViewership: (v) => {
        const row = { ...v, id: uid() };
        set((s) => ({ brandViewership: [...s.brandViewership, row] }));
        persistEntity("brand_viewership", row);
      },
      updateBrandViewership: (id, v) => {
        set((s) => {
          const brandViewership = s.brandViewership.map((x) => (x.id === id ? { ...x, ...v } : x));
          const row = brandViewership.find((x) => x.id === id);
          if (row) persistEntity("brand_viewership", row);
          return { brandViewership };
        });
      },
      deleteBrandViewership: (id) => {
        removeEntity("brand_viewership", id);
        set((s) => ({ brandViewership: s.brandViewership.filter((x) => x.id !== id) }));
      },

      upsertBrandMonthlyStats: (stats) => {
        set((s) => {
          const idx = s.brandMonthlyStats.findIndex(
            (x) => x.brandId === stats.brandId && x.month === stats.month
          );
          const row: BrandMonthlyStats = {
            id: stats.id ?? (idx >= 0 ? s.brandMonthlyStats[idx].id : uid()),
            brandId: stats.brandId,
            month: stats.month,
            newRegistrations: Math.max(0, Math.floor(stats.newRegistrations || 0)),
            depositingMembers: Math.max(0, Math.floor(stats.depositingMembers || 0)),
            firstTimeDepositors: Math.max(0, Math.floor(stats.firstTimeDepositors || 0)),
            depositCount: Math.max(0, Math.floor(stats.depositCount || 0)),
            depositAmount: Math.max(0, Number(stats.depositAmount) || 0),
            withdrawalAmount: Math.max(0, Number(stats.withdrawalAmount) || 0),
            currency: stats.currency ?? "USD",
            ggr: Math.max(0, Number(stats.ggr) || 0),
            ngr: Math.max(0, Number(stats.ngr) || 0),
            activePlayers: Math.max(0, Math.floor(stats.activePlayers || 0)),
            bonusCost: Math.max(0, Number(stats.bonusCost) || 0),
            commissionTotal: Math.max(0, Number(stats.commissionTotal) || 0),
            liveDemoAllocated: Math.max(0, Number(stats.liveDemoAllocated) || 0),
            liveDemoRemaining: Math.max(0, Number(stats.liveDemoRemaining) || 0),
            liveDemoNotes: stats.liveDemoNotes ?? "",
            notes: stats.notes ?? "",
            updatedBy: stats.updatedBy,
            updatedAt: new Date().toISOString(),
          };
          if (idx >= 0) {
            const next = [...s.brandMonthlyStats];
            next[idx] = row;
            return { brandMonthlyStats: next };
          }
          return { brandMonthlyStats: [...s.brandMonthlyStats, row] };
        });
        flushAppData();
      },

      // Brand
      addBrand:    (b)     => set((s) => ({ brands: [...s.brands, { ...b, id: uid() }] })),
      updateBrand: (id, b) => set((s) => ({ brands: s.brands.map((x) => (x.id === id ? { ...x, ...b } : x)) })),
      deleteBrand: (id) => {
        set((s) => {
          const linkIds = new Set(s.brandLinks.filter((l) => l.brandId === id).map((l) => l.id));
          return {
            brands: s.brands.filter((x) => x.id !== id),
            brandLinks: s.brandLinks.filter((l) => l.brandId !== id),
            linkSnapshots: s.linkSnapshots.filter((sn) => !linkIds.has(sn.linkId)),
            brandViewership: s.brandViewership.filter((v) => v.brandId !== id),
            brandMonthlyStats: s.brandMonthlyStats.filter((st) => st.brandId !== id),
            weekBrandReels: s.weekBrandReels.filter(
              (r) => r.brandId !== id && !linkIds.has(r.brandLinkId ?? "")
            ),
          };
        });
        flushAppData();
      },

      // Brand link
      addBrandLink: (l) => {
        set((s) => {
          const dup = findDuplicateBrandLink(s.brandLinks, l.url, undefined, {
            brandId: l.brandId,
            ownerId: l.ownerId,
          });
          if (dup) return s;
          const row = {
            ...l,
            id: uid(),
            createdAt: l.createdAt ?? new Date().toISOString(),
          };
          persistEntity("brand_link", row);
          return { brandLinks: [...s.brandLinks, row] };
        });
      },
      updateBrandLink: (id, l) => {
        set((s) => {
          const brandLinks = s.brandLinks.map((x) => (x.id === id ? { ...x, ...l } : x));
          const row = brandLinks.find((x) => x.id === id);
          if (row) persistEntity("brand_link", row);
          return { brandLinks };
        });
      },
      deleteBrandLink: (id) => {
        removeEntity("brand_link", id);
        set((s) => ({
          brandLinks: s.brandLinks.filter((x) => x.id !== id),
          linkSnapshots: s.linkSnapshots.filter((sn) => sn.linkId !== id),
        }));
      },

      // Link snapshot
      addLinkSnapshot: (sn) => {
        const row = { ...sn, id: uid() };
        set((s) => ({ linkSnapshots: [...s.linkSnapshots, row] }));
        persistEntity("link_snapshot", row);
      },
      upsertLinkSnapshot: (sn) => {
        set((s) => {
          const idx = s.linkSnapshots.findIndex((x) => x.id === sn.id);
          if (idx >= 0) {
            const next = [...s.linkSnapshots];
            next[idx] = { ...next[idx], ...sn };
            persistEntity("link_snapshot", next[idx]);
            return { linkSnapshots: next };
          }
          const row = sn;
          persistEntity("link_snapshot", row);
          return { linkSnapshots: [...s.linkSnapshots, row] };
        });
      },
      updateLinkSnapshot: (id, sn) => {
        set((s) => {
          const linkSnapshots = s.linkSnapshots.map((x) => (x.id === id ? { ...x, ...sn } : x));
          const row = linkSnapshots.find((x) => x.id === id);
          if (row) persistEntity("link_snapshot", row);
          return { linkSnapshots };
        });
      },
      deleteLinkSnapshot: (id) => {
        removeEntity("link_snapshot", id);
        set((s) => ({ linkSnapshots: s.linkSnapshots.filter((x) => x.id !== id) }));
      },

      // Kasa hesapları
      addKasa: (k) =>
        set((s) => {
          const isDefault = k.isDefault ?? false;
          const id = uid();
          const cleared = isDefault
            ? s.kasas.map((x) => ({ ...x, isDefault: false }))
            : s.kasas;
          return { kasas: [...cleared, { ...k, id }] };
        }),
      updateKasa: (id, k) =>
        set((s) => {
          const setDefault = k.isDefault === true;
          const next = s.kasas.map((x) => {
            if (x.id === id) return { ...x, ...k };
            if (setDefault) return { ...x, isDefault: false };
            return x;
          });
          return { kasas: next };
        }),
      deleteKasa: (id, opts) =>
        set((s) => {
          if (id === DEFAULT_KASA_ID) return {};
          const inUse = s.kasaTransactions.some((t) => t.kasaId === id);
          const force = Boolean(opts?.force);

          if (inUse && !force) {
            if (isSupabaseClientMode()) {
              queueMicrotask(() => void removeKasaAccount(id, { force: false }));
            }
            return { kasas: s.kasas.map((x) => (x.id === id ? { ...x, archived: true } : x)) };
          }

          if (isSupabaseClientMode()) {
            queueMicrotask(() => void removeKasaAccount(id, { force }));
          }

          return {
            kasas: s.kasas.filter((x) => x.id !== id),
            kasaTransactions: force
              ? s.kasaTransactions.filter((t) => t.kasaId !== id)
              : s.kasaTransactions,
          };
        }),

      // Kasa
      addKasaTransaction:    (t)     => set((s) => {
        const kasaId = t.kasaId
          ?? s.kasas.find((k) => k.isDefault && !k.archived)?.id
          ?? s.kasas[0]?.id
          ?? DEFAULT_KASA_ID;
        const row: KasaTransaction = { ...t, kasaId, id: uid() };
        persistKasaTxImmediate(row);
        flushKasaData();
        return { kasaTransactions: [...s.kasaTransactions, row] };
      }),
      updateKasaTransaction: (id, t) => {
        const onlyCountInGenel =
          t.countInGenel !== undefined &&
          Object.keys(t).length === 1;
        if (onlyCountInGenel) {
          get().bulkSetKasaCountInGenel([id], Boolean(t.countInGenel));
          return;
        }
        set((s) => {
          const prev = s.kasaTransactions.find((x) => x.id === id);
          if (!prev) return {};
          const row = { ...prev, ...t };
          const kasaTransactions = s.kasaTransactions.map((x) =>
            x.id === id ? row : x
          );
          if (isSupabaseClientMode()) {
            persistKasaTxImmediate(row);
            flushKasaData();
          }
          return { kasaTransactions };
        });
      },
      bulkSetKasaCountInGenel: (ids, include) => {
        const idSet = new Set(ids.filter(Boolean));
        if (idSet.size === 0) return;
        set((s) => ({
          kasaTransactions: s.kasaTransactions.map((x) =>
            idSet.has(x.id) ? { ...x, countInGenel: include } : x
          ),
        }));
        if (!isSupabaseClientMode()) return;
        const list = Array.from(idSet);
        void bulkUpdateKasaCountInGenel(list, include).then((r) => {
          if (r.ok) return;
          set((s) => ({
            kasaTransactions: s.kasaTransactions.map((x) =>
              idSet.has(x.id) ? { ...x, countInGenel: !include } : x
            ),
          }));
        });
      },
      deleteKasaTransaction: (id)    => {
        if (isSupabaseClientMode()) {
          queueMicrotask(() => void removeKasaTransaction(id));
        }
        flushKasaData();
        set((s) => ({
        kasaTransactions: s.kasaTransactions.filter((x) => x.id !== id),
        expenses: s.expenses.map((e) =>
          e.kasaTxId === id ? { ...e, kasaTxId: undefined } : e
        ),
        contentExpenses: s.contentExpenses.map((e) =>
          e.kasaTxId === id
            ? {
                ...e,
                kasaTxId: undefined,
                paid: false,
                paidDate: undefined,
                settlementMode: e.settlementMode === "kasa" ? undefined : e.settlementMode,
              }
            : e
        ),
        plannedItems: s.plannedItems.map((p) =>
          p.kasaTxId === id
            ? {
                ...p,
                kasaTxId: undefined,
                spent: paidPlannedTotal(s.plannedItemPayments, p.id),
              }
            : p
        ),
      }));
      },

      // Content expense
      addContentExpense: (e) => {
        const id = uid();
        const row = { ...e, id };
        set((s) => ({ contentExpenses: [...s.contentExpenses, row] }));
        persistEntity("content_expense", row);
        return id;
      },
      updateContentExpense: (id, e) => set((s) => {
        const contentExpenses = s.contentExpenses.map((x) => (x.id === id ? { ...x, ...e } : x));
        const row = contentExpenses.find((x) => x.id === id);
        if (row) persistEntity("content_expense", row);
        return { contentExpenses };
      }),
      deleteContentExpense: (id)    => {
        removeEntity("content_expense", id);
        set((s) => {
        const target = s.contentExpenses.find((x) => x.id === id);
        const kasaTransactions = target?.kasaTxId
          ? s.kasaTransactions.filter((t) => t.id !== target.kasaTxId)
          : s.kasaTransactions;
        const salaryExtras = target?.salaryExtraId
          ? s.salaryExtras.filter((x) => x.id !== target.salaryExtraId)
          : s.salaryExtras;
        return {
          contentExpenses: s.contentExpenses.filter((x) => x.id !== id),
          kasaTransactions,
          salaryExtras,
        };
      });
      },

      settleContentExpenseToPayroll: (contentExpenseId) =>
        set((s) => {
          const expense = s.contentExpenses.find((x) => x.id === contentExpenseId);
          if (!expense || expense.salaryExtraId) return {};
          const cleanedExtras = s.salaryExtras.filter(
            (x) => x.contentExpenseId !== expense.id
          );
          const extraId = uid();
          const desc = `İçerik: ${expense.brandName} · ${expense.category}${expense.description ? ` — ${expense.description.slice(0, 80)}` : ""}`;
          const newExtra: SalaryExtra = {
            id: extraId,
            employeeId: expense.employeeId,
            month: expense.month,
            amount: expense.amountUsd,
            description: desc,
            type: "expense",
            contentExpenseId: expense.id,
          };
          const reviewStatus =
            expense.reviewStatus === "pending" || expense.reviewStatus === "needs_info"
              ? ("approved" as const)
              : expense.reviewStatus;
          const updatedExpense: ContentExpense = {
            ...expense,
            settlementMode: "payroll" as const,
            salaryExtraId: extraId,
            reviewStatus,
            reviewedAt: expense.reviewedAt ?? new Date().toISOString(),
          };
          queueMicrotask(() => {
            void persistContentExpenseSettlement(newExtra, updatedExpense);
          });
          return {
            salaryExtras: [...cleanedExtras, newExtra],
            contentExpenses: s.contentExpenses.map((x) =>
              x.id === contentExpenseId ? updatedExpense : x
            ),
          };
        }),

      unsettleContentExpenseFromPayroll: (contentExpenseId) =>
        set((s) => {
          const expense = s.contentExpenses.find((x) => x.id === contentExpenseId);
          if (!expense?.salaryExtraId) return {};
          return {
            salaryExtras: s.salaryExtras.filter((x) => x.id !== expense.salaryExtraId),
            contentExpenses: s.contentExpenses.map((x) =>
              x.id === contentExpenseId
                ? {
                    ...x,
                    settlementMode: undefined,
                    salaryExtraId: undefined,
                  }
                : x
            ),
          };
        }),

      payContentExpense: ({ contentExpenseId, kasaId, paidDate, feeUsd = 0, notes = "", proof = "" }) =>
        set((s) => {
          const expense = s.contentExpenses.find((x) => x.id === contentExpenseId);
          if (!expense) return {};
          const targetKasa =
            s.kasas.find((k) => k.id === kasaId && !k.archived) ??
            s.kasas.find((k) => k.isDefault && !k.archived) ??
            s.kasas[0];
          if (!targetKasa) return {};

          const tag = `[ICEXP:${contentExpenseId}]`;
          // Hem mevcut kasaTxId referansını hem de aynı içerik harcamasına ait
          // başka tag'li (örn. önceki sync'te düşmüş ama linki kopmuş) kayıtları
          // birlikte temizle — "iki kez kasadan düşme" hatasını engeller.
          const trimmedTx = s.kasaTransactions.filter((t) => {
            if (t.id === expense.kasaTxId) return false;
            const blob = `${t.notes ?? ""} ${t.purpose ?? ""}`;
            return !blob.includes(tag);
          });

          const txId = uid();
          const empName =
            s.employees.find((e) => e.id === expense.employeeId)?.name ?? "Yayıncı";
          const noteWithTag = notes ? `${notes} ${tag}` : tag;
          const newTx: KasaTransaction = {
            id: txId,
            kasaId: targetKasa.id,
            date: `${paidDate}T00:00`,
            direction: "out",
            amountUsd: expense.amountUsd,
            feeUsd,
            purpose: `[İçerik] ${expense.brandName} · ${expense.category}`,
            counterparty: empName,
            proof,
            notes: noteWithTag,
          };

          return {
            kasaTransactions: [...trimmedTx, newTx],
            contentExpenses: s.contentExpenses.map((x) =>
              x.id === contentExpenseId
                ? {
                    ...x,
                    paid: true,
                    paidDate,
                    kasaTxId: txId,
                    settlementMode: "kasa" as const,
                    salaryExtraId: undefined,
                  }
                : x
            ),
          };
        }),

      unpayContentExpense: (id) =>
        set((s) => {
          const expense = s.contentExpenses.find((x) => x.id === id);
          const tag = `[ICEXP:${id}]`;
          const kasaTransactions = s.kasaTransactions.filter((t) => {
            if (expense?.kasaTxId && t.id === expense.kasaTxId) return false;
            const blob = `${t.notes ?? ""} ${t.purpose ?? ""}`;
            return !blob.includes(tag);
          });
          return {
            kasaTransactions,
            contentExpenses: s.contentExpenses.map((x) =>
              x.id === id
                ? {
                    ...x,
                    paid: false,
                    paidDate: undefined,
                    kasaTxId: undefined,
                    settlementMode: x.settlementMode === "kasa" ? undefined : x.settlementMode,
                  }
                : x
            ),
          };
        }),

      // Weekly plan
      addWeeklyPlan: (p) => {
        const id = uid();
        let row: WeeklyPlan | null = null;
        set((s) => {
          const normalized = normalizeWeeklyPlanInput(p, {
            employees: s.employees,
            fallbackEmployeeId: p.employeeId,
            streamerAccounts: s.streamerAccounts,
          });
          if (!normalized) {
            console.error("weekly_plan: geçersiz yayıncı veya tarih", p);
            return s;
          }
          row = { ...normalized, id };
          return { weeklyPlans: [...s.weeklyPlans, row] };
        });
        if (row) persistEntity("weekly_plan", row);
        return id;
      },
      updateWeeklyPlan: (id, p) => set((s) => {
        const existing = s.weeklyPlans.find((x) => x.id === id);
        if (!existing) return s;
        const normalized = normalizeWeeklyPlanInput(
          { ...existing, ...p },
          {
            employees: s.employees,
            fallbackEmployeeId: existing.employeeId,
            streamerAccounts: s.streamerAccounts,
          }
        );
        if (!normalized) return s;
        const row = { ...normalized, id };
        const weeklyPlans = s.weeklyPlans.map((x) => (x.id === id ? row : x));
        persistEntity("weekly_plan", row);
        return { weeklyPlans };
      }),
      deleteWeeklyPlan: (id)    => {
        removeEntity("weekly_plan", id);
        set((s) => ({ weeklyPlans: s.weeklyPlans.filter((x) => x.id !== id) }));
      },

      addWeekBrandReel: (r) => {
        const dayIso =
          isoToLocalDateOnly(r.publishedAt) ||
          isoToLocalDateOnly(r.weekStart) ||
          r.weekStart.slice(0, 10);
        const weekStart = normalizeWeekAnchorIso(
          weekStartFromDateIso(dayIso) || dayIso
        );
        const publishedAt = r.publishedAt?.includes("T")
          ? r.publishedAt
          : localNoonTimestampIso(dayIso);
        const row: WeekBrandReel = {
          ...r,
          weekStart,
          publishedAt,
          id: uid(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ weekBrandReels: [...s.weekBrandReels, row] }));
        persistEntity("week_brand_reel", row);
      },
      updateWeekBrandReel: (id, r) => set((s) => {
        const existing = s.weekBrandReels.find((x) => x.id === id);
        if (!existing) return s;
        const merged = { ...existing, ...r };
        const dayIso =
          isoToLocalDateOnly(merged.publishedAt) ||
          isoToLocalDateOnly(merged.weekStart) ||
          merged.weekStart;
        const weekStart = normalizeWeekAnchorIso(
          weekStartFromDateIso(dayIso) || dayIso
        );
        const publishedAt =
          merged.publishedAt && merged.publishedAt.includes("T")
            ? merged.publishedAt
            : localNoonTimestampIso(dayIso);
        const row: WeekBrandReel = { ...merged, weekStart, publishedAt };
        const weekBrandReels = s.weekBrandReels.map((x) => (x.id === id ? row : x));
        persistEntity("week_brand_reel", row);
        return { weekBrandReels };
      }),
      deleteWeekBrandReel: (id) => {
        removeEntity("week_brand_reel", id);
        set((s) => ({
        weekBrandReels: s.weekBrandReels.filter((x) => x.id !== id),
      }));
      },
      applyWeekReelMetrics: (id, patch) => set((s) => ({
        weekBrandReels: s.weekBrandReels.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      })),

      // Notifications
      pushNotification: (n) => set((s) => ({
        notifications: [
          { ...n, id: uid(), createdAt: new Date().toISOString(), read: false },
          ...s.notifications,
        ].slice(0, 200), // son 200 ile sınırla
      })),
      markNotificationRead: (id) => set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      })),
      markAllNotificationsRead: (forRole, forUserId) => set((s) => ({
        notifications: s.notifications.map((n) => {
          const match = n.forRole === forRole && (!forUserId || !n.forUserId || n.forUserId === forUserId);
          return match ? { ...n, read: true } : n;
        }),
      })),
      deleteNotification: (id) => set((s) => ({
        notifications: s.notifications.filter((n) => n.id !== id),
      })),

      hydrateFromBackup: (data) =>
        set((s) => {
          const next = { ...s };
          for (const k of APP_SNAPSHOT_KEYS) {
            const v = data[k];
            if (v !== undefined && v !== null) (next as Record<string, unknown>)[k as string] = v;
          }
          return next;
        }),
});

const storePersistConfig = {
      name: "lanetkel-store-v8-multi-kasa",
      merge: (persistedState: unknown, currentState: AppStore) => {
        const p = (persistedState ?? {}) as Partial<AppStore>;
        const rawProjects = Array.isArray(p.projects) ? p.projects : [];
        const projects =
          rawProjects.length > 0 && rawProjects.every((x) => LEGACY_IC_GELIR_SEED_IDS.has(x.id))
            ? initialProjects
            : rawProjects.length > 0
              ? rawProjects
              : initialProjects;
        const kasaSrc =
          Array.isArray(p.kasaTransactions) && p.kasaTransactions.length > 0
            ? p.kasaTransactions
            : (currentState as { kasaTransactions: KasaTransaction[] }).kasaTransactions;
        const kasasSrc = Array.isArray(p.kasas) && p.kasas.length > 0 ? p.kasas : initialKasas;
        // Varsayılan "Genel Kasa" her zaman bulunmalı.
        const ensuredKasas =
          kasasSrc.some((k) => k.id === DEFAULT_KASA_ID)
            ? kasasSrc
            : [...initialKasas, ...kasasSrc];
        const employees = Array.isArray(p.employees)
          ? p.employees
          : currentState.employees;
        const salaryExtrasRaw = Array.isArray(p.salaryExtras)
          ? p.salaryExtras
          : currentState.salaryExtras;
        let contentExpenses = mergeCanonicalContentExpenses(
          Array.isArray(p.contentExpenses)
            ? p.contentExpenses
            : currentState.contentExpenses,
        );
        let salaryExtras = dedupeSalaryExtrasByContentExpense(
          salaryExtrasRaw,
          contentExpenses,
        );
        const payrollLinked = reconcilePayrollSettledContentExtras(
          salaryExtras,
          contentExpenses,
        );
        salaryExtras = payrollLinked.salaryExtras;
        contentExpenses = payrollLinked.contentExpenses;
        salaryExtras = mergeCanonicalSalaryExtras(salaryExtras);
        salaryExtras = reconcileRentExtrasForAllEmployees(employees, salaryExtras);
        const paymentStatuses = mergeCanonicalPaymentStatuses(
          Array.isArray(p.paymentStatuses)
            ? p.paymentStatuses
            : currentState.paymentStatuses,
        );
        const brandsPersist = Array.isArray(p.brands) && p.brands.length > 0
          ? p.brands
          : currentState.brands;
        const brandLinksMerged = mergeCanonicalBrandLinks(
          Array.isArray(p.brandLinks) ? p.brandLinks : currentState.brandLinks,
          brandsPersist
        );
        const linkSnapshotsMerged = mergeLinkSnapshotsHydrate(
          currentState.linkSnapshots,
          Array.isArray(p.linkSnapshots) ? p.linkSnapshots : undefined
        );
        const brandViewershipMerged = mergeBrandViewershipHydrate(
          currentState.brandViewership,
          Array.isArray(p.brandViewership) ? p.brandViewership : undefined
        );
        return {
          ...currentState,
          ...p,
          employees,
          salaryExtras,
          paymentStatuses,
          brandLinks: brandLinksMerged,
          linkSnapshots: linkSnapshotsMerged,
          brandViewership: brandViewershipMerged,
          projects,
          kasas: ensuredKasas,
          kasaTransactions: migrateKasaTransactions(kasaSrc),
          weekBrandReels: Array.isArray(p.weekBrandReels) ? p.weekBrandReels : [],
          brandMonthlyStats: Array.isArray(p.brandMonthlyStats) ? p.brandMonthlyStats : [],
          affiliatePartners: Array.isArray(p.affiliatePartners) ? p.affiliatePartners : [],
          affiliateDailyStats: Array.isArray(p.affiliateDailyStats) ? p.affiliateDailyStats : [],
          affiliatePayouts: Array.isArray(p.affiliatePayouts) ? p.affiliatePayouts : [],
          streamerPoolProfiles: Array.isArray(p.streamerPoolProfiles) ? p.streamerPoolProfiles : [],
          brandOffers: Array.isArray(p.brandOffers) ? p.brandOffers : [],
          brandOfferMessages: Array.isArray(p.brandOfferMessages) ? p.brandOfferMessages : [],
          brandDeals: Array.isArray(p.brandDeals) ? p.brandDeals : [],
          brandPosts: Array.isArray(p.brandPosts) ? p.brandPosts : [],
          organizations: Array.isArray(p.organizations) && p.organizations.length > 0 ? p.organizations : initialOrganizations,
          organizationMembers: Array.isArray(p.organizationMembers) && p.organizationMembers.length > 0 ? p.organizationMembers : initialOrganizationMembers,
        };
      },
    } as const;

export const useStore = isSupabaseClientMode()
  ? create<AppStore>()(storeCreator)
  : create<AppStore>()(persist(storeCreator, storePersistConfig));

// ─────────────────────────────────────────────────────────────────────────────
// Bildirim & plan yardımcıları
// ─────────────────────────────────────────────────────────────────────────────

/** Verilen tarihin Pazartesi'sini ISO YYYY-MM-DD olarak döndürür. */
export function weekStartOf(d: Date | string = new Date()): string {
  if (typeof d === "string") {
    const iso = d.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return weekStartFromDateIso(iso);
  }
  const date = typeof d === "string" ? new Date(d.includes("T") ? d : `${d}T12:00:00`) : new Date(d);
  const dow = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dow);
  const y = date.getFullYear();
  const mo = date.getMonth() + 1;
  const day = date.getDate();
  return `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function nextWeekStartOf(d: Date | string = new Date()): string {
  const base = weekStartOf(d);
  const [y, mo, day] = base.split("-").map(Number);
  const m = new Date(y, mo - 1, day + 7, 12, 0, 0);
  const ny = m.getFullYear();
  const nmo = m.getMonth() + 1;
  const nd = m.getDate();
  return `${ny}-${String(nmo).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

/** Bekleyen onay sayısı (yayıncı harcaması). */
export function pendingExpenseCount(expenses: ContentExpense[]): number {
  return expenses.filter((e) => e.reviewStatus === "pending").length;
}

/** Sadece admin / auditor için anlamlı, yayıncı ve markalardan gizlenen bildirim tipleri. */
export const OPS_ONLY_NOTIFICATION_TYPES: ReadonlySet<AppNotification["type"]> = new Set([
  "api_refresh_alert",
  "kasa_low",
  "payroll_reminder",
  "brand_payment_reminder",
  "password_reset_request",
  "account_registration_request",
  "schedule_updated",
  "expense_submitted",
  "advance_request",
]);

/** Yayıncı panelinde gösterilecek bildirim tipleri (Mesajlar sekmesi). */
export const STREAMER_NOTIFICATION_TYPES: ReadonlySet<AppNotification["type"]> = new Set([
  "general",
  "schedule_updated",
  "expense_approved",
  "expense_rejected",
  "expense_paid",
]);

export const STREAMER_NOTIFICATION_TYPE_LABELS: Partial<Record<AppNotification["type"], string>> = {
  general: "Yönetici mesajı / harcama",
  schedule_updated: "Yayın planı",
  expense_approved: "Harcama onayı",
  expense_rejected: "Harcama reddi",
  expense_paid: "Harcama ödemesi",
};

/** Rol için (operasyonel bildirimler filtrelenmiş) görüntülenebilir bildirimler. */
export function visibleNotificationsForRole(
  notifications: AppNotification[],
  role: "admin" | "auditor" | "streamer" | "brand",
  userId?: string,
  /** Brand rolü için erişilebilir marka id'leri (marka izolasyonu). */
  brandIds?: string[]
): AppNotification[] {
  const isOpsRole = role === "admin" || role === "auditor";
  return notifications.filter((n) => {
    if (n.forRole !== role) return false;
    if (role === "brand") {
      // Marka izolasyonu: kendi kullanıcı bildirimi VEYA markasının bildirimi
      // VEYA genel duyuru (her ikisi de boş). Başka markanın bildirimi sızmaz.
      const mine = !!userId && n.forUserId === userId;
      const brandMatch =
        !!n.forBrandId && !!brandIds && brandIds.includes(n.forBrandId);
      const isGlobal = !n.forUserId && !n.forBrandId;
      if (!mine && !brandMatch && !isGlobal) return false;
    } else {
      if (userId) {
        if (n.forUserId && n.forUserId !== userId) return false;
      } else if (n.forUserId) {
        return false;
      }
    }
    if (role === "streamer") {
      return STREAMER_NOTIFICATION_TYPES.has(n.type);
    }
    if (!isOpsRole && OPS_ONLY_NOTIFICATION_TYPES.has(n.type)) return false;
    return true;
  });
}

/** Rol için okunmamış bildirim sayısı. */
export function unreadNotificationCount(
  notifications: AppNotification[],
  role: "admin" | "auditor" | "streamer" | "brand",
  userId?: string,
  brandIds?: string[]
): number {
  return visibleNotificationsForRole(notifications, role, userId, brandIds).filter((n) => !n.read)
    .length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Türev hesaplamalar
// ─────────────────────────────────────────────────────────────────────────────

/** İki ay anahtarını karşılaştır ("2026-04" >= "2026-03"). */
const ymGte = (a: string, b: string) => a.localeCompare(b) >= 0;
const ymGt  = (a: string, b: string) => a.localeCompare(b) >  0;

/** Çalışan, verilen ay için maaş bordrosunda mı? (payrollStartMonth uygulanır.) */
export function isPayrollActive(employee: Employee, month: string) {
  return employee.status === "active" && ymGte(month, employee.payrollStartMonth);
}

/** Bordro henüz başlamadı; ilk maaş `payrollStartMonth` döneminde (görüntülenen ay öncesi). */
export function isPayrollUpcoming(employee: Employee, month: string): boolean {
  return (
    employee.status === "active" &&
    employee.kind !== "coordinator" &&
    ymGt(employee.payrollStartMonth, month)
  );
}

/** İlk bordro ayı için tahmini net (temel maaş + sözleşme kira desteği). */
export function estimateFirstPayrollNet(employee: Employee): number {
  return employee.baseSalary + (employee.rentSupport ?? 0);
}

/** Önceki aylardan ödenmemiş avans tutarı (carry-forward). */
export function calcCarryForward(
  employeeId: string,
  currentMonth: string,
  advances: Advance[],
  paymentStatuses: MonthPaymentStatus[]
): number {
  return advances
    .filter((a) => {
      if (a.employeeId !== employeeId) return false;
      if (!ymGt(currentMonth, a.month)) return false;
      const paid = paymentStatuses.find(
        (p) => p.employeeId === employeeId && p.month === a.month && p.paid
      );
      return !paid;
    })
    .reduce((s, a) => s + a.amount, 0);
}

/** Verilen aya kadar yapılan avans geri ödemelerinin toplamı (deduction'lar). */
export function calcAdvanceRepaid(
  employeeId: string,
  asOfMonth: string,
  salaryExtras: SalaryExtra[]
): number {
  return salaryExtras
    .filter((e) =>
      e.employeeId === employeeId &&
      e.type === "deduction" &&
      /avans/i.test(e.description) &&
      ymGte(asOfMonth, e.month)
    )
    .reduce((s, e) => s + e.amount, 0);
}

/** İçeride kalan açık avans bakiyesi (asOfMonth dahil olduktan sonra). */
export function calcOpenAdvanceBalance(
  employee: Employee,
  asOfMonth: string,
  salaryExtras: SalaryExtra[]
): number {
  const repaid = calcAdvanceRepaid(employee.id, asOfMonth, salaryExtras);
  return Math.max(0, employee.initialAdvance - repaid);
}

/**
 * Bu ay için geçerli kira desteği: önce salary_extras (tip=rent), yoksa sözleşme rentSupport.
 * Maaşlar listesi, yayıncı profili ve calcNetPayable aynı kaynağı kullanmalı.
 */
export function getRentForMonth(
  employee: Employee,
  month: string,
  extras: SalaryExtra[]
): number {
  const rentExtras = extras.filter(
    (e) => e.employeeId === employee.id && e.month === month && e.type === "rent"
  );
  if (rentExtras.length > 0) {
    return rentExtras.reduce((s, e) => s + e.amount, 0);
  }
  return employee.rentSupport;
}

export function calcNetPayable(
  employee: Employee,
  month: string,
  advances: Advance[],
  extras: SalaryExtra[],
  paymentStatuses: MonthPaymentStatus[] = []
): number {
  if (!isPayrollActive(employee, month)) return 0;

  const empAdvances  = advances.filter((a) => a.employeeId === employee.id && a.month === month);
  const empExtras    = extras.filter((e) => e.employeeId === employee.id && e.month === month);
  const totalAdvance = empAdvances.reduce((s, a) => s + a.amount, 0);
  const carryFwd     = calcCarryForward(employee.id, month, advances, paymentStatuses);

  const rentAdd = getRentForMonth(employee, month, extras);
  const otherAdd = empExtras
    .filter((e) => e.type !== "deduction" && e.type !== "rent")
    .reduce((s, e) => s + e.amount, 0);
  const totalAdd = otherAdd + rentAdd;
  const totalDeduc = empExtras
    .filter((e) => e.type === "deduction")
    .reduce((s, e) => s + e.amount, 0);

  return employee.baseSalary + totalAdd - totalDeduc - totalAdvance - carryFwd;
}

/** Bu ay için onaylı içerik harcaması toplamı (red / onay bekleyen / bilgi istenen hariç). */
export function sumApprovedContentExpenses(
  expenses: ContentExpense[],
  employeeId: string,
  month: string
): number {
  return expenses
    .filter((e) => {
      if (e.employeeId !== employeeId || e.month !== month) return false;
      if (e.reviewStatus === "rejected" || e.reviewStatus === "cancelled") return false;
      if (e.reviewStatus === "pending" || e.reviewStatus === "needs_info") return false;
      // Bordroya veya kasaya işlendi — plan toplamında tekrar sayma
      if (e.salaryExtraId || e.settlementMode === "payroll") return false;
      if (e.paid && (e.kasaTxId || e.settlementMode === "kasa")) return false;
      return true;
    })
    .reduce((s, e) => s + e.amountUsd, 0);
}

/** Bordroya masraf olarak eklenmiş onaylı içerik toplamı. */
export function sumPayrollSettledContentExpenses(
  expenses: ContentExpense[],
  employeeId: string,
  month: string
): number {
  return expenses
    .filter(
      (e) =>
        e.employeeId === employeeId &&
        e.month === month &&
        (e.salaryExtraId || e.settlementMode === "payroll") &&
        e.reviewStatus !== "rejected" &&
        e.reviewStatus !== "cancelled"
    )
    .reduce((s, e) => s + e.amountUsd, 0);
}

/** Bu ay için `paid` işaretli içerik harcamaları. */
export function sumPaidContentExpenses(
  expenses: ContentExpense[],
  employeeId: string,
  month: string
): number {
  return expenses
    .filter(
      (e) =>
        e.employeeId === employeeId &&
        e.month === month &&
        e.paid &&
        e.reviewStatus !== "cancelled" &&
        e.reviewStatus !== "rejected",
    )
    .reduce((s, e) => s + e.amountUsd, 0);
}

/** Maaş ödemesi işaretliyse net ödenecek tutar, değilse 0. */
export function salaryPaidOutForMonth(
  employee: Employee,
  month: string,
  advances: Advance[],
  extras: SalaryExtra[],
  paymentStatuses: MonthPaymentStatus[],
  contentExpenses: ContentExpense[] = [],
): number {
  if (!isPayrollActive(employee, month)) return 0;
  const lines = buildPayrollPaymentLines(
    employee,
    month,
    advances,
    extras,
    contentExpenses,
    paymentStatuses,
  );
  if (lines.length > 0 && lines.some((l) => l.paid)) {
    return sumPaidPayrollLines(lines);
  }
  const st = paymentStatuses.find((p) => p.employeeId === employee.id && p.month === month);
  if (!st?.paid) return 0;
  return calcNetPayable(employee, month, advances, extras, paymentStatuses);
}

/** Maaş (ödenen kısım) + içerik harcamalarında ödenen. */
export function totalCashOutPaidForMonth(
  employee: Employee,
  month: string,
  advances: Advance[],
  extras: SalaryExtra[],
  paymentStatuses: MonthPaymentStatus[],
  contentExpenses: ContentExpense[]
): number {
  return (
    salaryPaidOutForMonth(employee, month, advances, extras, paymentStatuses) +
    sumPaidContentExpenses(contentExpenses, employee.id, month)
  );
}

/**
 * Bordroya işlenmiş içerik harcaması, salary_extra satırı oluşturulmadan kalmışsa
 * (settlement_mode=payroll ama salary_extra_id boş) — net ödemeye eklenir.
 */
export function payrollSettledContentNotInExtras(
  employeeId: string,
  month: string,
  extras: SalaryExtra[],
  contentExpenses: ContentExpense[]
): number {
  const linkedFromExtras = extras
    .filter(
      (e) =>
        e.employeeId === employeeId &&
        e.month === month &&
        e.contentExpenseId,
    )
    .reduce((s, e) => s + e.amount, 0);

  const payrollSettled = sumPayrollSettledContentExpenses(
    contentExpenses,
    employeeId,
    month,
  );
  return Math.max(0, payrollSettled - linkedFromExtras);
}

/**
 * Bu ay ödenecek toplam: bordro neti + bordroya işlenmiş içerik (eksik kalem) + onaylı bekleyen içerik.
 */
export function calcPayrollPayoutDue(
  employee: Employee,
  month: string,
  advances: Advance[],
  extras: SalaryExtra[],
  paymentStatuses: MonthPaymentStatus[],
  contentExpenses: ContentExpense[],
): number {
  if (!isPayrollActive(employee, month)) {
    return sumApprovedContentExpenses(contentExpenses, employee.id, month);
  }
  const net = calcNetPayable(employee, month, advances, extras, paymentStatuses);
  const orphanPayroll = payrollSettledContentNotInExtras(
    employee.id,
    month,
    extras,
    contentExpenses,
  );
  const pendingApproved = sumApprovedContentExpenses(
    contentExpenses,
    employee.id,
    month,
  );
  return net + orphanPayroll + pendingApproved;
}

/** Planlanan ay çıkışı — `calcPayrollPayoutDue` ile aynı. */
export function plannedPayrollPlusApprovedContent(
  employee: Employee,
  month: string,
  advances: Advance[],
  extras: SalaryExtra[],
  paymentStatuses: MonthPaymentStatus[],
  contentExpenses: ContentExpense[]
): number {
  return calcPayrollPayoutDue(
    employee,
    month,
    advances,
    extras,
    paymentStatuses,
    contentExpenses,
  );
}

/**
 * `settlement_mode=payroll` olan ama salary_extra oluşturulmamış içerik harcamaları için
 * bordro kalemi üretir (çift kayıt oluşturmaz).
 */
export function reconcilePayrollSettledContentExtras(
  salaryExtras: SalaryExtra[],
  contentExpenses: ContentExpense[],
): { salaryExtras: SalaryExtra[]; contentExpenses: ContentExpense[] } {
  let extras = [...salaryExtras];
  let expenses = [...contentExpenses];

  for (const exp of contentExpenses) {
    if (exp.reviewStatus === "cancelled" || exp.reviewStatus === "rejected") continue;
    const isPayroll =
      exp.settlementMode === "payroll" || Boolean(exp.salaryExtraId);
    if (!isPayroll) continue;

    const linked = extras.find((e) => e.contentExpenseId === exp.id);
    if (linked) {
      if (!exp.salaryExtraId || exp.settlementMode !== "payroll") {
        expenses = expenses.map((e) =>
          e.id === exp.id
            ? {
                ...e,
                salaryExtraId: linked.id,
                settlementMode: "payroll" as const,
              }
            : e,
        );
      }
      continue;
    }

    if (exp.salaryExtraId) continue;

    const extraId = `se-ce-${exp.id}`;
    const desc = `İçerik: ${exp.brandName} · ${exp.category}${exp.description ? ` — ${exp.description.slice(0, 80)}` : ""}`;
    const newExtra: SalaryExtra = {
      id: extraId,
      employeeId: exp.employeeId,
      month: exp.month,
      amount: exp.amountUsd,
      description: desc,
      type: "expense",
      contentExpenseId: exp.id,
    };
    extras = extras.filter((e) => e.contentExpenseId !== exp.id);
    extras.push(newExtra);
    expenses = expenses.map((e) =>
      e.id === exp.id
        ? {
            ...e,
            salaryExtraId: extraId,
            settlementMode: "payroll" as const,
            reviewStatus:
              e.reviewStatus === "pending" || e.reviewStatus === "needs_info"
                ? ("approved" as const)
                : e.reviewStatus,
          }
        : e,
    );
  }

  return { salaryExtras: extras, contentExpenses: expenses };
}

/** Belirli bir tarihe (veya günün sonuna) kadar kasa bakiyesini hesaplar (USD). */
export function calcKasaBalance(
  txns: KasaTransaction[],
  asOfDate?: string,
  kasaId?: string,
): number {
  const filtered = kasaId ? txns.filter((t) => t.kasaId === kasaId) : txns;
  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
  let balance = 0;
  for (const t of sorted) {
    if (asOfDate && t.date > asOfDate) break;
    if (t.direction === "in") balance += t.amountUsd;
    else                       balance -= (t.amountUsd + t.feeUsd);
  }
  return balance;
}

/** Bir markaya ait toplam content expense (verilen ay için). */
export function calcContentExpenseByBrand(
  expenses: ContentExpense[],
  brandName: string,
  month?: string
): number {
  return expenses
    .filter((e) => e.brandName === brandName && (!month || e.month === month))
    .reduce((s, e) => s + e.amountUsd, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Yardımcı sabitler
// ─────────────────────────────────────────────────────────────────────────────

export const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;
export const WEEKDAYS_LONG = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"] as const;

export const SOCIAL_PLATFORMS = ["Instagram", "Kick", "TikTok", "YouTube", "Twitter / X", "Twitch", "Telegram", "Discord", "Diğer"] as const;
