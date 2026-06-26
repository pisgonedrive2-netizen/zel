import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSupabaseEnabled } from "@/lib/env";
import { canViewRamizWalletSession } from "@/lib/ramiz-wallet-access";
import { resolveTronConfig } from "@/lib/tron-config";
import { DEFAULT_TRON_KASA_ADDRESS } from "@/lib/tron-grid-auth";
import { fetchTronWalletOnChainBalancesDetailed } from "@/lib/tron-wallet-balances";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — Cüzdan zincir bakiyesi (USDT, USDC, TRX). ?address= opsiyonel. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }
  if (!canViewRamizWalletSession(session)) {
    return NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }

  if (!isSupabaseEnabled()) {
    return NextResponse.json({ ok: false, error: "Supabase yapılandırılmamış" }, { status: 503 });
  }

  const q = req.nextUrl.searchParams.get("address")?.trim();
  const resolved = await resolveTronConfig();
  const address =
    q ||
    resolved.kasaAddress ||
    process.env.TRON_KASA_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_TRON_KASA_ADDRESS?.trim() ||
    DEFAULT_TRON_KASA_ADDRESS ||
    null;

  if (!address) {
    return NextResponse.json({ ok: false, error: "TRON cüzdan adresi yok" }, { status: 400 });
  }

  const apiKey = process.env.TRONGRID_API_KEY?.trim();
  const result = await fetchTronWalletOnChainBalancesDetailed(address, apiKey);

  if (!result.balances) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error ?? "TronGrid bakiyesi alınamadı",
        address,
        hint: !apiKey
          ? "TRONGRID_API_KEY tanımlı değil — public tier (düşük kota)."
          : result.usedPublicTier
            ? "API anahtarı geçersiz — Vercel/.env.local içinde güncelleyin."
            : undefined,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    address,
    balances: result.balances,
    warning: result.error,
    usedPublicTier: result.usedPublicTier,
  });
}
