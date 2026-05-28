import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  fetchAffiliatePayouts,
  findAffiliatePartnerById,
  upsertAffiliatePayout,
} from "@/lib/db/repository";
import {
  canReadAffiliate,
  canWriteAffiliate,
  ensureBrandScope,
  resolveBrandId,
  writeAffiliateAudit,
} from "@/lib/affiliate-access";
import type { AffiliatePayout } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUS = ["pending", "approved", "paid", "cancelled"] as const;
const ALLOWED_CURRENCIES = ["USD", "EUR", "TRY"] as const;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pickEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  const s = String(value ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T[number]) : fallback;
}

function newPayoutId(): string {
  return `apo-${crypto.randomUUID().slice(0, 10)}`;
}

/** GET /api/affiliate/payouts?brandId=... */
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
    const payouts = await fetchAffiliatePayouts(brandId);
    return NextResponse.json({ payouts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Liste yüklenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST /api/affiliate/payouts — yeni ödeme satırı. */
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

  const body = (await req.json().catch(() => null)) as Partial<AffiliatePayout> | null;
  if (!body) {
    return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });
  }
  const partnerId = String(body.partnerId ?? "").trim();
  if (!partnerId) {
    return NextResponse.json({ error: "partnerId gerekli" }, { status: 400 });
  }
  const partner = await findAffiliatePartnerById(partnerId);
  if (!partner) {
    return NextResponse.json({ error: "Partner bulunamadı" }, { status: 404 });
  }
  const guard = ensureBrandScope(session, partner.brandId, "write");
  if (guard) return guard;

  const periodStart = String(body.periodStart ?? "").slice(0, 10);
  const periodEnd = String(body.periodEnd ?? "").slice(0, 10);
  if (!ISO_DATE_RE.test(periodStart) || !ISO_DATE_RE.test(periodEnd)) {
    return NextResponse.json(
      { error: "periodStart / periodEnd YYYY-MM-DD olmalı" },
      { status: 400 }
    );
  }
  if (periodStart > periodEnd) {
    return NextResponse.json(
      { error: "periodStart, periodEnd'ten büyük olamaz" },
      { status: 400 }
    );
  }
  const amount = Math.max(0, Number(body.amount) || 0);
  const status = pickEnum(body.status, ALLOWED_STATUS, "pending");
  const paidDate = body.paidDate ? String(body.paidDate).slice(0, 10) : undefined;
  if (paidDate && !ISO_DATE_RE.test(paidDate)) {
    return NextResponse.json({ error: "paidDate YYYY-MM-DD olmalı" }, { status: 400 });
  }
  if (status === "paid" && !paidDate) {
    return NextResponse.json(
      { error: "status=paid ise paidDate zorunlu" },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const id =
    typeof body.id === "string" && /^apo-[a-z0-9-]+$/i.test(body.id) ? body.id : newPayoutId();
  const payout: AffiliatePayout = {
    id,
    partnerId: partner.id,
    brandId: partner.brandId,
    periodStart,
    periodEnd,
    amount,
    currency: pickEnum(body.currency, ALLOWED_CURRENCIES, partner.currency),
    status,
    paidDate,
    notes: body.notes ?? "",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    const saved = await upsertAffiliatePayout(payout);
    if (status === "paid") {
      await writeAffiliateAudit(
        session,
        "affiliate_payout_paid",
        `payout=${saved.id} partner=${saved.partnerId} amount=${saved.amount} ${saved.currency}`
      );
    }
    return NextResponse.json({ payout: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ödeme kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
