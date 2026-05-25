import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { kasaAccountFromRow } from "@/lib/db/mappers";
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

  const apiKeySet = Boolean(process.env.TRONGRID_API_KEY?.trim());
  const envAddress = process.env.TRON_KASA_ADDRESS?.trim() ?? "";
  const envSyncFrom = process.env.TRON_SYNC_FROM?.trim() ?? "";

  const { data: kasas } = await getSupabaseAdmin()
    .from("kasas")
    .select("*")
    .eq("archived", false)
    .order("order_index", { ascending: true });

  const list = (kasas ?? []).map((r) => kasaAccountFromRow(r as Record<string, unknown>));
  const primary =
    list.find((k) => k.isDefault) ?? list.find((k) => k.tronAddress) ?? list[0];

  let probeOk = false;
  let probeMessage = "";
  let probeLatencyMs = 0;
  if (apiKeySet) {
    const probe = await probeTronGrid(process.env.TRONGRID_API_KEY?.trim());
    probeOk = probe.ok;
    probeMessage = probe.message;
    probeLatencyMs = probe.latencyMs;
  } else {
    probeMessage = "TRONGRID_API_KEY tanımlı değil";
  }

  return NextResponse.json({
    ok: true,
    apiKeySet,
    envAddress,
    envSyncFrom,
    primaryKasaId: primary?.id ?? null,
    primaryKasaName: primary?.name ?? null,
    tronAddress: primary?.tronAddress ?? envAddress ?? null,
    tronSyncFrom: primary?.tronSyncFrom ?? envSyncFrom ?? null,
    probeOk,
    probeMessage,
    probeLatencyMs,
  });
}
