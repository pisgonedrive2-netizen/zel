import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import { loadAchievementDayItems } from "@/lib/achievement-day";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/marka/achievement-day?brandId=&employeeId=&date=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date")?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date (YYYY-MM-DD) gerekli" }, { status: 400 });
  }

  const requestedBrand = req.nextUrl.searchParams.get("brandId")?.trim();
  const brandId = resolveBrandId(session, requestedBrand);
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });

  const guard = ensureBrandAccess(session, brandId, "read");
  if (guard) return guard;

  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim();
  const db = getSupabaseAdmin();

  const partnerIds = new Set<string>();
  const { data: linkRows } = await db
    .from("brand_links")
    .select("owner_id")
    .eq("brand_id", brandId)
    .not("owner_id", "is", null);
  for (const row of linkRows ?? []) {
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

  const targets = employeeId && employeeId !== "all"
    ? partnerIds.has(employeeId)
      ? [employeeId]
      : []
    : [...partnerIds];

  if (employeeId && employeeId !== "all" && targets.length === 0) {
    return NextResponse.json({ error: "Yayıncı bu markanın partneri değil" }, { status: 403 });
  }

  const items = [];
  for (const eid of targets) {
    const dayItems = await loadAchievementDayItems({ employeeId: eid, date, brandId });
    items.push(...dayItems);
  }

  const seen = new Set<string>();
  const unique = items.filter((x) => {
    const key = `${x.id}|${x.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({ ok: true, date, items: unique });
}
