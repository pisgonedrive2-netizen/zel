import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { fetchBrandDeals, upsertBrandDeal } from "@/lib/db/repository";
import { assertCanWriteDeal, writeDealAudit } from "@/lib/deal-access";
import {
  newDealId,
  normalizeIsoDate,
  pickEnum,
} from "@/lib/brand-offer-shared";
import type { BrandDeal, BrandDealDeliverable } from "@/store/store";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEAL_TYPES: BrandDeal["dealType"][] = [
  "campaign",
  "single_post",
  "long_term",
  "affiliate",
];
const ALLOWED_DEAL_STATUS: BrandDeal["status"][] = [
  "active",
  "completed",
  "cancelled",
  "disputed",
];

function parseDealDeliverables(v: unknown): BrandDealDeliverable[] {
  if (!Array.isArray(v)) return [];
  const out: BrandDealDeliverable[] = [];
  for (const raw of v as unknown[]) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const type = String(r.type ?? "").trim();
    const count = Math.max(0, Math.floor(Number(r.count) || 0));
    if (!type) continue;
    out.push({
      type,
      count,
      platform: r.platform ? String(r.platform) : undefined,
    });
  }
  return out;
}

/** GET /api/brand-deals?brandId=&employeeId=&status= */
export async function GET(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status")?.trim();
  const status =
    statusParam && (ALLOWED_DEAL_STATUS as readonly string[]).includes(statusParam)
      ? (statusParam as BrandDeal["status"])
      : undefined;
  const queryBrandId = url.searchParams.get("brandId")?.trim() || undefined;
  const queryEmployeeId = url.searchParams.get("employeeId")?.trim() || undefined;

  try {
    if (session.role === "admin" || session.role === "auditor") {
      const deals = await fetchBrandDeals({
        brandId: queryBrandId,
        employeeId: queryEmployeeId,
        status,
      });
      return NextResponse.json({ deals });
    }
    if (session.role === "brand") {
      const brandId = resolveBrandId(session, queryBrandId);
      if (!brandId) {
        return NextResponse.json({ error: "Marka oturumu eksik" }, { status: 403 });
      }
      const guard = ensureBrandAccess(session, brandId, "read");
      if (guard) return guard;
      const deals = await fetchBrandDeals({
        brandId,
        employeeId: queryEmployeeId,
        status,
      });
      return NextResponse.json({ deals });
    }
    if (session.role === "streamer") {
      if (!session.employeeId) {
        return NextResponse.json({ error: "Yayıncı oturumu eksik" }, { status: 403 });
      }
      const deals = await fetchBrandDeals({
        employeeId: session.employeeId,
        brandId: queryBrandId,
        status,
      });
      return NextResponse.json({ deals });
    }
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlaşma listesi yüklenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

interface PostBody {
  id?: string;
  brandId?: string;
  employeeId?: string;
  originOfferId?: string;
  title?: string;
  dealType?: BrandDeal["dealType"];
  status?: BrandDeal["status"];
  budgetUsd?: number;
  paidUsd?: number;
  startDate?: string;
  endDate?: string;
  deliverables?: unknown;
  notes?: string;
  contractUrl?: string;
}

/** POST /api/brand-deals — manuel anlaşma (offer yokken). Admin veya marka. */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (session.role === "auditor" || session.role === "streamer") {
    return NextResponse.json({ error: "Manuel anlaşma oluşturamazsınız" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body) {
    return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });
  }

  const brandId =
    session.role === "brand"
      ? resolveBrandId(session, body.brandId) ?? ""
      : String(body.brandId ?? "").trim();
  const employeeId = String(body.employeeId ?? "").trim();
  const title = String(body.title ?? "").trim();

  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId gerekli" }, { status: 400 });
  }
  if (!title) return NextResponse.json({ error: "title gerekli" }, { status: 400 });

  const guard = assertCanWriteDeal(session, { brandId, employeeId });
  if (guard) return guard;

  const nowIso = new Date().toISOString();
  const id =
    typeof body.id === "string" && /^bd-[a-z0-9-]+$/i.test(body.id) ? body.id : newDealId();
  const deal: BrandDeal = {
    id,
    brandId,
    employeeId,
    originOfferId: body.originOfferId?.trim() || undefined,
    title,
    dealType: pickEnum(body.dealType, ALLOWED_DEAL_TYPES, "campaign"),
    status: pickEnum(body.status, ALLOWED_DEAL_STATUS, "active"),
    budgetUsd: Math.max(0, Number(body.budgetUsd) || 0),
    paidUsd: Math.max(0, Number(body.paidUsd) || 0),
    startDate: normalizeIsoDate(body.startDate),
    endDate: normalizeIsoDate(body.endDate),
    deliverables: parseDealDeliverables(body.deliverables),
    postsCount: 0,
    totalViews: 0,
    notes: String(body.notes ?? ""),
    contractUrl: body.contractUrl?.trim() || undefined,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    const saved = await upsertBrandDeal(deal);
    await writeDealAudit(
      session,
      "deal_created",
      `deal=${saved.id} brand=${saved.brandId} employee=${saved.employeeId} manual=true`
    );
    return NextResponse.json({ deal: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlaşma kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
