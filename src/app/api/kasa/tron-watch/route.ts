import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import { canViewRamizWalletSession } from "@/lib/ramiz-wallet-access";
import { getTronWatchConfig, watchTronWallet } from "@/lib/tron-watch";
import { notifyTronWalletTransactions } from "@/lib/tron-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** İzlenen TRON cüzdan — yalnızca bildirim, kasa hareketine yazılmaz. */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const session = await getSession();
  const cronSecret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization");
  const isCron = Boolean(cronSecret && auth === `Bearer ${cronSecret}`);

  if (!isCron && (!session || (session.role !== "admin" && session.role !== "auditor"))) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }
  if (!isCron && session && !canViewRamizWalletSession(session)) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }

  const cfg = await getTronWatchConfig();
  if (!cfg) {
    return NextResponse.json({
      ok: false,
      error: "TRON adresi tanımlı değil (kasa kaydı veya env)",
    }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { recentDays?: number };
  const recentDays = body.recentDays ?? 3;

  try {
    const summary = await watchTronWallet({ recentDays });
    let notifications = 0;
    if (summary.newTxs.length > 0) {
      notifications = await notifyTronWalletTransactions({
        walletLabel: cfg.label,
        walletAddress: cfg.address,
        txs: summary.newTxs,
        triggeredBy: isCron ? "cron" : "watch",
      });
    }

    return NextResponse.json({
      ok: true,
      watchOnly: true,
      address: summary.address,
      newCount: summary.newCount,
      newIn: summary.newIn,
      newOut: summary.newOut,
      skipped: summary.skipped,
      notifications,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "TRON izleme hatası",
    }, { status: 500 });
  }
}
