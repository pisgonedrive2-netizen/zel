import type {
  AffiliatePartner,
  AffiliatePayout,
} from "@/store/store";

export const PARTNER_TYPE_OPTIONS: {
  value: AffiliatePartner["partnerType"];
  label: string;
}[] = [
  { value: "streamer", label: "Yayıncı" },
  { value: "external", label: "Dış partner" },
  { value: "agency", label: "Ajans" },
  { value: "social", label: "Sosyal" },
];

export const COMMISSION_MODEL_OPTIONS: {
  value: AffiliatePartner["commissionModel"];
  label: string;
}[] = [
  { value: "cpa", label: "CPA" },
  { value: "revshare", label: "RevShare" },
  { value: "hybrid", label: "Hybrid" },
  { value: "flat", label: "Sabit" },
];

export const CURRENCY_OPTIONS: {
  value: AffiliatePartner["currency"];
  label: string;
}[] = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "TRY", label: "TRY (₺)" },
];

export const PARTNER_STATUS_OPTIONS: {
  value: AffiliatePartner["status"];
  label: string;
}[] = [
  { value: "active", label: "Aktif" },
  { value: "paused", label: "Duraklatıldı" },
  { value: "closed", label: "Kapalı" },
];

export const PAYOUT_STATUS_OPTIONS: {
  value: AffiliatePayout["status"];
  label: string;
}[] = [
  { value: "pending", label: "Bekliyor" },
  { value: "approved", label: "Onaylandı" },
  { value: "paid", label: "Ödendi" },
  { value: "cancelled", label: "İptal" },
];

export function partnerTypeLabel(t: string): string {
  return PARTNER_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

export function commissionLabel(model: string): string {
  return COMMISSION_MODEL_OPTIONS.find((o) => o.value === model)?.label ?? model;
}

export function partnerStatusLabel(s: string): string {
  return PARTNER_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

export function payoutStatusLabel(s: string): string {
  return PAYOUT_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

export function payoutStatusBadgeClass(s: AffiliatePayout["status"]): string {
  switch (s) {
    case "paid":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300";
    case "approved":
      return "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300";
    case "cancelled":
      return "bg-muted text-muted-foreground line-through";
    case "pending":
    default:
      return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
  }
}

export function partnerStatusBadgeClass(s: AffiliatePartner["status"]): string {
  switch (s) {
    case "active":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300";
    case "paused":
      return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
    case "closed":
    default:
      return "bg-muted text-muted-foreground";
  }
}
