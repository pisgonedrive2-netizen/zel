// Faz 5: Marka muhasebe tipleri (brand-scoped)

export type AccCurrency = "USD" | "EUR" | "TRY";
export type LedgerDirection = "income" | "expense";
export type LedgerSource = "manual" | "affiliate_payout" | "crm_deal" | "staff_cost" | "invoice" | "deal_milestone";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface BrandLedgerEntry {
  id: string;
  brandId: string;
  entryDate: string;
  direction: LedgerDirection;
  category: string;
  description: string;
  amount: number;
  currency: AccCurrency;
  source: LedgerSource;
  refId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandInvoice {
  id: string;
  brandId: string;
  number: string;
  contactId?: string;
  title: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate?: string;
  amount: number;
  taxPct: number;
  currency: AccCurrency;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export const LEDGER_SOURCE_LABELS: Record<LedgerSource, string> = {
  manual: "Manuel",
  affiliate_payout: "Affiliate ödeme",
  crm_deal: "CRM anlaşması",
  staff_cost: "Personel maliyeti",
  invoice: "Fatura",
  deal_milestone: "Anlaşma milestone",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Taslak",
  sent: "Gönderildi",
  paid: "Ödendi",
  overdue: "Gecikti",
  cancelled: "İptal",
};

/**
 * iGaming (online bahis/casino) odaklı önayar kategoriler.
 * `category` serbest metin olduğu için bunlar yalnızca öneri/seçim kolaylığıdır;
 * kullanıcı kendi metnini de yazabilir (şema değişikliği yok).
 */
export const LEDGER_EXPENSE_CATEGORIES: readonly string[] = [
  "Affiliate ödeme — CPA",
  "Affiliate ödeme — RevShare",
  "Bonus maliyeti",
  "PSP / ödeme komisyonu",
  "Lisans & regülasyon",
  "Pazarlama & reklam",
  "Yayıncı içerik ödemesi",
  "Personel maliyeti",
  "Yazılım / sağlayıcı",
  "Vergi",
  "Diğer",
];

export const LEDGER_INCOME_CATEGORIES: readonly string[] = [
  "Operatör geliri / komisyon",
  "Affiliate geliri",
  "Diğer gelir",
];
