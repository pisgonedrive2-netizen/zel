import type { ContentExpense } from "@/store/store";

export type ExpenseReviewStatus = NonNullable<ContentExpense["reviewStatus"]>;

export function expenseReviewStatus(e: ContentExpense): ExpenseReviewStatus {
  return e.reviewStatus ?? (e.paid ? "approved" : "pending");
}

export function canStreamerWithdrawExpense(e: ContentExpense): boolean {
  const s = expenseReviewStatus(e);
  return s === "pending" || s === "needs_info";
}

export function canStreamerEditExpense(e: ContentExpense): boolean {
  return canStreamerWithdrawExpense(e);
}

export function countsTowardPayroll(e: ContentExpense): boolean {
  const s = expenseReviewStatus(e);
  return s !== "rejected" && s !== "cancelled" && s !== "pending" && s !== "needs_info";
}

/** Bordroya masraf olarak işlendi mi? */
export function isPayrollSettled(e: ContentExpense): boolean {
  return e.settlementMode === "payroll" || Boolean(e.salaryExtraId);
}

/** Kasadan ödendi mi? */
export function isKasaSettled(e: ContentExpense): boolean {
  return e.settlementMode === "kasa" || Boolean(e.kasaTxId && e.paid);
}

export type ContentExpenseSettlementFilter =
  | "all"
  | "awaiting"
  | "payroll"
  | "kasa"
  | "conflict";

/** Filtre: ödeme yolu. */
export function matchesSettlementFilter(
  e: ContentExpense,
  filter: ContentExpenseSettlementFilter,
  opts?: { hasConflict?: boolean }
): boolean {
  if (filter === "all") return true;
  if (filter === "conflict") return Boolean(opts?.hasConflict);
  if (filter === "kasa") return isKasaSettled(e);
  if (filter === "payroll") return isPayrollSettled(e) && !isKasaSettled(e);
  if (filter === "awaiting") {
    const s = expenseReviewStatus(e);
    return (
      s === "approved" && !isPayrollSettled(e) && !isKasaSettled(e)
    );
  }
  return true;
}

/**
 * Çift ödeme riski: hem bordro kalemi hem kasa hareketi bağlı / işaretli.
 * (Veri tutarsızlığı — düzeltilmeli.)
 */
export function hasDoubleSettlementConflict(
  e: ContentExpense,
  opts?: {
    salaryExtras?: { id: string; contentExpenseId?: string }[];
    kasaTransactions?: { id: string; notes?: string; purpose?: string }[];
  }
): boolean {
  const extras = opts?.salaryExtras ?? [];
  const txs = opts?.kasaTransactions ?? [];
  const tag = `[ICEXP:${e.id}]`;
  const payrollLink =
    e.settlementMode === "payroll" ||
    Boolean(e.salaryExtraId) ||
    extras.some((x) => x.contentExpenseId === e.id || x.id === e.salaryExtraId);
  const kasaLink =
    e.settlementMode === "kasa" ||
    Boolean(e.kasaTxId && e.paid) ||
    txs.some((t) => {
      if (e.kasaTxId && t.id === e.kasaTxId) return true;
      const blob = `${t.notes ?? ""} ${t.purpose ?? ""}`;
      return blob.includes(tag);
    });
  return payrollLink && kasaLink;
}

/**
 * Onaylı ama henüz kasa/bordro ile kapatılmamış — plan toplamına eklenir.
 * Bordroya eklenenler zaten salary_extras üzerinden nete dahildir.
 */
export function isUnsettledApprovedContent(e: ContentExpense): boolean {
  const s = expenseReviewStatus(e);
  if (s === "rejected" || s === "cancelled" || s === "pending" || s === "needs_info") {
    return false;
  }
  return !isPayrollSettled(e) && !isKasaSettled(e);
}

/**
 * Yönetici kasadan ödeyebilir / maaştan kasaya taşıyabilir.
 * Onaylı + henüz kasadan ödenmemiş (bordroda olanlar dahil).
 */
export function canAdminPayContentFromKasa(e: ContentExpense): boolean {
  const s = expenseReviewStatus(e);
  if (s === "rejected" || s === "cancelled" || s === "pending" || s === "needs_info") {
    return false;
  }
  return !isKasaSettled(e);
}

/** Maaşa yazılmış, kasaya taşınabilir. */
export function canConvertPayrollToKasa(e: ContentExpense): boolean {
  return isPayrollSettled(e) && !isKasaSettled(e) && expenseReviewStatus(e) === "approved";
}

export const CONTENT_EXPENSE_CATEGORIES = [
  "Vlog",
  "Yetişkin İçerik",
  "Site Videoları",
  "Yol",
  "Reklam",
  "Ekipman",
  "Diğer",
] as const;

export function settlementLabel(e: ContentExpense): string {
  if (isKasaSettled(e)) return "Kasadan ödendi";
  if (isPayrollSettled(e)) return "Maaşa masraf";
  const s = expenseReviewStatus(e);
  if (s === "approved") return "Onaylı · ödeme bekliyor";
  if (s === "pending") return "İncelemede";
  if (s === "needs_info") return "Bilgi istendi";
  if (s === "rejected") return "Reddedildi";
  if (s === "cancelled") return "Geri çekildi";
  return "—";
}

/**
 * Açıklamada "kasadan düşülecek" (yazım hataları dahil) varsa
 * ödeme yolu kasa olmalı — maaşa yazılmaz.
 */
export function descriptionRequestsKasaSettlement(
  description: string | null | undefined
): boolean {
  const d = (description ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  // düşülecek / dusulecek / düşükecek / dusukecek / düşecek …
  return /kasadan\s*d[uü]?[sş][uü]?[sşk]?[eé]?[cç]?e?k?/.test(d) || /kasadan\s*dus/.test(d);
}

export function expenseRequestsKasaSettlement(e: {
  description?: string | null;
}): boolean {
  return descriptionRequestsKasaSettlement(e.description);
}

/**
 * Kasa hareketi açıklaması: yayıncının yazdığı isim/açıklama.
 * Marka·kategori şablonu kullanılmaz.
 */
export function contentExpenseKasaPurpose(e: ContentExpense): string {
  const desc = (e.description ?? "").trim().replace(/\s+/g, " ");
  if (desc) return desc.slice(0, 200);
  const brand = (e.brandName ?? "").trim();
  const cat = (e.category ?? "").trim();
  if (brand && cat) return `${brand} · ${cat}`;
  return brand || cat || "İçerik harcaması";
}

/**
 * Kasa listesinde sıralama için tarih: harcamanın eklendiği gün (+ gönderim saati).
 * Ödeme (paidDate) değil; yayıncının kayıt tarihi.
 */
export function contentExpenseKasaTxDate(e: ContentExpense): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : e.date.slice(0, 10);
  if (e.submittedAt) {
    const d = new Date(e.submittedAt);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${day}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    }
  }
  return `${day}T00:00`;
}

/**
 * "Hareketli" (aktif) harcama: reddedilmemiş ve geri çekilmemiş.
 * Toplamlar, grafikler ve KPI'lar bu filtreyi kullanmalı; aksi halde
 * yayıncının iptal ettiği talepler hâlâ tabloda/grafikte sayılır.
 */
export function isActiveContentExpense(e: ContentExpense): boolean {
  const s = expenseReviewStatus(e);
  return s !== "rejected" && s !== "cancelled";
}
