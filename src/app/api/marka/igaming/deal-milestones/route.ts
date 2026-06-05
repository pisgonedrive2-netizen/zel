import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import { fetchBrandDealMilestones } from "@/lib/db/brand-igaming-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ milestones: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const url = new URL(req.url);
  const requested = url.searchParams.get("brandId")?.trim() || undefined;
  const dealId = url.searchParams.get("dealId")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requested);
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  try {
    const milestones = await fetchBrandDealMilestones(brandId, dealId);
    return NextResponse.json({ milestones });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kilometre taşları alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
