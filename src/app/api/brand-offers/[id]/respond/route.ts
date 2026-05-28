import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  appendBrandOfferMessage,
  createBrandDealFromOffer,
  findBrandOfferById,
  upsertBrandOffer,
} from "@/lib/db/repository";
import {
  assertCanWriteOffer,
  resolveCounterpartTarget,
  writeDealAudit,
} from "@/lib/deal-access";
import {
  insertNotificationSafe,
  newNotifId,
  newOfferMessageId,
} from "@/lib/brand-offer-shared";
import type { AppNotification, BrandOffer, BrandOfferMessage } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RespondAction = "accept" | "reject" | "counter";

interface RespondBody {
  action?: RespondAction;
  counterBudgetUsd?: number;
  message?: string;
}

function authorRoleFor(role: string): BrandOfferMessage["authorRole"] {
  if (role === "brand") return "brand";
  if (role === "streamer") return "streamer";
  return "admin";
}

/**
 * POST /api/brand-offers/[id]/respond — body: { action, counterBudgetUsd?, message? }
 *   - accept   → status=accepted, brand_deals satırı, mesaj, audit + notif
 *   - reject   → status=rejected, mesaj
 *   - counter  → status=negotiating, counter mesajı (counter_budget_usd)
 *
 * Cevaplayan = initiator dışındaki taraf (admin her zaman yetkili).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const offer = await findBrandOfferById(id);
  if (!offer) return NextResponse.json({ error: "Teklif bulunamadı" }, { status: 404 });

  const guard = assertCanWriteOffer(session, offer);
  if (guard) return guard;

  if (offer.status === "accepted") {
    return NextResponse.json({ error: "Teklif zaten kabul edilmiş" }, { status: 409 });
  }
  if (offer.status === "rejected" || offer.status === "withdrawn" || offer.status === "expired") {
    return NextResponse.json(
      { error: `Bu teklif kapatılmış (status=${offer.status})` },
      { status: 409 }
    );
  }

  // Initiator kendi teklifine respond edemez (admin hariç).
  if (session.role !== "admin") {
    if (offer.initiator === session.role) {
      return NextResponse.json(
        { error: "Kendi başlattığınız teklife cevap veremezsiniz" },
        { status: 403 }
      );
    }
  }

  const body = (await req.json().catch(() => null)) as RespondBody | null;
  if (!body || !body.action) {
    return NextResponse.json({ error: "action gerekli" }, { status: 400 });
  }
  if (!["accept", "reject", "counter"].includes(body.action)) {
    return NextResponse.json(
      { error: "action accept|reject|counter olmalı" },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const messageBody = String(body.message ?? "").trim();
  const counterBudget =
    body.counterBudgetUsd === undefined || body.counterBudgetUsd === null
      ? undefined
      : Math.max(0, Number(body.counterBudgetUsd) || 0);

  if (body.action === "counter" && counterBudget === undefined && !messageBody) {
    return NextResponse.json(
      { error: "Karşı teklif için counterBudgetUsd veya mesaj gerekli" },
      { status: 400 }
    );
  }

  try {
    let nextStatus: BrandOffer["status"] = offer.status;
    let createdDealId: string | undefined = offer.createdDealId;

    if (body.action === "accept") nextStatus = "accepted";
    else if (body.action === "reject") nextStatus = "rejected";
    else if (body.action === "counter") nextStatus = "negotiating";

    // 1) Önce mesaj ekle (varsa).
    let savedMessage: BrandOfferMessage | null = null;
    if (messageBody || counterBudget !== undefined) {
      savedMessage = await appendBrandOfferMessage({
        id: newOfferMessageId(),
        offerId: offer.id,
        authorId: session.userId,
        authorRole: authorRoleFor(session.role),
        body:
          messageBody ||
          (body.action === "counter"
            ? `Karşı teklif: ${counterBudget} USD`
            : body.action === "accept"
              ? "Teklif kabul edildi."
              : "Teklif reddedildi."),
        counterBudgetUsd: counterBudget,
        createdAt: nowIso,
      });
    }

    // 2) Accept → brand_deals satırı oluştur.
    if (body.action === "accept") {
      const deal = await createBrandDealFromOffer(offer, {
        budgetUsd: counterBudget ?? offer.budgetUsd ?? 0,
      });
      createdDealId = deal.id;
      await writeDealAudit(
        session,
        "deal_created",
        `deal=${deal.id} offer=${offer.id} brand=${offer.brandId} employee=${offer.employeeId}`
      );
    }

    // 3) Offer satırını güncelle.
    const updatedOffer = await upsertBrandOffer({
      ...offer,
      status: nextStatus,
      respondedBy: session.userId,
      respondedAt: nowIso,
      createdDealId,
      updatedAt: nowIso,
    });

    await writeDealAudit(
      session,
      body.action === "accept"
        ? "offer_accepted"
        : body.action === "reject"
          ? "offer_rejected"
          : "offer_countered",
      `offer=${updatedOffer.id} brand=${updatedOffer.brandId} employee=${updatedOffer.employeeId}`
    );

    // 4) Karşı tarafa bildirim
    const target = await resolveCounterpartTarget({
      initiator: offer.initiator,
      brandId: offer.brandId,
      employeeId: offer.employeeId,
    }).catch(() => null);
    // resolveCounterpartTarget initiator için karşı tarafı dönüyor. respond eden = karşı taraf,
    // bildirim gönderilecek olan = initiator. Bu yüzden initiator'a yönelik kullanıcıyı çözmek için
    // initiator'ı tersleyerek tekrar çağırırız.
    const flippedInitiator: typeof offer.initiator =
      offer.initiator === "brand" ? "streamer" : "brand";
    const notifyInitiator = await resolveCounterpartTarget({
      initiator: flippedInitiator,
      brandId: offer.brandId,
      employeeId: offer.employeeId,
    }).catch(() => null);
    const recipient = notifyInitiator ?? target;
    if (recipient) {
      const subject =
        body.action === "accept"
          ? `Teklif kabul edildi — ${offer.title}`
          : body.action === "reject"
            ? `Teklif reddedildi — ${offer.title}`
            : `Karşı teklif geldi — ${offer.title}`;
      const notif: AppNotification = {
        id: newNotifId(),
        type: "general",
        title: subject,
        message: messageBody || subject,
        forRole:
          recipient.role === "admin"
            ? "admin"
            : (recipient.role as "brand" | "streamer"),
        forUserId: recipient.userId,
        refId: offer.id,
        triggeredBy: session.userId,
        createdAt: nowIso,
        read: false,
        href: "/marka/teklifler",
      };
      await insertNotificationSafe(notif);
    }

    return NextResponse.json({
      offer: updatedOffer,
      message: savedMessage,
      createdDealId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cevap kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
