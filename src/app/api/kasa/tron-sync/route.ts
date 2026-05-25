import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { kasaAccountFromRow } from "@/lib/db/mappers";
import {
  ensureTronKasaConfigured,
  syncTronTransfersForKasa,
  updateKasaTronSyncFrom,
} from "@/lib/tron-sync";
import { notifyTronNewTransactions } from "@/lib/tron-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { kasaId, syncFrom?, persistSyncFrom? }
 * TRON TRC20 USDT → kasa hareketleri; bakiye hareketlerden güncellenir.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    kasaId?: string;
    syncFrom?: string;
    persistSyncFrom?: boolean;
    recentDays?: number;
    triggeredBy?: string;
  };
  const kasaId = body.kasaId?.trim();
  if (!kasaId) {
    return NextResponse.json({ ok: false, error: "kasaId gerekli" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("kasas")
    .select("*")
    .eq("id", kasaId)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Kasa bulunamadı" }, { status: 404 });
  }

  let kasa = kasaAccountFromRow(data as Record<string, unknown>);
  kasa = await ensureTronKasaConfigured(kasa);
  const syncFrom = body.syncFrom?.trim();

  try {
    if (syncFrom && body.persistSyncFrom) {
      await updateKasaTronSyncFrom(kasaId, syncFrom);
      kasa.tronSyncFrom = syncFrom;
    }

    const summary = await syncTronTransfersForKasa(kasa, {
      syncFrom: syncFrom || kasa.tronSyncFrom,
      recentDays: body.recentDays,
    });

    if (summary.newTxs.length > 0) {
      const triggeredBy =
        body.triggeredBy === "kasa-page" ? "kasa-page" : session.userId;
      await notifyTronNewTransactions({
        kasaId: kasa.id,
        kasaName: kasa.name,
        txs: summary.newTxs,
        balanceUsd: summary.balanceUsd,
        triggeredBy,
      }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "TRON senkron hatası",
    }, { status: 500 });
  }
}
