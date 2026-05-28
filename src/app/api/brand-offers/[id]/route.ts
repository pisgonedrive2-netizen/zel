import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  fetchBrandOfferMessages,
  findBrandOfferById,
} from "@/lib/db/repository";
import { assertCanReadOffer } from "@/lib/deal-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/brand-offers/[id] — offer detay + messages array. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  try {
    const offer = await findBrandOfferById(id);
    if (!offer) {
      return NextResponse.json({ error: "Teklif bulunamadı" }, { status: 404 });
    }
    const guard = assertCanReadOffer(session, offer);
    if (guard) return guard;
    const messages = await fetchBrandOfferMessages(offer.id);
    return NextResponse.json({ offer, messages });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Teklif yüklenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
