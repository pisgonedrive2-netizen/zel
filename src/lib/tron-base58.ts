import { createHash } from "crypto";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function decodeBase58(str: string): Buffer {
  const bytes: number[] = [0];
  for (const ch of str) {
    const val = BASE58_ALPHABET.indexOf(ch);
    if (val < 0) throw new Error("invalid base58");
    let carry = val;
    for (let i = bytes.length - 1; i >= 0; i--) {
      carry += bytes[i]! * 58;
      bytes[i] = carry % 256;
      carry = Math.floor(carry / 256);
    }
    while (carry > 0) {
      bytes.unshift(carry % 256);
      carry = Math.floor(carry / 256);
    }
  }
  for (const ch of str) {
    if (ch === "1") bytes.unshift(0);
    else break;
  }
  return Buffer.from(bytes);
}

/** TRON base58Check adres → `balanceOf(address)` parametresi (64 hex). */
export function tronAddressBalanceOfParameter(base58Address: string): string | null {
  try {
    const raw = decodeBase58(base58Address.trim());
    if (raw.length < 25) return null;
    const payload = raw.subarray(0, raw.length - 4);
    const checksum = raw.subarray(raw.length - 4);
    const hash = createHash("sha256")
      .update(createHash("sha256").update(payload).digest())
      .digest();
    if (!checksum.equals(hash.subarray(0, 4))) return null;
    if (payload.length !== 21 || payload[0] !== 0x41) return null;
    return payload.subarray(1, 21).toString("hex").padStart(64, "0");
  } catch {
    return null;
  }
}
