import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import { DEFAULT_AFFILIATE_TIERS } from "@/types/brand-igaming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Affiliate komisyon kademeleri — tablo yoksa varsayılan şablon döner. */
export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });

  const brandId = resolveBrandId(session, req.nextUrl.searchParams.get("brandId")?.trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;

  const tiers = DEFAULT_AFFILIATE_TIERS.map((t, i) => ({
    id: `tier-${brandId}-${i}`,
    brandId,
    ...t,
  }));

  return NextResponse.json({ ok: true, tiers });
}
