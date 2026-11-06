import type { ContentExpense } from "@/store/store";
import { isMainAdmin } from "@/lib/user-guards";

export type ExpenseReviewStatus = NonNullable<ContentExpense["reviewStatus"]>;

/** Yönetici elzem / hack / hibe işaretleri — notes içinde `[exc:…]` ile saklanır. */
export type ContentExpenseExceptionKind = "hibe" | "hack" | "elzem" | "diger";

export const CONTENT_EXPENSE_EXCEPTION_KINDS: ContentExpenseExceptionKind[] = [
  "hibe",
  "hack",
  "elzem",
  "diger",
];

export const CONTENT_EXPENSE_EXCEPTION_LABELS: Record<
  ContentExpenseExceptionKind,
  string
> = {
  hibe: "Hibe edildi",
  hack: "Hack / güvenlik",
  elzem: "Elzem durum",
  diger: "Özel durum",
};

/** `[exc:hibe|kısa not]` — notes sonuna gömülür (kolon migration’sız). */
export const EXPENSE_EXC_RE = /\[exc:(hibe|hack|elzem|diger)(?:\|([^\]]*))?\]/;

export function parseExpenseException(notes: string | undefined | null): {
  kind?: ContentExpenseExceptionKind;
  note?: string;
} {
  const m = String(notes ?? "").match(EXPENSE_EXC_RE);
  if (!m) return {};
  return {
    kind: m[1] as ContentExpenseExceptionKind,
    note: (m[2] ?? "").trim() || undefined,
  };
}

export function encodeExpenseExceptionInNotes(
  notes: string | undefined | null,
  kind: ContentExpenseExceptionKind | undefined,
  note: string | undefined,
): string {
  const cleaned = String(notes ?? "")
    .replace(EXPENSE_EXC_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!kind) return cleaned;
  const safeNote = (note ?? "").replace(/[\[\]]/g, "").trim().slice(0, 120);
  const tag = safeNote ? `[exc:${kind}|${safeNote}]` : `[exc:${kind}]`;
  return cleaned ? `${cleaned}\n${tag}` : tag;
}

export function resolveExpenseException(
  e: Pick<ContentExpense, "exceptionKind" | "exceptionNote" | "notes">,
): { kind?: ContentExpenseExceptionKind; note?: string } {
  if (e.exceptionKind) {
    return { kind: e.exceptionKind, note: e.exceptionNote };
  }
  return parseExpenseException(e.notes);
}

/** Hibe / hack: bordro borcuna yazılmaz (ödeme yapılmaz / yazıldıysa netten düşülmeli). */
export function isExceptionWriteOff(e: ContentExpense): boolean {
  const kind = resolveExpenseException(e).kind;
  return kind === "hibe" || kind === "hack";
}

export function exceptionLabel(e: ContentExpense): string | null {
  const { kind, note } = resolveExpenseException(e);
  if (!kind) return null;
  const base = CONTENT_EXPENSE_EXCEPTION_LABELS[kind];
  return note ? `${base} · ${note}` : base;
}

export function expenseReviewStatus(e: ContentExpense): ExpenseReviewStatus {
  return e.reviewStatus ?? (e.paid ? "approved" : "pending");
}

/** Bordro kalemi bağlı mı? (harcama satırı gecikmiş olsa bile) */
export function isPayrollLinkedContentExpense(
  e: ContentExpense,
  salaryExtras: { contentExpenseId?: string }[] = [],
): boolean {
  if (e.settlementMode === "payroll" || Boolean(e.salaryExtraId)) return true;
  return salaryExtras.some((x) => x.contentExpenseId === e.id);
}

/** Onay Merkezi / “incelemede” — maaşa veya kasaya kapanmış olanlar dahil değil. */
export function isAwaitingContentExpenseReview(
  e: ContentExpense,
  salaryExtras: { contentExpenseId?: string }[] = [],
): boolean {
  const s = expenseReviewStatus(e);
  if (s !== "pending" && s !== "needs_info") return false;
  if (isContentSettled(e)) return false;
  if (isPayrollLinkedContentExpense(e, salaryExtras)) return false;
  return true;
}

