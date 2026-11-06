import { NextRequest, NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/session";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import {
  addSubmissions,
  clipTablesReady,
  deleteSubmissions,
  loadClipFarm,
  markPayout,
  refreshSubmissions,
  reviewSubmissions,
  saveCampaign,
  undoPayout,
  updateCreator,
} from "@/lib/clip-farm/server";
import { CLIP_SETUP_SQL } from "@/lib/clip-farm/setup-sql";
import type { ClipCampaign, ClipCreator, ClipCurrency } from "@/lib/clip-farm/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function adminSession(): Promise<SessionPayload | null> {
  const s = await getSession();
  return s && s.role === "admin" ? s : null;
}

export async function GET() {
  if (!isSupabaseEnabled()) return NextResponse.json({ ok: false, error: "Supabase yok" }, { status: 503 });
  if (!(await adminSession())) return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  if (!(await clipTablesReady())) {
    return NextResponse.json({ ok: true, ready: false, setupSql: CLIP_SETUP_SQL });
  }
  const data = await loadClipFarm();
  return NextResponse.json({ ok: true, ready: true, ...data });
}

type Action =
  | { action: "campaign.save"; campaign: ClipCampaign }
  | { action: "creator.update"; id: string; patch: Partial<ClipCreator> }
  | { action: "review"; ids: string[]; status: "approved" | "rejected" | "pending"; reason?: string }
  | { action: "delete"; ids: string[] }
  | { action: "add-videos"; creatorId: string; campaignId: string; urls: string[] }
  | { action: "refresh"; ids?: string[] }
  | { action: "payout.mark"; creatorId: string; monthYm: string; currency: ClipCurrency; amount: number; note?: string }
  | { action: "payout.undo"; creatorId: string; monthYm: string; currency: ClipCurrency };

export async function POST(req: NextRequest) {
  const session = await adminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as Action | null;
  if (!body?.action) return NextResponse.json({ ok: false, error: "Geçersiz istek" }, { status: 400 });

  try {
    switch (body.action) {
      case "campaign.save": {
        const c = body.campaign;
        if (!c?.title?.trim()) return NextResponse.json({ ok: false, error: "Kampanya adı gerekli" }, { status: 400 });
        const campaign = await saveCampaign({ ...c, title: c.title.trim() });
        return NextResponse.json({ ok: true, campaign });
      }
      case "creator.update":
        await updateCreator(body.id, body.patch ?? {});
        return NextResponse.json({ ok: true });
      case "review":
        if (!body.ids?.length) return NextResponse.json({ ok: false, error: "Video seç" }, { status: 400 });
        await reviewSubmissions(body.ids, body.status, body.reason?.trim() ?? "", session.name || session.username);
        return NextResponse.json({ ok: true });
      case "delete":
        await deleteSubmissions(body.ids ?? []);
        return NextResponse.json({ ok: true });
      case "add-videos": {
        const data = await loadClipFarm();
        const campaign = data.campaigns.find((c) => c.id === body.campaignId);
        if (!campaign) return NextResponse.json({ ok: false, error: "Kampanya bulunamadı" }, { status: 400 });
        const results = await addSubmissions({
          creatorId: body.creatorId,
          campaign,
          urls: body.urls ?? [],
          source: "admin",
          approvedBy: session.name || session.username,
        });
        const ids = results.filter((r) => r.ok && r.id).map((r) => r.id!);
        if (ids.length && isRapidApiEnabled()) await refreshSubmissions({ ids }, 120_000);
        return NextResponse.json({ ok: true, results });
      }
      case "refresh": {
        if (!isRapidApiEnabled()) return NextResponse.json({ ok: false, error: "RapidAPI yok" }, { status: 503 });
        const summary = await refreshSubmissions({ ids: body.ids });
        return NextResponse.json({ ok: true, ...summary });
      }
      case "payout.mark":
        await markPayout(
          { creatorId: body.creatorId, monthYm: body.monthYm, currency: body.currency, amount: Number(body.amount) || 0, note: body.note ?? "" },
          session.name || session.username
        );
        return NextResponse.json({ ok: true });
      case "payout.undo":
        await undoPayout(body.creatorId, body.monthYm, body.currency);
        return NextResponse.json({ ok: true });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "İşlem başarısız" }, { status: 500 });
  }
  return NextResponse.json({ ok: false, error: "Bilinmeyen işlem" }, { status: 400 });
}
