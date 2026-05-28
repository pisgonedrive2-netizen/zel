import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  fetchAffiliatePartners,
  upsertAffiliatePartner,
} from "@/lib/db/repository";
import {
  canReadAffiliate,
  canWriteAffiliate,
  ensureBrandScope,
  resolveBrandId,
  writeAffiliateAudit,
} from "@/lib/affiliate-access";
import type { AffiliatePartner } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PARTNER_TYPES = ["streamer", "external", "agency", "social"] as const;
const ALLOWED_COMMISSION_MODELS = ["cpa", "revshare", "hybrid", "flat"] as const;
const ALLOWED_CURRENCIES = ["USD", "EUR", "TRY"] as const;
const ALLOWED_STATUS = ["active", "paused", "closed"] as const;

function pickEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  const s = String(value ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T[number]) : fallback;
}

function newPartnerId(): string {
  return `ap-${crypto.randomUUID().slice(0, 8)}`;
}

/** GET /api/affiliate/partners?brandId=... */
export async function GET(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (!canReadAffiliate(session)) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }
  const requestedBrandId = new URL(req.url).searchParams.get("brandId")?.trim() || undefined;
  const guard = ensureBrandScope(session, requestedBrandId ?? null, "read");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId);
  try {
    const partners = await fetchAffiliatePartners(brandId);
    return NextResponse.json({ partners });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Liste yüklenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST /api/affiliate/partners — yeni partner. */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (!canWriteAffiliate(session)) {
    return NextResponse.json({ error: "Yazma yetkisi yok" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Partial<AffiliatePartner> | null;
  if (!body) {
    return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  const requestedBrandId = String(body.brandId ?? "").trim() || null;
  const guard = ensureBrandScope(session, requestedBrandId, "write");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requestedBrandId) ?? requestedBrandId ?? "";
  if (!brandId) {
    return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name gerekli" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const id =
    typeof body.id === "string" && /^ap-[a-z0-9-]+$/i.test(body.id) ? body.id : newPartnerId();
  const partner: AffiliatePartner = {
    id,
    brandId,
    name,
    externalRef: body.externalRef?.trim() || undefined,
    partnerType: pickEnum(body.partnerType, ALLOWED_PARTNER_TYPES, "streamer"),
    commissionModel: pickEnum(body.commissionModel, ALLOWED_COMMISSION_MODELS, "cpa"),
    cpaAmount: Math.max(0, Number(body.cpaAmount) || 0),
    revsharePct: Math.min(100, Math.max(0, Number(body.revsharePct) || 0)),
    currency: pickEnum(body.currency, ALLOWED_CURRENCIES, "USD"),
    status: pickEnum(body.status, ALLOWED_STATUS, "active"),
    employeeId: body.employeeId?.trim() || undefined,
    contact: body.contact?.trim() || undefined,
    notes: body.notes ?? "",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    const saved = await upsertAffiliatePartner(partner);
    await writeAffiliateAudit(
      session,
      "affiliate_partner_created",
      `partner=${saved.id} brand=${saved.brandId} name=${saved.name}`
    );
    return NextResponse.json({ partner: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Partner kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
