import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  deleteAffiliatePartner,
  findAffiliatePartnerById,
  upsertAffiliatePartner,
} from "@/lib/db/repository";
import {
  canWriteAffiliate,
  ensureBrandScope,
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

/** PATCH /api/affiliate/partners/[id] — alan güncelleme. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  }
  const existing = await findAffiliatePartnerById(id);
  if (!existing) {
    return NextResponse.json({ error: "Partner bulunamadı" }, { status: 404 });
  }
  const scopeGuard = ensureBrandScope(session, existing.brandId, "write");
  if (scopeGuard) return scopeGuard;

  const body = (await req.json().catch(() => null)) as Partial<AffiliatePartner> | null;
  if (!body) {
    return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });
  }
  // Brand role kendi brandId'sinin dışına çıkamaz.
  if (body.brandId && body.brandId !== existing.brandId) {
    const guard = ensureBrandScope(session, body.brandId, "write");
    if (guard) return guard;
  }

  const updated: AffiliatePartner = {
    ...existing,
    ...(body.name !== undefined ? { name: String(body.name).trim() || existing.name } : {}),
    ...(body.externalRef !== undefined
      ? { externalRef: body.externalRef?.trim() || undefined }
      : {}),
    ...(body.partnerType !== undefined
      ? { partnerType: pickEnum(body.partnerType, ALLOWED_PARTNER_TYPES, existing.partnerType) }
      : {}),
    ...(body.commissionModel !== undefined
      ? {
          commissionModel: pickEnum(
            body.commissionModel,
            ALLOWED_COMMISSION_MODELS,
            existing.commissionModel
          ),
        }
      : {}),
    ...(body.cpaAmount !== undefined
      ? { cpaAmount: Math.max(0, Number(body.cpaAmount) || 0) }
      : {}),
    ...(body.revsharePct !== undefined
      ? { revsharePct: Math.min(100, Math.max(0, Number(body.revsharePct) || 0)) }
      : {}),
    ...(body.currency !== undefined
      ? { currency: pickEnum(body.currency, ALLOWED_CURRENCIES, existing.currency) }
      : {}),
    ...(body.status !== undefined
      ? { status: pickEnum(body.status, ALLOWED_STATUS, existing.status) }
      : {}),
    ...(body.employeeId !== undefined
      ? { employeeId: body.employeeId?.trim() || undefined }
      : {}),
    ...(body.contact !== undefined ? { contact: body.contact?.trim() || undefined } : {}),
    ...(body.notes !== undefined ? { notes: String(body.notes ?? "") } : {}),
    updatedAt: new Date().toISOString(),
  };

  try {
    const saved = await upsertAffiliatePartner(updated);
    return NextResponse.json({ partner: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Güncellenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/affiliate/partners/[id] */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  }
  const existing = await findAffiliatePartnerById(id);
  if (!existing) {
    return NextResponse.json({ error: "Partner bulunamadı" }, { status: 404 });
  }
  const guard = ensureBrandScope(session, existing.brandId, "write");
  if (guard) return guard;
  try {
    await deleteAffiliatePartner(id);
    await writeAffiliateAudit(
      session,
      "affiliate_partner_deleted",
      `partner=${existing.id} brand=${existing.brandId}`
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Silinemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
