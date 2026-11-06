import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { activeCampaigns, creatorByKey, creatorView } from "@/lib/clip-farm/server";
import { monthlySummaries } from "@/lib/clip-farm/rewards";
import { campaignFromRow } from "@/lib/clip-farm/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ym(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(d).slice(0, 7);
}

/** Açık sayfa: kişinin kendi videoları ve aylık kazancı (gizli anahtarla). */
export async function GET(req: NextRequest) {
  if (!isSupabaseEnabled()) return NextResponse.json({ ok: false }, { status: 503 });
  const creator = await creatorByKey(req.nextUrl.searchParams.get("k") ?? "");
  if (!creator) return NextResponse.json({ ok: false, error: "Anahtar bulunamadı." }, { status: 404 });

  const view = await creatorView(creator.id);
  const campaignIds = [...new Set(view.submissions.map((s) => s.campaignId))];
  const { data } = campaignIds.length
    ? await getSupabaseAdmin().from("clip_campaigns").select("*").in("id", campaignIds)
    : { data: [] };
  const campaigns = (data ?? []).map(campaignFromRow);
  for (const c of await activeCampaigns().catch(() => [])) if (!campaigns.some((x) => x.id === c.id)) campaigns.push(c);

  const todayYm = ym();
  const months = [...new Set([todayYm, ...view.submissions.map((s) => s.createdAt.slice(0, 7)), ...view.payouts.map((p) => p.monthYm)])]
    .filter((m) => m <= todayYm)
    .sort()
    .reverse()
    .slice(0, 12);
  const earnings = months.map((monthYm) => ({
    monthYm,
    rows: monthlySummaries({
      monthYm,
      todayYm,
      campaigns,
      creators: [creator],
      submissions: view.submissions,
      snapshots: view.snapshots,
      payouts: view.payouts,
    }).map((s) => ({ campaignId: s.campaignId, currency: s.currency, due: s.due, capped: s.capped, paid: s.paid?.amount ?? null })),
  }));

  return NextResponse.json({
    ok: true,
    creator: { name: creator.name, status: creator.status, accounts: creator.accounts },
    campaigns,
    submissions: view.submissions.map((s) => ({
      id: s.id,
      url: s.url,
      platform: s.platform,
      campaignId: s.campaignId,
      status: s.status,
      rejectReason: s.rejectReason,
      views: s.views,
      likes: s.likes,
      comments: s.comments,
      shares: s.shares,
      lastCheckedAt: s.lastCheckedAt,
      lastCheckError: s.lastCheckError,
      createdAt: s.createdAt,
    })),
    earnings,
  });
}
