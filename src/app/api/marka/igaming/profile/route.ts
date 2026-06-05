import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import {
  fetchBrandIgamingProfile,
  updateBrandIgamingProfile,
} from "@/lib/db/brand-igaming-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ profile: { restrictedGeos: [], igamingSettings: {} } });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const brandId = resolveBrandId(session, req.nextUrl.searchParams.get("brandId")?.trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;
  const profile = await fetchBrandIgamingProfile(brandId);
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    brandId?: string;
    licenseJurisdiction?: string;
    restrictedGeos?: string[];
    igamingSettings?: Record<string, unknown>;
  } | null;
  const brandId = resolveBrandId(session, String(body?.brandId ?? "").trim());
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  const guard = ensureBrandAccess(session, brandId, "write");
  if (guard) return guard;
  await updateBrandIgamingProfile(brandId, {
    licenseJurisdiction: body?.licenseJurisdiction,
    restrictedGeos: body?.restrictedGeos,
    igamingSettings: body?.igamingSettings,
  });
  const profile = await fetchBrandIgamingProfile(brandId);
  return NextResponse.json({ profile });
}
