import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  ContactStatus, CrmContact, CrmCurrency, CrmDeal, CrmInteraction, DealStage, InteractionType,
} from "@/types/crm";

const str = (v: unknown, d = ""): string => (v == null ? d : String(v));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
function pick<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  const s = String(v ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : fb;
}
function strArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [];
}

const CONTACT_STATUS: readonly ContactStatus[] = ["lead", "active", "vip", "passive", "lost"];
const DEAL_STAGE: readonly DealStage[] = ["lead", "qualified", "proposal", "won", "lost"];
const CURRENCY: readonly CrmCurrency[] = ["USD", "EUR", "TRY"];
const INTERACTION: readonly InteractionType[] = ["note", "call", "email", "meeting", "whatsapp", "telegram"];

// ── Contacts ─────────────────────────────────────────────────────────────
function contactFromRow(r: Record<string, unknown>): CrmContact {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    name: str(r.name),
    company: str(r.company),
    email: r.email ? str(r.email) : undefined,
    phone: r.phone ? str(r.phone) : undefined,
    telegram: r.telegram ? str(r.telegram) : undefined,
    source: str(r.source, "manual"),
    status: pick(r.status, CONTACT_STATUS, "lead"),
    owner: str(r.owner),
    tags: strArr(r.tags),
    notes: str(r.notes),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}
function contactToRow(c: CrmContact) {
  return {
    id: c.id,
    brand_id: c.brandId,
    name: c.name,
    company: c.company,
    email: c.email ?? null,
    phone: c.phone ?? null,
    telegram: c.telegram ?? null,
    source: c.source,
    status: c.status,
    owner: c.owner,
    tags: c.tags,
    notes: c.notes,
  };
}

export async function fetchCrmContacts(brandIds: string[]): Promise<CrmContact[]> {
  if (brandIds.length === 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("crm_contacts").select("*").in("brand_id", brandIds).order("created_at", { ascending: false });
  if (error) throw new Error(`crm_contacts: ${error.message}`);
  return (data ?? []).map((r) => contactFromRow(r as Record<string, unknown>));
}

export async function findCrmContactById(id: string): Promise<CrmContact | null> {
  const { data, error } = await getSupabaseAdmin().from("crm_contacts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`crm_contacts: ${error.message}`);
  return data ? contactFromRow(data as Record<string, unknown>) : null;
}

export async function upsertCrmContact(c: CrmContact): Promise<CrmContact> {
  const { data, error } = await getSupabaseAdmin()
    .from("crm_contacts").upsert(contactToRow(c), { onConflict: "id" }).select("*").maybeSingle();
  if (error) throw new Error(`crm_contacts: ${error.message}`);
  if (!data) throw new Error("crm_contacts: upsert sonuç dönmedi.");
  return contactFromRow(data as Record<string, unknown>);
}

export async function deleteCrmContact(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("crm_contacts").delete().eq("id", id);
  if (error) throw new Error(`crm_contacts: ${error.message}`);
}

// ── Deals ────────────────────────────────────────────────────────────────
function dealFromRow(r: Record<string, unknown>): CrmDeal {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    contactId: r.contact_id ? str(r.contact_id) : undefined,
    title: str(r.title),
    stage: pick(r.stage, DEAL_STAGE, "lead"),
    value: num(r.value),
    currency: pick(r.currency, CURRENCY, "USD"),
    probability: Math.min(100, Math.max(0, num(r.probability))),
    expectedClose: r.expected_close ? str(r.expected_close) : undefined,
    affiliatePartnerId: r.affiliate_partner_id ? str(r.affiliate_partner_id) : undefined,
    brandDealId: r.brand_deal_id ? str(r.brand_deal_id) : undefined,
    notes: str(r.notes),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}
function dealToRow(d: CrmDeal) {
  return {
    id: d.id,
    brand_id: d.brandId,
    contact_id: d.contactId ?? null,
    title: d.title,
    stage: d.stage,
    value: d.value,
    currency: d.currency,
    probability: d.probability,
    expected_close: d.expectedClose ?? null,
    affiliate_partner_id: d.affiliatePartnerId ?? null,
    brand_deal_id: d.brandDealId ?? null,
    notes: d.notes,
  };
}

export async function fetchCrmDeals(brandIds: string[]): Promise<CrmDeal[]> {
  if (brandIds.length === 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("crm_deals").select("*").in("brand_id", brandIds).order("created_at", { ascending: false });
  if (error) throw new Error(`crm_deals: ${error.message}`);
  return (data ?? []).map((r) => dealFromRow(r as Record<string, unknown>));
}

export async function upsertCrmDeal(d: CrmDeal): Promise<CrmDeal> {
  const { data, error } = await getSupabaseAdmin()
    .from("crm_deals").upsert(dealToRow(d), { onConflict: "id" }).select("*").maybeSingle();
  if (error) throw new Error(`crm_deals: ${error.message}`);
  if (!data) throw new Error("crm_deals: upsert sonuç dönmedi.");
  return dealFromRow(data as Record<string, unknown>);
}

export async function deleteCrmDeal(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("crm_deals").delete().eq("id", id);
  if (error) throw new Error(`crm_deals: ${error.message}`);
}

// ── Interactions ───────────────────────────────────────────────────────────
function interactionFromRow(r: Record<string, unknown>): CrmInteraction {
  return {
    id: str(r.id),
    brandId: str(r.brand_id),
    contactId: r.contact_id ? str(r.contact_id) : undefined,
    dealId: r.deal_id ? str(r.deal_id) : undefined,
    type: pick(r.type, INTERACTION, "note"),
    summary: str(r.summary),
    actorName: str(r.actor_name),
    actorUserId: r.actor_user_id ? str(r.actor_user_id) : undefined,
    occurredAt: str(r.occurred_at),
    createdAt: str(r.created_at),
  };
}

export async function fetchCrmInteractions(brandIds: string[], contactId?: string): Promise<CrmInteraction[]> {
  if (brandIds.length === 0) return [];
  let q = getSupabaseAdmin()
    .from("crm_interactions").select("*").in("brand_id", brandIds).order("occurred_at", { ascending: false }).limit(300);
  if (contactId) q = q.eq("contact_id", contactId);
  const { data, error } = await q;
  if (error) throw new Error(`crm_interactions: ${error.message}`);
  return (data ?? []).map((r) => interactionFromRow(r as Record<string, unknown>));
}

export async function insertCrmInteraction(i: {
  brandId: string;
  contactId?: string;
  dealId?: string;
  type: InteractionType;
  summary: string;
  actorName: string;
  actorUserId?: string;
  occurredAt?: string;
}): Promise<CrmInteraction> {
  const { data, error } = await getSupabaseAdmin().from("crm_interactions").insert({
    id: `ci-${crypto.randomUUID().slice(0, 12)}`,
    brand_id: i.brandId,
    contact_id: i.contactId ?? null,
    deal_id: i.dealId ?? null,
    type: i.type,
    summary: i.summary,
    actor_name: i.actorName,
    actor_user_id: i.actorUserId ?? null,
    occurred_at: i.occurredAt ?? new Date().toISOString(),
  }).select("*").maybeSingle();
  if (error) throw new Error(`crm_interactions: ${error.message}`);
  return interactionFromRow(data as Record<string, unknown>);
}
