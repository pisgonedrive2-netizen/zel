import { NextRequest, NextResponse } from "next/server";
import { isSupabaseEnabled } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { kasaAccountFromRow, kasaFromRow } from "@/lib/db/mappers";
import {
  ensureTronKasaConfigured,
  syncTronTransfersForKasa,
} from "@/lib/tron-sync";
import { TRON_BACKGROUND_RECENT_DAYS } from "@/lib/tron-grid-config";
import { notifyTronNewTransactions } from "@/lib/tron-notify";
import { findPrimaryTronKasa } from "@/lib/kasa-tron-metrics";
import type { Kasa, KasaTransaction } from "@/store/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron: TRON USDT → kasa hareketleri (her 5 dk).
 * Bildirim için tron-watch ayrıca çağrılabilir.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }

  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yok" }, { status: 503 });
  }

  const db = getSupabaseAdmin();
  const { data: kasaRows } = await db.from("kasas").select("*").eq("archived", false);
  const kasas = (kasaRows ?? []).map((r) =>
    kasaAccountFromRow(r as Record<string, unknown>)
  );
  const { data: txRows } = await db.from("kasa_transactions").select("*");
  const kasaTransactions: KasaTransaction[] = (txRows ?? []).map((r) =>
    kasaFromRow(r as Record<string, unknown>)
  );

  const tronKasa = findPrimaryTronKasa(kasas, kasaTransactions);
  if (!tronKasa?.tronAddress) {
    return NextResponse.json({ ok: false, error: "TRON kasa yapılandırılmamış" }, { status: 503 });
  }

  try {
    let kasa: Kasa = await ensureTronKasaConfigured(tronKasa);
    const summary = await syncTronTransfersForKasa(kasa, {
      recentDays: TRON_BACKGROUND_RECENT_DAYS,
    });

    if (summary.newTxs.length > 0) {
      await notifyTronNewTransactions({
        kasaId: kasa.id,
        kasaName: kasa.name,
        txs: summary.newTxs,
        balanceUsd: summary.balanceUsd,
        triggeredBy: "cron",
      }).catch(() => undefined);
    }

    const origin = req.nextUrl.origin;
    let watch: Record<string, unknown> | null = null;
    try {
      const watchRes = await fetch(`${origin}/api/kasa/tron-watch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recentDays: TRON_BACKGROUND_RECENT_DAYS }),
      });
      watch = (await watchRes.json().catch(() => null)) as Record<string, unknown> | null;
    } catch {
      watch = { ok: false, error: "tron-watch çağrılamadı" };
    }

    return NextResponse.json({
      ok: true,
      kasaId: kasa.id,
      imported: summary.imported,
      importedIn: summary.importedIn,
      importedOut: summary.importedOut,
      truncated: summary.truncated ?? false,
      pagesFetched: summary.pagesFetched,
      watch,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "TRON cron senkron hatası",
      },
      { status: 500 }
    );
  }
}
