import { parseTrc20UsdtAmount } from "@/lib/tron-amount";
import { tronAddressBalanceOfParameter } from "@/lib/tron-base58";

/** Tether USDT (TRC20) — senkron edilen token. */
export const TRON_USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
/** Circle native USDC (TRC20) mainnet. */
export const TRON_USDC_CONTRACT = "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8";
/** Eski bridged USDC (hâlâ bazı cüzdanlarda kalabilir). */
export const TRON_USDC_LEGACY_CONTRACT = "TXLAQ63Xbg1oLCQ2G5xik7k9n9bJgC3eB";

export type TronWalletOnChainBalances = {
  trx: number;
  usdt: number;
  usdc: number;
  fetchedAt: string;
};

function tronGridHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey?.trim()) headers["TRON-PRO-API-KEY"] = apiKey.trim();
  return headers;
}

function parseTrc20BalanceMap(trc20: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(trc20)) return out;
  for (const item of trc20) {
    if (!item || typeof item !== "object") continue;
    for (const [contract, raw] of Object.entries(item as Record<string, unknown>)) {
      if (typeof raw === "string" || typeof raw === "number") {
        out[contract] = String(raw);
      }
    }
  }
  return out;
}

function trc20Amount(raw: string | undefined, decimals = 6): number {
  if (!raw) return 0;
  const n = parseTrc20UsdtAmount(raw, decimals);
  return n ?? 0;
}

function parseHexBalance(hex: string | undefined, decimals = 6): number {
  const h = String(hex ?? "")
    .replace(/^0x/i, "")
    .trim();
  if (!h) return 0;
  try {
    const raw = BigInt(`0x${h}`);
    if (raw <= BigInt(0)) return 0;
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = raw / divisor;
    const frac = raw % divisor;
    const amount = Number(whole) + Number(frac) / Number(divisor);
    if (!Number.isFinite(amount) || amount < 0) return 0;
    return Math.round(amount * 100) / 100;
  } catch {
    return 0;
  }
}

function pickTrc20Amount(map: Record<string, string>, contract: string): number {
  const direct = map[contract];
  if (direct) return trc20Amount(direct);
  const lower = contract.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase() === lower) return trc20Amount(v);
  }
  return 0;
}

async function fetchTrc20BalanceViaContract(
  ownerAddress: string,
  contractAddress: string,
  apiKey?: string,
  decimals = 6
): Promise<number> {
  const parameter = tronAddressBalanceOfParameter(ownerAddress);
  if (!parameter) return 0;

  try {
    const res = await fetch(
      "https://api.trongrid.io/wallet/triggerconstantcontract",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tronGridHeaders(apiKey) },
        body: JSON.stringify({
          owner_address: ownerAddress,
          contract_address: contractAddress,
          function_selector: "balanceOf(address)",
          parameter,
          visible: true,
        }),
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      }
    );
    if (!res.ok) return 0;
    const json = (await res.json()) as {
      constant_result?: string[];
      result?: { result?: boolean; message?: string };
    };
    if (json.result?.result === false) return 0;
    return parseHexBalance(json.constant_result?.[0], decimals);
  } catch {
    return 0;
  }
}

/**
 * TronGrid — cüzdandaki TRX + TRC20 USDT/USDC (canlı zincir).
 * USDT/USDC için `balanceOf` yedek okuma (trc20 listesi eksik kalabiliyor).
 */
export async function fetchTronWalletOnChainBalances(
  address: string,
  apiKey?: string
): Promise<TronWalletOnChainBalances | null> {
  const addr = address.trim();
  if (!addr) return null;

  try {
    const res = await fetch(
      `https://api.trongrid.io/v1/accounts/${encodeURIComponent(addr)}`,
      {
        headers: tronGridHeaders(apiKey),
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      }
    );

    let trx = 0;
    let usdt = 0;
    let usdc = 0;

    if (res.ok) {
      const json = (await res.json()) as {
        data?: Array<{
          balance?: number;
          trc20?: unknown;
        }>;
      };
      const row = json.data?.[0];
      if (row) {
        const trxSun =
          typeof row.balance === "number" && row.balance >= 0 ? row.balance : 0;
        trx = Math.round((trxSun / 1_000_000) * 1_000_000) / 1_000_000;
        const map = parseTrc20BalanceMap(row.trc20);
        usdt = pickTrc20Amount(map, TRON_USDT_CONTRACT);
        usdc =
          pickTrc20Amount(map, TRON_USDC_CONTRACT) +
          pickTrc20Amount(map, TRON_USDC_LEGACY_CONTRACT);
      }
    }

    const [usdtChain, usdcChain, usdcLegacyChain] = await Promise.all([
      fetchTrc20BalanceViaContract(addr, TRON_USDT_CONTRACT, apiKey),
      fetchTrc20BalanceViaContract(addr, TRON_USDC_CONTRACT, apiKey),
      fetchTrc20BalanceViaContract(addr, TRON_USDC_LEGACY_CONTRACT, apiKey),
    ]);

    usdt = Math.max(usdt, usdtChain);
    usdc = Math.max(usdc, usdcChain + usdcLegacyChain);

    if (!res.ok && usdt === 0 && usdc === 0 && trx === 0) {
      return null;
    }

    return {
      trx,
      usdt: Math.round(usdt * 100) / 100,
      usdc: Math.round(usdc * 100) / 100,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
