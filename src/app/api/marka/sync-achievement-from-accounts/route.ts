import { NextRequest, NextResponse } from "next/server";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { weekBrandReelFromRow } from "@/lib/db/mappers";
import { weeklyPlanMatchesBrand } from "@/lib/weekly-plan-brand-match";
import {
  countActivePersonalAccounts,
  syncEmployeePersonalAccounts,
} from "@/lib/social-api/streamer-achievement-sync";
import { notifyBrandContentPublished } from "@/lib/marka-brand-notify";
import type { WeekBrandReel } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/marka/sync-achievement-from-accounts?brandId=&employeeId=
 * Marka partner yayıncılarının kişisel hesaplarını tarar (marka linkleri değil).
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });

  const requestedBrand = req.nextUrl.searchParams.get("brandId")?.trim();
  const brandId = resolveBrandId(session, requestedBrand);
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;

  const filterEmployeeId = req.nextUrl.searchParams.get("employeeId")?.trim();

  const db = getSupabaseAdmin();
  const { data: linkOwners } = await db
    .from("brand_links")
    .select("owner_id")
    .eq("brand_id", brandId)
    .eq("status", "active")
    .not("owner_id", "is", null);

  const partnerIds = new Set<string>();
  for (const row of linkOwners ?? []) {
    const oid = (row as { owner_id?: string }).owner_id;
    if (oid) partnerIds.add(oid);
  }

  const { data: dealRows } = await db
    .from("brand_deals")
    .select("employee_id")
    .eq("brand_id", brandId);
  for (const row of dealRows ?? []) {
    const eid = (row as { employee_id?: string }).employee_id;
    if (eid) partnerIds.add(eid);
  }

  const { data: brandRow } = await db
    .from("brands")
    .select("name, short_name")
    .eq("id", brandId)
    .maybeSingle();
  if (brandRow) {
    const { data: planRows } = await db
      .from("weekly_plans")
      .select("employee_id, brand_name");
    for (const row of planRows ?? []) {
      const eid = (row as { employee_id?: string }).employee_id;
      const brandName = (row as { brand_name?: string | null }).brand_name ?? "";
      if (
        eid &&
        weeklyPlanMatchesBrand(
          { brandName },
          {
            name: String((brandRow as { name: string }).name),
            shortName: String((brandRow as { short_name?: string }).short_name ?? ""),
          },
        )
      ) {
        partnerIds.add(eid);
      }
    }
  }

  let employeeIds = [...partnerIds];
  if (filterEmployeeId) {
    if (!partnerIds.has(filterEmployeeId)) {
      return NextResponse.json({ error: "Bu yayıncı marka partneri değil" }, { status: 403 });
    }
    employeeIds = [filterEmployeeId];
  }

  if (!isRapidApiEnabled()) {
    let accountsReady = 0;
    for (const eid of employeeIds) {
      accountsReady += await countActivePersonalAccounts(eid);
    }
    const reels = await loadBrandPersonalReels(brandId, filterEmployeeId);
    return NextResponse.json({
      ok: true,
      reels,
      rapidApiEnabled: false,
      accountsReady,
      summary: {
        attempted: accountsReady,
        synced: reels.length,
        skipped: 0,
        failed: 0,
        errors: [],
      },
      warning:
        accountsReady > 0
          ? "RAPIDAPI_KEY tanımlı değil — .env.local veya Vercel’e RapidAPI anahtarını ekleyin."
          : "Partner yayıncılarda aktif kişisel hesap yok.",
    });
  }

  const merged = {
    attempted: 0,
    synced: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const eid of employeeIds) {
    const s = await syncEmployeePersonalAccounts(eid, { maxAccounts: 4 });
    merged.attempted += s.attempted;
    merged.synced += s.synced;
    merged.skipped += s.skipped;
    merged.failed += s.failed;
    merged.errors.push(...s.errors);
  }

  const reels = await loadBrandPersonalReels(brandId, filterEmployeeId);

  if (merged.synced > 0) {
    void notifyBrandContentPublished({
      brandId,
      synced: merged.synced,
      monthYm: new Date().toISOString().slice(0, 7),
      employeeId: filterEmployeeId,
    });
  }

  return NextResponse.json({
    ok: true,
    reels,
    summary: merged,
    rapidApiEnabled: true,
    accountsReady: merged.attempted,
  });
}

async function loadBrandPersonalReels(
  brandId: string,
  employeeId?: string
): Promise<WeekBrandReel[]> {
  const db = getSupabaseAdmin();
  const { data: partners } = await db
    .from("brand_links")
    .select("owner_id")
    .eq("brand_id", brandId)
    .not("owner_id", "is", null);
  const ids = new Set(
    (partners ?? []).map((r) => (r as { owner_id: string }).owner_id).filter(Boolean)
  );
  if (employeeId) {
    if (!ids.has(employeeId)) return [];
    ids.clear();
    ids.add(employeeId);
  }
  if (ids.size === 0) return [];

  const { data } = await db
    .from("week_brand_reels")
    .select("*")
    .in("employee_id", [...ids])
    .is("brand_link_id", null)
    .not("streamer_account_id", "is", null);

  return (data ?? []).map((r) => weekBrandReelFromRow(r as Record<string, unknown>));
}