export function canStreamerWithdrawExpense(e: ContentExpense): boolean {
  if (isKasaSettled(e) || isPayrollSettled(e)) return false;
  const s = expenseReviewStatus(e);
  // İncelemede / bilgi istenen / henüz ödenmemiş onaylı
  return s === "pending" || s === "needs_info" || s === "approved";
}

export function canStreamerEditExpense(e: ContentExpense): boolean {
  const s = expenseReviewStatus(e);
  return s === "pending" || s === "needs_info";
}

const STREAMER_CLEARED_TAG = "[streamer_cleared]";

/** Harcama mevcut kasa çıkışına bağlandı — unpay kasa hareketini silmez. */
export const ICEXP_LINK_ONLY_TAG = "[ICEXP_LINK_ONLY]";

export function isKasaLinkOnlyExpense(e: Pick<ContentExpense, "notes">): boolean {
  return /\[ICEXP_LINK_ONLY\]/i.test(e.notes ?? "");
}

export function withKasaLinkOnlyNotes(notes: string | undefined | null): string {
  const base = String(notes ?? "").trim();
  if (/\[ICEXP_LINK_ONLY\]/i.test(base)) return base;
  return base ? `${base} ${ICEXP_LINK_ONLY_TAG}` : ICEXP_LINK_ONLY_TAG;
}

