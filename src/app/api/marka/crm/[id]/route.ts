import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess } from "@/lib/org-access";
import {
  findCrmContactById, fetchCrmDeals, fetchCrmInteractions,
} from "@/lib/db/crm-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const { id } = await ctx.params;

  try {
    const contact = await findCrmContactById(id);
    if (!contact) return NextResponse.json({ error: "Kontak bulunamadı" }, { status: 404 });
    const guard = ensureBrandAccess(session, contact.brandId, "read");
    if (guard) return guard;

    const [deals, interactions] = await Promise.all([
      fetchCrmDeals([contact.brandId]).catch(() => []),
      fetchCrmInteractions([contact.brandId], id).catch(() => []),
    ]);
    return NextResponse.json({
      contact,
      deals: deals.filter((d) => d.contactId === id),
      interactions,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kontak detayı alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
