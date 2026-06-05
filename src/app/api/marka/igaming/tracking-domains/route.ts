import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import { fetchBrandTrackingDomains } from "@/lib/db/brand-igaming-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) return NextResponse.json({ domains: [] });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const requested = new URL(req.url).searchParams.get("brandId")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;
  const brandId = resolveBrandId(session, requested);
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  try {
    const domains = await fetchBrandTrackingDomains(brandId);
    return NextResponse.json({ domains });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Takip domainleri alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
