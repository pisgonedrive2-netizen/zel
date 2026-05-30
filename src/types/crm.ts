// Faz 4: Marka CRM tipleri (brand-scoped)

export type CrmCurrency = "USD" | "EUR" | "TRY";
export type ContactStatus = "lead" | "active" | "vip" | "passive" | "lost";
export type DealStage = "lead" | "qualified" | "proposal" | "won" | "lost";
export type InteractionType = "note" | "call" | "email" | "meeting" | "whatsapp" | "telegram";

export interface CrmContact {
  id: string;
  brandId: string;
  name: string;
  company: string;
  email?: string;
  phone?: string;
  telegram?: string;
  source: string;
  status: ContactStatus;
  owner: string;
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmDeal {
  id: string;
  brandId: string;
  contactId?: string;
  title: string;
  stage: DealStage;
  value: number;
  currency: CrmCurrency;
  probability: number;
  expectedClose?: string;
  affiliatePartnerId?: string;
  brandDealId?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmInteraction {
  id: string;
  brandId: string;
  contactId?: string;
  dealId?: string;
  type: InteractionType;
  summary: string;
  actorName: string;
  actorUserId?: string;
  occurredAt: string;
  createdAt: string;
}

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  lead: "Aday",
  active: "Aktif",
  vip: "VIP",
  passive: "Pasif",
  lost: "Kayıp",
};

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  lead: "Aday",
  qualified: "Nitelikli",
  proposal: "Teklif",
  won: "Kazanıldı",
  lost: "Kaybedildi",
};

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  note: "Not",
  call: "Telefon",
  email: "E-posta",
  meeting: "Toplantı",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};