export function stripKasaLinkOnlyFromNotes(notes: string | undefined | null): string {
  return String(notes ?? "")
    .replace(/\[ICEXP_LINK_ONLY\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Yayıncı geri çekilen kaydı listesinden kaldırdı mı? (Orkun arşivi durur.) */
export function isStreamerClearedExpense(e: ContentExpense): boolean {
  return /\[streamer_cleared\]/i.test(e.notes ?? "");
}

export function withStreamerClearedNotes(notes: string): string {
  const base = notes ?? "";
  if (/\[streamer_cleared\]/i.test(base)) return base;
  return `${base} ${STREAMER_CLEARED_TAG}`.trim();
}

/**
 * Yayıncı kalıcı silebilir: incelemede / bilgi istenen (hard delete).
 * Geri çekilenlerde soft-clear: listeden kalkar, Orkun arşivinde kalır.
 */
export function canStreamerDeleteExpense(e: ContentExpense): boolean {
  if (isKasaSettled(e) || isPayrollSettled(e)) return false;
  const s = expenseReviewStatus(e);
  if (s === "cancelled") return !isStreamerClearedExpense(e);
  return s === "pending" || s === "needs_info";
}

/** Geri çekilmiş (iptal) içerik harcaması mı? */
export function isWithdrawnContentExpense(e: ContentExpense): boolean {
  return expenseReviewStatus(e) === "cancelled";
}

/** Ana yönetici ekibe görünürlük vermiş mi? */
export function isContentExpenseReleasedToTeam(e: ContentExpense): boolean {
  return Boolean(e.adminReleasedAt);
}

export function contentExpenseReleasePatch(
  releasedBy: string,
  at = new Date().toISOString(),
): Pick<ContentExpense, "adminReleasedAt" | "adminReleasedBy"> {
  return { adminReleasedAt: at, adminReleasedBy: releasedBy };
}

/**
 * Yönetici / denetçi görünürlüğü: geri çekilenler yalnızca Orkun.
 * Yayıncı tarafı için `canStreamerSeeOwnExpense` kullan.
 */
export function canViewerSeeContentExpense(
  e: ContentExpense,
  viewer: { id?: string; username?: string } | null | undefined,
): boolean {
  if (isWithdrawnContentExpense(e)) {
    if (!viewer?.id && !viewer?.username) return false;
    return isMainAdmin({
      id: viewer.id ?? "",
      username: viewer.username ?? "",
    });
  }
  if (isContentExpenseReleasedToTeam(e)) return true;
  if (!viewer?.id && !viewer?.username) return false;
  return isMainAdmin({
    id: viewer.id ?? "",
    username: viewer.username ?? "",
  });
}

/** Yayıncı kendi listesinde: geri çekilen, soft-clear edilene kadar görünür. */
export function canStreamerSeeOwnExpense(e: ContentExpense): boolean {
  if (!isWithdrawnContentExpense(e)) return true;
  return !isStreamerClearedExpense(e);
}

/** Liste / KPI için: yöneticinin görebileceği harcamalar. */
export function filterContentExpensesForViewer<T extends ContentExpense>(
  expenses: T[],
  viewer: { id?: string; username?: string } | null | undefined,
): T[] {
  return expenses.filter((e) => canViewerSeeContentExpense(e, viewer));
}

export function countsTowardPayroll(e: ContentExpense): boolean {
  const s = expenseReviewStatus(e);
  if (s === "rejected" || s === "cancelled" || s === "pending" || s === "needs_info") {
    return false;
  }
  if (isExceptionWriteOff(e)) return false;
  return true;
}

/** Bordroya masraf olarak işlendi mi? */
export function isPayrollSettled(e: ContentExpense): boolean {
  return e.settlementMode === "payroll" || Boolean(e.salaryExtraId);
}

/** Kasa notundaki `[ICEXP:id]` etiketinden harcama id’si. */
export function kasaTxContentExpenseId(t: {
  notes?: string;
  purpose?: string;
}): string | null {
  const m = `${t.notes ?? ""} ${t.purpose ?? ""}`.match(/\[ICEXP:([^\]]+)\]/);
  return m?.[1]?.trim() || null;
}

/**
 * Kasada `[ICEXP:…]` hareketi varken harcama satırı `paid` / `kasa_tx_id`
 * kaybetmişse yeniden bağlar. Onay kaydı sonradan gelip bağlantıyı ezdiğinde
 * “onaylı · ödeme bekliyor” görünmesini keser.
 */
export function reconcileKasaLinkedContentExpenses<
  T extends ContentExpense,
>(
  expenses: T[],
  txs: { id: string; date: string; notes?: string; purpose?: string; direction?: string }[],
): { expenses: T[]; changed: T[] } {
  const byExp = new Map<string, { id: string; date: string }>();
  for (const t of txs) {
    if (t.direction && t.direction !== "out") continue;
    const id = kasaTxContentExpenseId(t);
    if (!id || byExp.has(id)) continue;
    byExp.set(id, { id: t.id, date: (t.date ?? "").slice(0, 10) });
  }
  const changed: T[] = [];
  const next = expenses.map((e) => {
    const link = byExp.get(e.id);
    if (!link) return e;
    const s = expenseReviewStatus(e);
    if (s === "cancelled" || s === "rejected") return e;
    if (e.paid && e.kasaTxId === link.id && e.settlementMode === "kasa" && !e.salaryExtraId) {
      return e;
    }
    const row = {
      ...e,
      paid: true,
      paidDate: e.paidDate || link.date || undefined,
      kasaTxId: link.id,
      settlementMode: "kasa" as const,
      salaryExtraId: undefined,
      reviewStatus:
        s === "pending" || s === "needs_info" ? ("approved" as const) : e.reviewStatus,
    };
    changed.push(row);
    return row;
  });
  return { expenses: changed.length ? next : expenses, changed };
}

/** Kasadan ödendi mi? */
export function isKasaSettled(e: ContentExpense): boolean {
  if (e.settlementMode === "kasa") return true;
  if (e.kasaTxId && e.paid) return true;
  // Eski kayıtlar: paid=true ama settlement_mode/kasa_tx yok → kasa kapanmış say
  if (
    e.paid &&
    e.settlementMode !== "payroll" &&
    !e.salaryExtraId
  ) {
    return true;
  }
  return false;
}

/** Herhangi bir yolla (kasa / bordro / legacy paid) kapatıldı mı? */
export function isContentSettled(e: ContentExpense): boolean {
  return isKasaSettled(e) || isPayrollSettled(e);
}

/** KPI / filtre: kasa, maaş veya hibe-hack ile kapatılmış mı? */
export function isExpenseCountedPaid(e: ContentExpense): boolean {
  return isContentSettled(e) || isExceptionWriteOff(e);
}

export type ContentExpenseSettlementFilter =
  | "all"
  | "awaiting"
  | "payroll"
  | "kasa"
  | "conflict"
  | "exception"
  | "withdrawn";

/** Filtre: ödeme yolu. */
export function matchesSettlementFilter(
  e: ContentExpense,
  filter: ContentExpenseSettlementFilter,
  opts?: { hasConflict?: boolean }
): boolean {
  if (filter === "all") return true;
  if (filter === "conflict") return Boolean(opts?.hasConflict);
  if (filter === "exception") return Boolean(resolveExpenseException(e).kind);
  if (filter === "withdrawn") return isWithdrawnContentExpense(e);
  if (filter === "kasa") return isKasaSettled(e);
  if (filter === "payroll") return isPayrollSettled(e) && !isKasaSettled(e);
  if (filter === "awaiting") {
    const s = expenseReviewStatus(e);
    return (
      s === "approved" &&
      !isContentSettled(e) &&
      !isExceptionWriteOff(e)
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

/** Çift kapanış (bordro + kasa) çakışması olan harcamaları döner. */
export function listDoubleSettlementConflicts(
  expenses: ContentExpense[],
  opts?: {
    salaryExtras?: { id: string; contentExpenseId?: string }[];
    kasaTransactions?: { id: string; notes?: string; purpose?: string }[];
  }
): ContentExpense[] {
  return expenses.filter((e) => hasDoubleSettlementConflict(e, opts));
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
  if (isExceptionWriteOff(e)) return false;
  return !isContentSettled(e);
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
  if (isExceptionWriteOff(e)) return false;
  return !isKasaSettled(e);
}

/** Maaşa yazılmış, kasaya taşınabilir. */
export function canConvertPayrollToKasa(e: ContentExpense): boolean {
  return (
    isPayrollSettled(e) &&
    !isKasaSettled(e) &&
    expenseReviewStatus(e) === "approved" &&
    !isExceptionWriteOff(e)
  );
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

export function settlementLabel(
  e: ContentExpense,
  salaryExtras: { contentExpenseId?: string }[] = [],
): string {
  const exc = exceptionLabel(e);
  const writeOff =
    resolveExpenseException(e).kind === "hibe" ||
    resolveExpenseException(e).kind === "hack";
  if (exc && writeOff) return exc;
  if (isKasaSettled(e)) {
    if (isKasaLinkOnlyExpense(e)) {
      return exc ? `Önceden ödendi (bağlantı) · ${exc}` : "Önceden ödendi (mevcut kasa)";
    }
    return exc ? `Kasadan ödendi · ${exc}` : "Kasadan ödendi";
  }
  if (isPayrollLinkedContentExpense(e, salaryExtras)) {
    return exc ? `Maaşa eklendi · ${exc}` : "Maaşa eklendi (bordro masrafı)";
  }
  if (isPayrollSettled(e)) return exc ? `Maaşa masraf · ${exc}` : "Maaşa masraf";
  const s = expenseReviewStatus(e);
  if (s === "approved") return exc ? `Onaylı · ${exc}` : "Onaylı · ödeme bekliyor";
  if (s === "pending") return "İncelemede";
  if (s === "needs_info") return "Bilgi istendi";
  if (s === "rejected") return "Reddedildi";
  if (s === "cancelled") return "Geri çekildi";
  return exc ?? "—";
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
  if (s === "rejected" || s === "cancelled") return false;
  if (isExceptionWriteOff(e)) return false;
  return true;
}
