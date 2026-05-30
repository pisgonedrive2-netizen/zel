import type { CrmContact, CrmDeal, CrmInteraction } from "@/types/crm";

async function jsonOrThrow<T>(res: Response, fallback: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `${fallback} (${res.status})`);
  return data;
}

export async function fetchCrm(
  brandId?: string
): Promise<{ contacts: CrmContact[]; deals: CrmDeal[] }> {
  const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";
  const res = await fetch(`/api/marka/crm${qs}`, { credentials: "include", cache: "no-store" });
  return jsonOrThrow<{ contacts: CrmContact[]; deals: CrmDeal[] }>(res, "CRM verisi alınamadı");
}

export async function saveContact(input: Partial<CrmContact>): Promise<CrmContact> {
  const res = await fetch("/api/marka/crm", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, kind: "contact" }),
  });
  const data = await jsonOrThrow<{ contact: CrmContact }>(res, "Kontak kaydedilemedi");
  return data.contact;
}

export async function saveDeal(input: Partial<CrmDeal>): Promise<CrmDeal> {
  const res = await fetch("/api/marka/crm", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, kind: "deal" }),
  });
  const data = await jsonOrThrow<{ deal: CrmDeal }>(res, "Anlaşma kaydedilemedi");
  return data.deal;
}

export async function addInteraction(input: Partial<CrmInteraction>): Promise<CrmInteraction> {
  const res = await fetch("/api/marka/crm", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, kind: "interaction" }),
  });
  const data = await jsonOrThrow<{ interaction: CrmInteraction }>(res, "Etkileşim eklenemedi");
  return data.interaction;
}

export async function deleteCrm(kind: "contact" | "deal", id: string): Promise<void> {
  const res = await fetch(`/api/marka/crm?kind=${kind}&id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await jsonOrThrow<{ ok: boolean }>(res, "Silme başarısız");
}

export interface ContactDetail {
  contact: CrmContact;
  deals: CrmDeal[];
  interactions: CrmInteraction[];
}

export async function fetchContactDetail(id: string): Promise<ContactDetail> {
  const res = await fetch(`/api/marka/crm/${id}`, { credentials: "include", cache: "no-store" });
  return jsonOrThrow<ContactDetail>(res, "Kontak detayı alınamadı");
}
