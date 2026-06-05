import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSession } from "@/lib/session";
import { ensureBrandAccess, resolveBrandId } from "@/lib/org-access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchBrandCampaigns, fetchBrandComplianceChecks } from "@/lib/db/brand-igaming-repo";
import { fetchCrmDeals } from "@/lib/db/crm-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  return lines.join("\n");
}

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

  const type = req.nextUrl.searchParams.get("type")?.trim() ?? "stats";
  const month =
    req.nextUrl.searchParams.get("month")?.trim() ||
    new Date().toISOString().slice(0, 7);
  const download = req.nextUrl.searchParams.get("download") === "1";

  try {
    if (type === "stats") {
      const { data } = await getSupabaseAdmin()
        .from("brand_monthly_stats")
        .select("*")
        .eq("brand_id", brandId)
        .order("month", { ascending: false });
      const rows = (data ?? []).map((r) => {
        const row = r as Record<string, unknown>;
        return [
          row.month,
          row.new_registrations,
          row.first_time_depositors,
          row.deposit_amount,
          row.withdrawal_amount,
          row.ggr,
          row.ngr,
          row.commission_total,
          row.active_players,
        ];
      });
      const csv = toCsv(
        ["Ay", "Kayıt", "FTD", "Yatırım", "Çekim", "GGR", "NGR", "Komisyon", "Aktif oyuncu"],
        rows,
      );
      if (download) {
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="marka-stats-${brandId}-${month}.csv"`,
          },
        });
      }
      return NextResponse.json({ type, rowCount: rows.length, preview: rows.slice(0, 5) });
    }

    if (type === "affiliate") {
      const monthStart = `${month}-01`;
      const monthEnd = monthStart.slice(0, 8) + "31";
      const { data } = await getSupabaseAdmin()
        .from("affiliate_daily_stats")
        .select("stat_date, partner_id, clicks, registrations, ftd_count, deposit_amount, commission_due")
        .eq("brand_id", brandId)
        .gte("stat_date", monthStart)
        .lte("stat_date", monthEnd)
        .order("stat_date", { ascending: true });
      const rows = (data ?? []).map((r) => {
        const row = r as Record<string, unknown>;
        return [
          row.stat_date,
          row.partner_id,
          row.clicks,
          row.registrations,
          row.ftd_count,
          row.deposit_amount,
          row.commission_due,
        ];
      });
      const csv = toCsv(
        ["Tarih", "Partner", "Tıklama", "Kayıt", "FTD", "Yatırım", "Komisyon"],
        rows,
      );
      if (download) {
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="marka-affiliate-${brandId}-${month}.csv"`,
          },
        });
      }
      return NextResponse.json({ type, rowCount: rows.length, preview: rows.slice(0, 5) });
    }

    if (type === "deals") {
      const [crmDeals, campaigns] = await Promise.all([
        fetchCrmDeals([brandId]),
        fetchBrandCampaigns(brandId),
      ]);
      const rows = crmDeals.map((d) => [
        d.id,
        d.title,
        d.stage,
        d.value,
        d.currency,
        d.expectedFtd ?? "",
        d.commissionModel ?? "",
        d.probability,
      ]);
      const campaignRows = campaigns.map((c) => [c.id, c.name, c.campaignType, c.status, c.budgetUsd ?? "", c.promoCode ?? ""]);
      const csv =
        toCsv(["ID", "Başlık", "Aşama", "Değer", "PB", "Beklenen FTD", "Komisyon modeli", "Olasılık"], rows) +
        "\n\n" +
        toCsv(["Kampanya ID", "Ad", "Tip", "Durum", "Bütçe USD", "Promo kod"], campaignRows);
      if (download) {
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="marka-deals-${brandId}.csv"`,
          },
        });
      }
      return NextResponse.json({ type, crmCount: rows.length, campaignCount: campaignRows.length });
    }

    if (type === "compliance") {
      const checks = await fetchBrandComplianceChecks(brandId);
      const rows = checks.map((c) => [c.checkType, c.status, c.dueDate ?? "", c.notes]);
      const csv = toCsv(["Tip", "Durum", "Vade", "Not"], rows);
      if (download) {
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="marka-compliance-${brandId}.csv"`,
          },
        });
      }
      return NextResponse.json({ type, rowCount: rows.length });
    }

    return NextResponse.json({ error: "Geçersiz type — stats, affiliate, deals, compliance" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Export başarısız" }, { status: 500 });
  }
}
