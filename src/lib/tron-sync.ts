import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { kasaFromRow } from "@/lib/db/mappers";
import { calcKasaBalance, type Kasa, type KasaTransaction } from "@/store/store";

const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const MAX_PAGES = 15;

type TronTrc20Tx = {
  transaction_id: string;
  block_timestamp: number;
  from: string;
  to: string;
  value: string;
  token_info?: { symbol?: string; decimals?: number };
};

export interface TronSyncResult {
  imported: number;
  skipped: number;
  totalIn: number;
  totalOut: number;
  balanceUsd: number;
  pagesFetched: number;
}

function stableTxId(tronTxId: string): string {
  const safe = tronTxId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  return `kt-tron-${safe}`;
}

/** TronGrid TRC20 transferlerini kasa hareketlerine dönüştürür; bakiye hareketlerden hesaplanır. */
export async function syncTronTransfersForKasa(
  kasa: Kasa,
  opts?: { syncFrom?: string }
): Promise<TronSyncResult> {
  const address = kasa.tronAddress?.trim();
  const syncFrom = opts?.syncFrom?.trim() || kasa.tronSyncFrom;
  if (!address || !syncFrom) {
    throw new Error("TRON adresi ve başlangıç tarihi gerekli.");
  }

  const minTs = new Date(`${syncFrom}T00:00:00Z`).getTime();
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = process.env.TRONGRID_API_KEY?.trim();
  if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;

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
  let totalIn = 0;
  let totalOut = 0;
  let fingerprint: string | undefined;
  let pagesFetched = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(
      `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`
    );
    url.searchParams.set("limit", "200");
    url.searchParams.set("only_confirmed", "true");
    url.searchParams.set("contract_address", USDT_TRC20);
    url.searchParams.set("min_timestamp", String(minTs));
    if (fingerprint) url.searchParams.set("fingerprint", fingerprint);

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      throw new Error(`TronGrid HTTP ${res.status}`);
    }

    const json = (await res.json()) as {
      data?: TronTrc20Tx[];
      meta?: { fingerprint?: string; links?: { next?: string } };
    };
    const txs = json.data ?? [];
    pagesFetched++;

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
      const rounded = Math.round(amount * 100) / 100;
      if (direction === "in") totalIn += rounded;
      else totalOut += rounded;

      const iso = new Date(tx.block_timestamp).toISOString().slice(0, 16);

      rows.push({
        id: stableTxId(tx.transaction_id),
        kasa_id: kasa.id,
        date: iso,
        direction,
        amount_usd: rounded,
        fee_usd: 0,
        purpose:
          direction === "in"
            ? "TRON USDT giriş (otomatik)"
            : "TRON USDT çıkış (otomatik)",
        counterparty: direction === "in" ? tx.from : tx.to,
        proof: tx.transaction_id,
        notes: "TronGrid — açıklama ve kategori sonradan düzenlenebilir",
        tron_tx_id: tx.transaction_id,
        auto_imported: true,
      });
      seen.add(tx.transaction_id);
    }

    fingerprint = json.meta?.fingerprint;
    if (!fingerprint || txs.length === 0) break;
  }

  if (rows.length > 0) {
    const { error } = await db
      .from("kasa_transactions")
      .upsert(rows, { onConflict: "tron_tx_id", ignoreDuplicates: false });
    if (error) {
      const { error: err2 } = await db.from("kasa_transactions").insert(rows);
      if (err2) throw new Error(err2.message);
    }
  }

  const { data: allTx } = await db
    .from("kasa_transactions")
    .select("*")
    .eq("kasa_id", kasa.id);
  const txList = (allTx ?? []).map((r) =>
    kasaFromRow(r as Record<string, unknown>)
  );

  const balanceUsd = calcKasaBalance(txList, undefined, kasa.id);

  return {
    imported: rows.length,
    skipped,
    totalIn: Math.round(totalIn * 100) / 100,
    totalOut: Math.round(totalOut * 100) / 100,
    balanceUsd,
    pagesFetched,
  };
}

/** İsteğe bağlı: kasanın takip başlangıç tarihini güncelle (geçmişe dönük çekim). */
export async function updateKasaTronSyncFrom(
  kasaId: string,
  syncFrom: string
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("kasas")
    .update({ tron_sync_from: syncFrom })
    .eq("id", kasaId);
  if (error) throw new Error(error.message);
}
