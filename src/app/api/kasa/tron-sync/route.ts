import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import { canViewRamizWalletSession } from "@/lib/ramiz-wallet-access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { kasaAccountFromRow } from "@/lib/db/mappers";
import { persistKasaTronFields } from "@/lib/tron-config";
import {
  ensureTronKasaConfigured,
  syncTronTransfersForKasa,
  updateKasaTronSyncFrom,
} from "@/lib/tron-sync";
import { notifyTronNewTransactions } from "@/lib/tron-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Tam geçmiş çekiminde TronGrid sayfalama uzun sürebilir. */
export const maxDuration = 60;

/**
 * POST { kasaId, syncFrom?, persistSyncFrom? }
 * TRON TRC20 USDT → kasa hareketleri; bakiye hareketlerden güncellenir.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseEnabled()) {
      return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
    }
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "auditor")) {
      return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
    }
    if (!canViewRamizWalletSession(session)) {
      return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      kasaId?: string;
      syncFrom?: string;
      tronAddress?: string;
      tronSyncFrom?: string;
      persistSyncFrom?: boolean;
      forceFromDate?: boolean;
      recentDays?: number;
      triggeredBy?: string;
    };
    const kasaId = body.kasaId?.trim();
    if (!kasaId) {
      return NextResponse.json({ ok: false, error: "kasaId gerekli" }, { status: 400 });
    }

    const apiKeySet = Boolean(process.env.TRONGRID_API_KEY?.trim());

    const { data, error } = await getSupabaseAdmin()
      .from("kasas")
      .select("*")
      .eq("id", kasaId)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ ok: false, error: "Kasa bulunamadı" }, { status: 404 });
    }

    let kasa = kasaAccountFromRow(data as Record<string, unknown>);

    if (body.tronAddress?.trim() || body.tronSyncFrom?.trim()) {
      const patched = await persistKasaTronFields(kasaId, {
        tronAddress: body.tronAddress,
        tronSyncFrom: body.tronSyncFrom,
      });
      if (patched) kasa = patched;
    }

    kasa = await ensureTronKasaConfigured(kasa);
    const syncFrom = body.syncFrom?.trim();

    if (!kasa.tronAddress?.trim()) {
      return NextResponse.json({
        ok: false,
        error:
          "TRON adresi yok — Kasa ayarlarından adresi kaydedin veya TRON_KASA_ADDRESS env tanımlayın.",
      }, { status: 400 });
    }

    if (syncFrom && body.persistSyncFrom) {
      await updateKasaTronSyncFrom(kasaId, syncFrom);
      kasa.tronSyncFrom = syncFrom;
    }

    const summary = await syncTronTransfersForKasa(kasa, {
      syncFrom: syncFrom || kasa.tronSyncFrom,
      recentDays: body.recentDays,
      forceFromDate: Boolean(body.forceFromDate || body.persistSyncFrom),
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

    return NextResponse.json({
      ok: true,
      ...summary,
      apiKeySet,
      hint: summary.truncated
        ? "TronGrid sayfa limiti doldu; daha yakın bir tarihten tekrar çekin veya birkaç dakika sonra yenileyin."
        : !apiKeySet
          ? "TRONGRID_API_KEY yok — public tier (düşük kota) kullanıldı."
          : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "TRON senkron hatası";
    console.error("[tron-sync]", msg, e);
    const status = msg.includes("429") ? 429 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
