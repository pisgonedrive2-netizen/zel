import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { findBrandDealById, upsertBrandDeal } from "@/lib/db/repository";
import {
  assertCanReadDeal,
  assertCanWriteDeal,
  writeDealAudit,
} from "@/lib/deal-access";
import { normalizeIsoDate, pickEnum } from "@/lib/brand-offer-shared";
import type { BrandDeal } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEAL_STATUS: BrandDeal["status"][] = [
  "active",
  "completed",
  "cancelled",
  "disputed",
];

/** GET /api/brand-deals/[id] */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const deal = await findBrandDealById(id);
  if (!deal) return NextResponse.json({ error: "Anlaşma bulunamadı" }, { status: 404 });

  const guard = assertCanReadDeal(session, deal);
  if (guard) return guard;
  return NextResponse.json({ deal });
}

interface PatchBody {
  status?: BrandDeal["status"];
  paidUsd?: number;
  budgetUsd?: number;
  notes?: string;
  startDate?: string;
  endDate?: string;
  contractUrl?: string;
  title?: string;
}

/** PATCH /api/brand-deals/[id] — status, paidUsd, notes vb. güncelle. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const existing = await findBrandDealById(id);
  if (!existing) {
    return NextResponse.json({ error: "Anlaşma bulunamadı" }, { status: 404 });
  }
  const guard = assertCanWriteDeal(session, existing);
  if (guard) return guard;

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) {
    return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const next: BrandDeal = {
    ...existing,
    ...(body.title !== undefined
      ? { title: String(body.title).trim() || existing.title }
      : {}),
    ...(body.status !== undefined
      ? { status: pickEnum(body.status, ALLOWED_DEAL_STATUS, existing.status) }
      : {}),
    ...(body.budgetUsd !== undefined
      ? { budgetUsd: Math.max(0, Number(body.budgetUsd) || 0) }
      : {}),
    ...(body.paidUsd !== undefined
      ? { paidUsd: Math.max(0, Number(body.paidUsd) || 0) }
      : {}),
    ...(body.notes !== undefined ? { notes: String(body.notes ?? "") } : {}),
    ...(body.startDate !== undefined
      ? { startDate: normalizeIsoDate(body.startDate) }
      : {}),
    ...(body.endDate !== undefined ? { endDate: normalizeIsoDate(body.endDate) } : {}),
    ...(body.contractUrl !== undefined
      ? { contractUrl: body.contractUrl?.trim() || undefined }
      : {}),
    updatedAt: nowIso,
  };

  try {
    const saved = await upsertBrandDeal(next);
    if (next.status !== existing.status) {
      const action = next.status === "completed" ? "deal_completed" : "deal_status_changed";
      await writeDealAudit(
        session,
        action,
        `deal=${saved.id} ${existing.status} → ${saved.status}`
      );
    }
    return NextResponse.json({ deal: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlaşma güncellenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
