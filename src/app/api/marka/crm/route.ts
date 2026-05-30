import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  ensureBrandAccess, resolveBrandId, accessibleBrandIds, hasOrgCapability, writeAudit,
} from "@/lib/org-access";
import {
  fetchCrmContacts, fetchCrmDeals, upsertCrmContact, upsertCrmDeal,
  deleteCrmContact, deleteCrmDeal, insertCrmInteraction,
} from "@/lib/db/crm-repo";
import type {
  ContactStatus, CrmContact, CrmCurrency, CrmDeal, DealStage, InteractionType,
} from "@/types/crm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTACT_STATUS: readonly ContactStatus[] = ["lead", "active", "vip", "passive", "lost"];
const DEAL_STAGE: readonly DealStage[] = ["lead", "qualified", "proposal", "won", "lost"];
const CURRENCY: readonly CrmCurrency[] = ["USD", "EUR", "TRY"];
const INTERACTION: readonly InteractionType[] = ["note", "call", "email", "meeting", "whatsapp", "telegram"];
function pick<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  const s = String(v ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : fb;
}

function scopeIds(session: Awaited<ReturnType<typeof getSession>>, requested?: string): string[] {
  if (!session) return [];
  if (session.role === "brand") return requested ? [requested] : accessibleBrandIds(session);
  return requested ? [requested] : [];
}

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ contacts: [], deals: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const requested = new URL(req.url).searchParams.get("brandId")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;
  const ids = scopeIds(session, requested);
  try {
    const [contacts, deals] = await Promise.all([fetchCrmContacts(ids), fetchCrmDeals(ids)]);
    return NextResponse.json({ contacts, deals });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "CRM verisi alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "crm")) {
    return NextResponse.json({ error: "CRM yetkisi yok" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as (Record<string, unknown> & { kind?: string }) | null;
  if (!body) return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });

  const requestedBrandId = String(body.brandId ?? "").trim() || null;
  const guard = ensureBrandAccess(session, requestedBrandId, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId) ?? requestedBrandId ?? "";
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const now = new Date().toISOString();

  try {
    if (body.kind === "deal") {
      const title = String(body.title ?? "").trim();
      if (!title) return NextResponse.json({ error: "title gerekli" }, { status: 400 });
      const isNew = !(typeof body.id === "string" && /^cd-/.test(body.id as string));
      const deal: CrmDeal = {
        id: isNew ? `cd-${crypto.randomUUID().slice(0, 10)}` : (body.id as string),
        brandId,
        contactId: String(body.contactId ?? "").trim() || undefined,
        title,
        stage: pick(body.stage, DEAL_STAGE, "lead"),
        value: Math.max(0, Number(body.value) || 0),
        currency: pick(body.currency, CURRENCY, "USD"),
        probability: Math.min(100, Math.max(0, Number(body.probability) || 0)),
        expectedClose: String(body.expectedClose ?? "").trim() || undefined,
        affiliatePartnerId: String(body.affiliatePartnerId ?? "").trim() || undefined,
        brandDealId: String(body.brandDealId ?? "").trim() || undefined,
        notes: String(body.notes ?? ""),
        createdAt: (body.createdAt as string) ?? now,
        updatedAt: now,
      };
      const saved = await upsertCrmDeal(deal);
      await writeAudit(session, isNew ? "crm_deal_created" : "crm_deal_updated", `deal=${saved.id} brand=${brandId} stage=${saved.stage}`);
      return NextResponse.json({ deal: saved });
    }

    if (body.kind === "interaction") {
      const saved = await insertCrmInteraction({
        brandId,
        contactId: String(body.contactId ?? "").trim() || undefined,
        dealId: String(body.dealId ?? "").trim() || undefined,
        type: pick(body.type, INTERACTION, "note"),
        summary: String(body.summary ?? ""),
        actorName: session.name,
        actorUserId: session.userId,
        occurredAt: String(body.occurredAt ?? "").trim() || undefined,
      });
      await writeAudit(session, "crm_interaction_created", `interaction=${saved.id} brand=${brandId} type=${saved.type}${saved.contactId ? ` contact=${saved.contactId}` : ""}${saved.dealId ? ` deal=${saved.dealId}` : ""}`);
      return NextResponse.json({ interaction: saved });
    }

    // default: contact
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "name gerekli" }, { status: 400 });
    const isNew = !(typeof body.id === "string" && /^cc-/.test(body.id as string));
    const tags = Array.isArray(body.tags) ? (body.tags as unknown[]).map((t) => String(t)) : [];
    const contact: CrmContact = {
      id: isNew ? `cc-${crypto.randomUUID().slice(0, 10)}` : (body.id as string),
      brandId,
      name,
      company: String(body.company ?? ""),
      email: String(body.email ?? "").trim() || undefined,
      phone: String(body.phone ?? "").trim() || undefined,
      telegram: String(body.telegram ?? "").trim() || undefined,
      source: String(body.source ?? "manual"),
      status: pick(body.status, CONTACT_STATUS, "lead"),
      owner: String(body.owner ?? ""),
      tags,
      notes: String(body.notes ?? ""),
      createdAt: (body.createdAt as string) ?? now,
      updatedAt: now,
    };
    const saved = await upsertCrmContact(contact);
    await writeAudit(session, isNew ? "crm_contact_created" : "crm_contact_updated", `contact=${saved.id} brand=${brandId}`);
    return NextResponse.json({ contact: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  if (!hasOrgCapability(session, "crm")) {
    return NextResponse.json({ error: "CRM silme yetkisi yok" }, { status: 403 });
  }
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "contact";
  const id = url.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  try {
    if (kind === "deal") await deleteCrmDeal(id);
    else await deleteCrmContact(id);
    await writeAudit(session, kind === "deal" ? "crm_deal_deleted" : "crm_contact_deleted", `id=${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Silme başarısız";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
