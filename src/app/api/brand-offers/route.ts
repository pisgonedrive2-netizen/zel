import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { fetchBrandOffers, upsertBrandOffer } from "@/lib/db/repository";
import {
  assertCanWriteOffer,
  resolveCounterpartTarget,
  writeDealAudit,
} from "@/lib/deal-access";
import {
  ALLOWED_OFFER_INITIATOR,
  ALLOWED_OFFER_STATUS,
  ALLOWED_OFFER_TYPES,
  insertNotificationSafe,
  newNotifId,
  newOfferId,
  normalizeIsoDate,
  parseDeliverables,
  pickEnum,
} from "@/lib/brand-offer-shared";
import type { AppNotification, BrandOffer } from "@/store/store";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/brand-offers?role=brand|streamer|admin&status=&brandId=&employeeId=
 *
 * `role` filtresi rolün kendi tarafından gönderdiği teklifleri vs. ayırır:
 * - role=brand    → brand_id = session.brandId (veya admin için ?brandId)
 * - role=streamer → employee_id = session.employeeId (veya admin için ?employeeId)
 * - role=admin    → tümü (admin için)
 *
 * `role` verilmezse rolün kendi scope'una göre default davranır.
 */
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
    statusParam && (ALLOWED_OFFER_STATUS as readonly string[]).includes(statusParam)
      ? (statusParam as BrandOffer["status"])
      : undefined;

  const queryBrandId = url.searchParams.get("brandId")?.trim() || undefined;
  const queryEmployeeId = url.searchParams.get("employeeId")?.trim() || undefined;
  const roleParam = url.searchParams.get("role")?.trim();

  try {
    if (session.role === "admin" || session.role === "auditor") {
      const offers = await fetchBrandOffers({
        brandId: queryBrandId,
        employeeId: queryEmployeeId,
        status,
      });
      return NextResponse.json({ offers });
    }
    if (session.role === "brand") {
      const brandId = resolveBrandId(session, queryBrandId);
      if (!brandId) {
        return NextResponse.json({ error: "Marka oturumu eksik" }, { status: 403 });
      }
      const guard = ensureBrandAccess(session, brandId, "read");
      if (guard) return guard;
      const offers = await fetchBrandOffers({
        brandId,
        status,
        ...(roleParam === "streamer" || queryEmployeeId
          ? { employeeId: queryEmployeeId }
          : {}),
      });
      return NextResponse.json({ offers });
    }
    if (session.role === "streamer") {
      if (!session.employeeId) {
        return NextResponse.json({ error: "Yayıncı oturumu eksik" }, { status: 403 });
      }
      const offers = await fetchBrandOffers({
        employeeId: session.employeeId,
        status,
        ...(queryBrandId ? { brandId: queryBrandId } : {}),
      });
      return NextResponse.json({ offers });
    }
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Teklif listesi yüklenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

interface PostBody {
  id?: string;
  brandId?: string;
  employeeId?: string;
  initiator?: BrandOffer["initiator"];
  title?: string;
  description?: string;
  offerType?: BrandOffer["offerType"];
  budgetUsd?: number;
  deliverables?: unknown;
  startDate?: string;
  endDate?: string;
  notes?: string;
  expiresAt?: string;
}

/** POST /api/brand-offers — yeni teklif başlat. */
export async function POST(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (session.role === "auditor") {
    return NextResponse.json({ error: "Auditor teklif başlatamaz" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body) {
    return NextResponse.json({ error: "JSON gövdesi gerekli" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title gerekli" }, { status: 400 });
  }

  // initiator + brandId + employeeId mantığı role'a göre zorlanır.
  let initiator: BrandOffer["initiator"];
  let brandId: string;
  let employeeId: string;

  if (session.role === "admin") {
    initiator = pickEnum(body.initiator, ALLOWED_OFFER_INITIATOR, "brand");
    brandId = String(body.brandId ?? "").trim();
    employeeId = String(body.employeeId ?? "").trim();
  } else if (session.role === "brand") {
    initiator = "brand";
    const resolved = resolveBrandId(session, body.brandId);
    if (!resolved) {
      return NextResponse.json({ error: "Marka oturumu eksik" }, { status: 403 });
    }
    brandId = resolved;
    employeeId = String(body.employeeId ?? "").trim();
  } else {
    // streamer
    initiator = "streamer";
    if (!session.employeeId) {
      return NextResponse.json({ error: "Yayıncı oturumu eksik" }, { status: 403 });
    }
    employeeId = session.employeeId;
    brandId = String(body.brandId ?? "").trim();
  }

  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId gerekli" }, { status: 400 });
  }

  const guard = assertCanWriteOffer(session, { brandId, employeeId });
  if (guard) return guard;

  const nowIso = new Date().toISOString();
  const id =
    typeof body.id === "string" && /^bo-[a-z0-9-]+$/i.test(body.id) ? body.id : newOfferId();
  const offer: BrandOffer = {
    id,
    brandId,
    employeeId,
    initiator,
    title,
    description: String(body.description ?? ""),
    offerType: pickEnum(body.offerType, ALLOWED_OFFER_TYPES, "campaign"),
    budgetUsd:
      body.budgetUsd === undefined || body.budgetUsd === null
        ? undefined
        : Math.max(0, Number(body.budgetUsd) || 0),
    status: "pending",
    deliverables: parseDeliverables(body.deliverables),
    startDate: normalizeIsoDate(body.startDate),
    endDate: normalizeIsoDate(body.endDate),
    notes: String(body.notes ?? ""),
    expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined,
    createdBy: session.userId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    const saved = await upsertBrandOffer(offer);
    await writeDealAudit(
      session,
      "offer_created",
      `offer=${saved.id} brand=${saved.brandId} employee=${saved.employeeId} initiator=${saved.initiator}`
    );

    const target = await resolveCounterpartTarget(saved).catch(() => null);
    if (target) {
      const notif: AppNotification = {
        id: newNotifId(),
        type: "general",
        title: `Yeni teklif — ${saved.title}`,
        message:
          saved.initiator === "brand"
            ? "Bir markadan yeni iş birliği teklifi geldi."
            : "Bir yayıncıdan yeni iş birliği teklifi geldi.",
        forRole: target.role === "admin" ? "admin" : (target.role as "brand" | "streamer"),
        forUserId: target.userId,
        refId: saved.id,
        triggeredBy: session.userId,
        createdAt: nowIso,
        read: false,
        href: "/marka/teklifler",
      };
      await insertNotificationSafe(notif);
    }

    return NextResponse.json({ offer: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Teklif kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
