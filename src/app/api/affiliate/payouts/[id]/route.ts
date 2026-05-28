import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  findAffiliatePayoutById,
  upsertAffiliatePayout,
} from "@/lib/db/repository";
import {
  canWriteAffiliate,
  ensureBrandScope,
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

/** PATCH /api/affiliate/payouts/[id] — status / paidDate / amount / notes güncelleme. */
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
  const existing = await findAffiliatePayoutById(id);
  if (!existing) {
    return NextResponse.json({ error: "Ödeme bulunamadı" }, { status: 404 });
  }
  const guard = ensureBrandScope(session, existing.brandId, "write");
  if (guard) return guard;

  const body = (await req.json().catch(() => null)) as Partial<AffiliatePayout> | null;
  if (!body) {
    return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });
  }

  const nextStatus = body.status !== undefined
    ? pickEnum(body.status, ALLOWED_STATUS, existing.status)
    : existing.status;
  const nextPaidDate =
    body.paidDate !== undefined
      ? body.paidDate
        ? String(body.paidDate).slice(0, 10)
        : undefined
      : existing.paidDate;
  if (nextPaidDate && !ISO_DATE_RE.test(nextPaidDate)) {
    return NextResponse.json({ error: "paidDate YYYY-MM-DD olmalı" }, { status: 400 });
  }
  if (nextStatus === "paid" && !nextPaidDate) {
    return NextResponse.json(
      { error: "status=paid ise paidDate zorunlu" },
      { status: 400 }
    );
  }

  const nextPeriodStart = body.periodStart
    ? String(body.periodStart).slice(0, 10)
    : existing.periodStart;
  const nextPeriodEnd = body.periodEnd
    ? String(body.periodEnd).slice(0, 10)
    : existing.periodEnd;
  if (
    !ISO_DATE_RE.test(nextPeriodStart) ||
    !ISO_DATE_RE.test(nextPeriodEnd) ||
    nextPeriodStart > nextPeriodEnd
  ) {
    return NextResponse.json({ error: "Geçersiz periodStart/periodEnd" }, { status: 400 });
  }

  const updated: AffiliatePayout = {
    ...existing,
    periodStart: nextPeriodStart,
    periodEnd: nextPeriodEnd,
    amount: body.amount !== undefined ? Math.max(0, Number(body.amount) || 0) : existing.amount,
    currency:
      body.currency !== undefined
        ? pickEnum(body.currency, ALLOWED_CURRENCIES, existing.currency)
        : existing.currency,
    status: nextStatus,
    paidDate: nextPaidDate,
    notes: body.notes !== undefined ? String(body.notes ?? "") : existing.notes,
    updatedAt: new Date().toISOString(),
  };

  try {
    const saved = await upsertAffiliatePayout(updated);
    if (existing.status !== "paid" && saved.status === "paid") {
      await writeAffiliateAudit(
        session,
        "affiliate_payout_paid",
        `payout=${saved.id} partner=${saved.partnerId} amount=${saved.amount} ${saved.currency}`
      );
    }
    return NextResponse.json({ payout: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Güncellenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
