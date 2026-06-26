// Faz 3: Marka Personel & Takip tipleri (brand-scoped HR-lite)

export type StaffStatus = "active" | "passive" | "invited";
export type StaffCurrency = "USD" | "EUR" | "TRY";

export interface BrandStaff {
  id: string;
  brandId: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  status: StaffStatus;
  monthlyCost: number;
  currency: StaffCurrency;
  avatar: string;
  notes: string;
  /** Atandığı departman (brand_departments.id). Atanmamışsa undefined. */
  departmentId?: string;
  /** Bordro kalemleri — maaş bileşenleri (kolon yoksa 0 kabul edilir). */
  baseSalary?: number;
  rentSupport?: number;
  mealAllowance?: number;
  createdAt: string;
  updatedAt: string;
}

/** Marka departmanı (İK/organizasyon). */
export interface BrandDepartment {
  id: string;
  brandId: string;
  name: string;
  description: string;
  leadStaffId?: string;
  createdAt: string;
  updatedAt: string;
}

export type PayrollItemType = "advance" | "bonus" | "deduction" | "rent" | "meal" | "other";

/** Sabit maaş bileşeni (baz / kira / yemek) — ayrı ödeme takibi. */
export type PayrollComponentKey = "base_salary" | "rent" | "meal";

export const PAYROLL_COMPONENT_LABELS: Record<PayrollComponentKey, string> = {
  base_salary: "Temel maaş",
  rent: "Kira desteği",
  meal: "Yemek yardımı",
};

export interface BrandPayrollComponentPayment {
  brandId: string;
  staffId: string;
  month: string;
  component: PayrollComponentKey;
  paid: boolean;
  paidDate?: string;
}

/** Aylık bordro kalemi (avans, prim, kesinti, kira/yemek ek, diğer). */
export interface BrandPayrollItem {
  id: string;
  brandId: string;
  staffId: string;
  /** YYYY-MM */
  month: string;
  type: PayrollItemType;
  amount: number;
  currency: StaffCurrency;
  description: string;
  paid: boolean;
  paidDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";

export interface BrandStaffTask {
  id: string;
  brandId: string;
  staffId?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandStaffShift {
  id: string;
  brandId: string;
  staffId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandStaffActivity {
  id: string;
  brandId: string;
  staffId?: string;
  actorUserId?: string;
  actorName: string;
  type: string;
  detail: string;
  createdAt: string;
}

// ── Mesai / Puantaj (giriş-çıkış-mola) ───────────────────────────────────────
export type AttendanceStatus = "in" | "on_break" | "out";

export interface BrandStaffAttendance {
  id: string;
  brandId: string;
  staffId: string;
  /** YYYY-MM-DD */
  workDate: string;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
  /** Tamamlanan molaların toplamı (dakika). */
  breakMinutes: number;
  /** Şu an molada ise molanın başladığı an (ISO). */
  breakStartedAt?: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  in: "Mesaide",
  on_break: "Molada",
  out: "Çıkış yaptı",
};

export type AttendanceAction = "check_in" | "break_start" | "break_end" | "check_out";

/** Net çalışılan dakika (varsa çıkış, yoksa "şimdi"ye kadar) — mola düşülür. */
export function attendanceWorkedMinutes(a: BrandStaffAttendance, nowMs = Date.now()): number {
  if (!a.checkIn) return 0;
  const start = new Date(a.checkIn).getTime();
  const end = a.checkOut ? new Date(a.checkOut).getTime() : nowMs;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  let liveBreak = 0;
  if (a.status === "on_break" && a.breakStartedAt) {
    const bs = new Date(a.breakStartedAt).getTime();
    if (Number.isFinite(bs) && nowMs > bs) liveBreak = (nowMs - bs) / 60000;
  }
  const gross = (end - start) / 60000;
  const net = gross - a.breakMinutes - liveBreak;
  return Math.max(0, Math.round(net));
}

// ── Personel duyuruları / bilgilendirme ──────────────────────────────────────
export type AnnouncementAudience = "all" | "department" | "staff";
export type AnnouncementLevel = "info" | "warning" | "urgent";

export interface BrandStaffAnnouncement {
  id: string;
  brandId: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  departmentId?: string;
  staffId?: string;
  level: AnnouncementLevel;
  pinned: boolean;
  createdBy?: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export const ANNOUNCEMENT_LEVEL_LABELS: Record<AnnouncementLevel, string> = {
  info: "Bilgi",
  warning: "Uyarı",
  urgent: "Acil",
};

export const ANNOUNCEMENT_AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  all: "Tüm ekip",
  department: "Departman",
  staff: "Kişi",
};

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  active: "Aktif",
  passive: "Pasif",
  invited: "Davetli",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Yapılacak",
  in_progress: "Devam ediyor",
  done: "Tamamlandı",
  cancelled: "İptal",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
};

export const STAFF_CURRENCY_SYMBOL: Record<StaffCurrency, string> = {
  USD: "$",
  EUR: "€",
  TRY: "₺",
};

export const PAYROLL_ITEM_TYPE_LABELS: Record<PayrollItemType, string> = {
  advance: "Avans",
  bonus: "Prim",
  deduction: "Kesinti",
  rent: "Kira desteği",
  meal: "Yemek yardımı",
  other: "Diğer",
};

/** Net hesaplamada kesinti sayılan kalem tipleri (net'ten düşülür). */
export const PAYROLL_DEDUCTION_TYPES: readonly PayrollItemType[] = ["advance", "deduction"];

/** Net hesaplamada eklenen (kazanç) kalem tipleri (net'e eklenir). */
export const PAYROLL_EARNING_TYPES: readonly PayrollItemType[] = ["bonus", "rent", "meal", "other"];

/** Bir bordro kaleminin net ödenecek tutara etkisi (+kazanç / -kesinti). */
export function payrollItemSignedAmount(item: Pick<BrandPayrollItem, "type" | "amount">): number {
  const amt = Number.isFinite(item.amount) ? item.amount : 0;
  return (PAYROLL_DEDUCTION_TYPES as readonly string[]).includes(item.type) ? -amt : amt;
}

/** Ortalama aylık çalışma saati varsayımı (≈22 gün × 8 sa) — saatlik ücret tahmini için. */
export const MONTHLY_WORK_HOURS = 176;

/** "HH:MM" → dakika cinsinden değer; geçersizse null. */
function parseHm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Vardiya süresini saat cinsinden hesaplar. Gece vardiyalarında (bitiş ≤ başlangıç)
 * 24 saat eklenir. Geçersiz girişte 0 döner.
 */
export function shiftHours(startTime: string, endTime: string): number {
  const start = parseHm(startTime);
  let end = parseHm(endTime);
  if (start == null || end == null) return 0;
  if (end <= start) end += 24 * 60;
  return Math.round(((end - start) / 60) * 100) / 100;
}

/** Saat değerini Türkçe biçimlendirir: 8 → "8 sa", 8.5 → "8,5 sa". */
export function formatHours(hours: number): string {
  return `${hours.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} sa`;
}

/** Aylık maliyetten kabaca saatlik ücret türetir (MONTHLY_WORK_HOURS varsayımıyla). */
export function hourlyRate(monthlyCost: number): number {
  if (!Number.isFinite(monthlyCost) || monthlyCost <= 0) return 0;
  return monthlyCost / MONTHLY_WORK_HOURS;
}
