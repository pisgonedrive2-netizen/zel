import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import { resolveTronConfig } from "@/lib/tron-config";
import { fetchTronWalletOnChainBalances } from "@/lib/tron-wallet-balances";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — Cüzdan zincir bakiyesi (USDT, USDC, TRX). ?address= opsiyonel. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }

  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const q = req.nextUrl.searchParams.get("address")?.trim();
  const resolved = await resolveTronConfig();
  const envAddress = process.env.TRON_KASA_ADDRESS?.trim() ?? "";
  const address = q || resolved.kasaAddress || envAddress || null;

  if (!address) {
    return NextResponse.json({ ok: false, error: "TRON cüzdan adresi yok" }, { status: 400 });
  }

  const apiKey = process.env.TRONGRID_API_KEY?.trim();
  const balances = await fetchTronWalletOnChainBalances(address, apiKey);

  if (!balances) {
    return NextResponse.json(
      { ok: false, error: "TronGrid bakiyesi alınamadı", address },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, address, balances });
}
