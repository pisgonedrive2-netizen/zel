import { NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import { buildIgamingDashboard } from "@/lib/db/brand-igaming-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMonth(v: string | null | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}$/.test(v);
}

export async function GET(req: Request) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });

  const url = new URL(req.url);
  const requested = url.searchParams.get("brandId")?.trim() || undefined;
  const month = url.searchParams.get("month")?.trim() || undefined;
  const guard = ensureBrandAccess(session, requested ?? null, "read");
  if (guard) return guard;

  const brandId = resolveBrandId(session, requested);
  if (!brandId) return NextResponse.json({ error: "brandId gerekli" }, { status: 400 });
  if (!isMonth(month)) {
    return NextResponse.json({ error: "month formatı YYYY-MM olmalı" }, { status: 400 });
  }

  try {
    const dashboard = await buildIgamingDashboard(brandId, month);
    const summary = {
      brandId,
      month,
      monthly: {
        newRegistrations: dashboard.registrations,
        ftd: dashboard.ftd,
        depositAmount: dashboard.depositAmount,
        withdrawalAmount: dashboard.withdrawalAmount,
        ggr: dashboard.ggr,
        ngr: dashboard.ngr,
        commissionTotal: dashboard.commission,
        activePlayers: dashboard.activePlayers,
      },
      targets: {
        targetFtd: dashboard.targetFtd,
        targetNgr: dashboard.targetNgr,
        targetRegistrations: 0,
        targetDepositAmount: 0,
      },
      affiliate: {
        clicks: dashboard.affiliateClicks,
        registrations: dashboard.affiliateRegistrations,
        ftdCount: dashboard.affiliateFtd,
        depositAmount: 0,
        commissionDue: 0,
      },
    };
    return NextResponse.json({ summary, dashboard });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Dashboard özeti alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
