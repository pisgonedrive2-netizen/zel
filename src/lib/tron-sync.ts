import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Kasa, KasaTransaction } from "@/store/store";

const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

type TronTrc20Tx = {
  transaction_id: string;
  block_timestamp: number;
  from: string;
  to: string;
  value: string;
  token_info?: { symbol?: string; decimals?: number };
};

function uid() {
  return `kt-${crypto.randomUUID().slice(0, 12)}`;
}

/** TronGrid TRC20 transferlerini kasa hareketlerine dönüştürür. */
export async function syncTronTransfersForKasa(kasa: Kasa): Promise<{
  imported: number;
  skipped: number;
}> {
  const address = kasa.tronAddress?.trim();
  const syncFrom = kasa.tronSyncFrom;
  if (!address || !syncFrom) {
    throw new Error("TRON adresi ve başlangıç tarihi gerekli.");
  }

  const minTs = new Date(`${syncFrom}T00:00:00Z`).getTime();
  const url = new URL(
    `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`
  );
  url.searchParams.set("limit", "200");
  url.searchParams.set("only_confirmed", "true");
  url.searchParams.set("contract_address", USDT_TRC20);
  url.searchParams.set("min_timestamp", String(minTs));

  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = process.env.TRONGRID_API_KEY?.trim();
  if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    throw new Error(`TronGrid HTTP ${res.status}`);
  }

  const json = (await res.json()) as { data?: TronTrc20Tx[] };
  const txs = json.data ?? [];

  const db = getSupabaseAdmin();
  const { data: existing } = await db
    .from("kasa_transactions")
    .select("tron_tx_id")
    .eq("kasa_id", kasa.id)
    .not("tron_tx_id", "is", null);
  const seen = new Set(
    (existing ?? []).map((r) => String((r as { tron_tx_id: string }).tron_tx_id))
  );

  const addrLower = address.toLowerCase();
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const tx of txs) {
    if (!tx.transaction_id || seen.has(tx.transaction_id)) {
      skipped++;
      continue;
    }
    const decimals = tx.token_info?.decimals ?? 6;
    const amount = Number(tx.value) / 10 ** decimals;
    if (!Number.isFinite(amount) || amount <= 0) {
      skipped++;
      continue;
    }

    const toMe = tx.to?.toLowerCase() === addrLower;
    const fromMe = tx.from?.toLowerCase() === addrLower;
    if (!toMe && !fromMe) {
      skipped++;
      continue;
    }

    const direction: KasaTransaction["direction"] = toMe ? "in" : "out";
    const iso = new Date(tx.block_timestamp).toISOString().slice(0, 16);

    rows.push({
      id: uid(),
      kasa_id: kasa.id,
      date: iso,
      direction,
      amount_usd: Math.round(amount * 100) / 100,
      fee_usd: 0,
      purpose: "TRON USDT (otomatik)",
      counterparty: direction === "in" ? tx.from : tx.to,
      proof: tx.transaction_id,
      notes: "",
      tron_tx_id: tx.transaction_id,
      auto_imported: true,
    });
    seen.add(tx.transaction_id);
  }

  if (rows.length > 0) {
    const { error } = await db.from("kasa_transactions").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  return { imported: rows.length, skipped };
}
