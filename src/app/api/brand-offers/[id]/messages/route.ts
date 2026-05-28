import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  appendBrandOfferMessage,
  findBrandOfferById,
} from "@/lib/db/repository";
import { assertCanWriteOffer } from "@/lib/deal-access";
import { newOfferMessageId } from "@/lib/brand-offer-shared";
import type { BrandOfferMessage } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  body?: string;
  counterBudgetUsd?: number;
}

function authorRoleFor(role: string): BrandOfferMessage["authorRole"] {
  if (role === "brand") return "brand";
  if (role === "streamer") return "streamer";
  return "admin";
}

/** POST /api/brand-offers/[id]/messages — sohbet mesajı ekle. */
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

  const body = (await req.json().catch(() => null)) as PostBody | null;
  if (!body || !body.body || !String(body.body).trim()) {
    return NextResponse.json({ error: "body gerekli" }, { status: 400 });
  }

  const counter =
    body.counterBudgetUsd === undefined || body.counterBudgetUsd === null
      ? undefined
      : Math.max(0, Number(body.counterBudgetUsd) || 0);

  try {
    const message = await appendBrandOfferMessage({
      id: newOfferMessageId(),
      offerId: offer.id,
      authorId: session.userId,
      authorRole: authorRoleFor(session.role),
      body: String(body.body).trim(),
      counterBudgetUsd: counter,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ message });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Mesaj kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
