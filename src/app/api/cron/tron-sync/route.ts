import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { kasaAccountFromRow } from "@/lib/db/mappers";
import { syncTronTransfersForKasa } from "@/lib/tron-sync";
import { notifyTronSyncResult } from "@/lib/tron-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Günlük TRON USDT senkronu — CRON_SECRET ile korunur. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const { data: kasas } = await db
    .from("kasas")
    .select("*")
    .not("tron_address", "is", null);

  const results: Array<{ kasaId: string; imported: number; error?: string }> = [];

  for (const row of kasas ?? []) {
    const kasa = kasaAccountFromRow(row as Record<string, unknown>);
    if (!kasa.tronAddress) continue;
    try {
      const summary = await syncTronTransfersForKasa(kasa, { recentDays: 14 });
      results.push({ kasaId: kasa.id, imported: summary.imported });
      if (summary.imported > 0) {
        await notifyTronSyncResult({
          kasaId: kasa.id,
          kasaName: kasa.name,
          imported: summary.imported,
          skipped: summary.skipped,
          totalIn: summary.totalIn,
          totalOut: summary.totalOut,
          balanceUsd: summary.balanceUsd,
          syncFrom: kasa.tronSyncFrom ?? "",
          triggeredBy: "cron",
        }).catch(() => undefined);
      }
    } catch (e) {
      results.push({
        kasaId: kasa.id,
        imported: 0,
        error: e instanceof Error ? e.message : "?",
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
