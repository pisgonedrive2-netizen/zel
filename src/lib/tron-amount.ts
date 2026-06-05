/** Postgres `numeric(14,2)` üst sınırı (kasa_transactions.amount_usd). */
export const MAX_KASA_AMOUNT_USD = 999_999_999_999.99;

const UINT256_MAX =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

/**
 * TronGrid TRC20 `value` → USDT tutarı.
 * Bazı işlemler uint256 max (approval/spam) döner — bunlar numeric overflow üretir, atlanır.
 */
export function parseTrc20UsdtAmount(
  rawValue: string,
  decimals?: number
): number | null {
  const v = String(rawValue ?? "").trim();
  if (!/^\d+$/.test(v)) return null;
  if (v === UINT256_MAX || v.length > 20) return null;

  const dec =
    typeof decimals === "number" && Number.isFinite(decimals) && decimals >= 0 && decimals <= 18
      ? Math.floor(decimals)
      : 6;

  let raw: bigint;
  try {
    raw = BigInt(v);
  } catch {
    return null;
  }

  if (raw <= BigInt(0)) return null;

  const divisor = BigInt(10) ** BigInt(dec);
  const maxRaw = BigInt(Math.floor(MAX_KASA_AMOUNT_USD * 10 ** dec));
  if (raw > maxRaw) return null;

  const whole = raw / divisor;
  const frac = raw % divisor;
  const amount = Number(whole) + Number(frac) / Number(divisor);

  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_KASA_AMOUNT_USD) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}
