import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import { resolveTronConfig } from "@/lib/tron-config";
import { fetchTronWalletOnChainBalances } from "@/lib/tron-wallet-balances";

async function probeTronGrid(apiKey: string | undefined) {
  const start = Date.now();
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
    const res = await fetch("https://api.trongrid.io/wallet/getnowblock", {
      headers,
      signal: AbortSignal.timeout(8_000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: text.slice(0, 120) || res.statusText, latencyMs };
    }
    return { ok: true, message: "TronGrid erişilebilir", latencyMs };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "?",
      latencyMs: Date.now() - start,
    };
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — TronGrid API ve kasa cüzdan yapılandırması (admin/denetçi). */
export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }

  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const apiKeySet = Boolean(process.env.TRONGRID_API_KEY?.trim());
  const envAddress = process.env.TRON_KASA_ADDRESS?.trim() ?? "";
  const envSyncFrom = process.env.TRON_SYNC_FROM?.trim() ?? "";

  const resolved = await resolveTronConfig();
  const tronAddress = resolved.kasaAddress ?? envAddress ?? null;
  const apiKey = process.env.TRONGRID_API_KEY?.trim();

  let walletBalances: Awaited<ReturnType<typeof fetchTronWalletOnChainBalances>> = null;
  if (tronAddress) {
    walletBalances = await fetchTronWalletOnChainBalances(tronAddress, apiKey);
  }

  let probeOk = false;
  let probeMessage = "";
  let probeLatencyMs = 0;
  if (apiKeySet) {
    const probe = await probeTronGrid(process.env.TRONGRID_API_KEY?.trim());
    probeOk = probe.ok;
    probeMessage = probe.message;
    probeLatencyMs = probe.latencyMs;
  } else {
    probeMessage = "TRONGRID_API_KEY tanımlı değil — .env.local veya Vercel env ekleyin";
  }

  return NextResponse.json({
    ok: true,
    syncIntervalMinutes: 5,
    estimatedMonthlyRequests: "~15k (günlük cron + kasa arka plan + manuel)",
    apiKeySet,
    watchOnly: Boolean(resolved.watchAddress),
    watchAddress: resolved.watchAddress,
    watchSyncFrom: resolved.watchSyncFrom,
    watchLabel: resolved.watchLabel,
    watchSource: resolved.watchSource,
    envAddress,
    envSyncFrom,
    primaryKasaId: resolved.primaryKasaId,
    primaryKasaName: resolved.primaryKasaName,
    tronAddress,
    tronSyncFrom: resolved.kasaSyncFrom ?? envSyncFrom ?? null,
    walletBalances,
    probeOk,
    probeMessage,
    probeLatencyMs,
  });
}
