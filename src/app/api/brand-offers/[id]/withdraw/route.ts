import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { findBrandOfferById, upsertBrandOffer } from "@/lib/db/repository";
import {
  assertCanWriteOffer,
  resolveCounterpartTarget,
  writeDealAudit,
} from "@/lib/deal-access";
import { insertNotificationSafe, newNotifId } from "@/lib/brand-offer-shared";
import type { AppNotification } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/brand-offers/[id]/withdraw
 * Sadece initiator (veya admin) iptal edebilir. Status → 'withdrawn'.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  if (
    offer.status === "accepted" ||
    offer.status === "rejected" ||
    offer.status === "withdrawn" ||
    offer.status === "expired"
  ) {
    return NextResponse.json(
      { error: `Bu teklif kapatılmış (status=${offer.status})` },
      { status: 409 }
    );
  }

  if (session.role !== "admin" && session.role !== offer.initiator) {
    return NextResponse.json(
      { error: "Sadece teklifi başlatan taraf iptal edebilir" },
      { status: 403 }
    );
  }

  try {
    const nowIso = new Date().toISOString();
    const updated = await upsertBrandOffer({
      ...offer,
      status: "withdrawn",
      respondedBy: session.userId,
      respondedAt: nowIso,
      updatedAt: nowIso,
    });
    await writeDealAudit(
      session,
      "offer_withdrawn",
      `offer=${updated.id} brand=${updated.brandId} employee=${updated.employeeId}`
    );

    const flippedInitiator: typeof offer.initiator =
      offer.initiator === "brand" ? "streamer" : "brand";
    const target = await resolveCounterpartTarget({
      initiator: flippedInitiator,
      brandId: offer.brandId,
      employeeId: offer.employeeId,
    }).catch(() => null);
    if (target) {
      const notif: AppNotification = {
        id: newNotifId(),
        type: "general",
        title: `Teklif iptal edildi — ${offer.title}`,
        message: "Karşı taraf teklifi iptal etti.",
        forRole:
          target.role === "admin"
            ? "admin"
            : (target.role as "brand" | "streamer"),
        forUserId: target.userId,
        refId: offer.id,
        triggeredBy: session.userId,
        createdAt: nowIso,
        read: false,
        href: "/marka/teklifler",
      };
      await insertNotificationSafe(notif);
    }

    return NextResponse.json({ offer: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "İptal başarısız";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
