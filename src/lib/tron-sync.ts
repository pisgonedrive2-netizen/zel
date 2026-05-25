import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { kasaFromRow } from "@/lib/db/mappers";
import { calcKasaBalance, type Kasa, type KasaTransaction } from "@/store/store";

const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const MAX_PAGES = 40;
const DEFAULT_SYNC_FROM = "2025-04-01";

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
  outgoingFound: number;
}

function stableTxId(tronTxId: string): string {
  const safe = tronTxId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  return `kt-tron-${safe}`;
}

function normalizeTronAddr(addr: string): string {
  return addr.trim();
}

function addrsEqual(a: string, b: string): boolean {
  const x = normalizeTronAddr(a);
  const y = normalizeTronAddr(b);
  if (x === y) return true;
  return x.toLowerCase() === y.toLowerCase();
}

/** Kasa kaydında TRON adresi yoksa ortam değişkeninden yazar. */
export async function ensureTronKasaConfigured(kasa: Kasa): Promise<Kasa> {
  const envAddr = process.env.TRON_KASA_ADDRESS?.trim();
  const envFrom = process.env.TRON_SYNC_FROM?.trim() || DEFAULT_SYNC_FROM;
  const updates: Record<string, unknown> = {};
  if (!kasa.tronAddress?.trim() && envAddr) updates.tron_address = envAddr;
  if (!kasa.tronSyncFrom?.trim()) updates.tron_sync_from = envFrom;
  if (Object.keys(updates).length === 0) return kasa;
  const db = getSupabaseAdmin();
  const { error } = await db.from("kasas").update(updates).eq("id", kasa.id);
  if (error) throw new Error(error.message);
  return {
    ...kasa,
    tronAddress: (updates.tron_address as string) ?? kasa.tronAddress,
    tronSyncFrom: (updates.tron_sync_from as string) ?? kasa.tronSyncFrom,
  };
}

type FetchPass = "all" | "outgoing" | "incoming";

async function fetchTrc20Page(opts: {
  address: string;
  minTs: number;
  fingerprint?: string;
  pass: FetchPass;
  headers: Record<string, string>;
}): Promise<{ txs: TronTrc20Tx[]; fingerprint?: string }> {
  const url = new URL(
    `https://api.trongrid.io/v1/accounts/${opts.address}/transactions/trc20`
  );
  url.searchParams.set("limit", "200");
  url.searchParams.set("only_confirmed", "true");
  url.searchParams.set("contract_address", USDT_TRC20);
  url.searchParams.set("min_timestamp", String(opts.minTs));
  url.searchParams.set("order_by", "block_timestamp,desc");
  if (opts.pass === "outgoing") {
    url.searchParams.set("only_from", "true");
  } else if (opts.pass === "incoming") {
    url.searchParams.set("only_to", "true");
  }
  if (opts.fingerprint) url.searchParams.set("fingerprint", opts.fingerprint);

  const res = await fetch(url.toString(), { headers: opts.headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TronGrid HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`);
  }
  const json = (await res.json()) as {
    data?: TronTrc20Tx[];
    meta?: { fingerprint?: string };
  };
  return { txs: json.data ?? [], fingerprint: json.meta?.fingerprint };
}

/** TronGrid TRC20 transferlerini kasa hareketlerine dönüştürür. Gelen ve giden ayrı pass ile çekilir. */
export async function syncTronTransfersForKasa(
  kasa: Kasa,
  opts?: { syncFrom?: string; recentDays?: number }
): Promise<TronSyncResult> {
  const configured = await ensureTronKasaConfigured(kasa);
  const address = normalizeTronAddr(configured.tronAddress ?? "");
  const syncFrom =
    opts?.syncFrom?.trim() || configured.tronSyncFrom?.trim() || DEFAULT_SYNC_FROM;
  if (!address) {
    throw new Error("TRON adresi gerekli — kasa ayarlarından veya TRON_KASA_ADDRESS ortam değişkeninden.");
  }

  const syncFromTs = new Date(`${syncFrom}T00:00:00Z`).getTime();
  const recentDays = opts?.recentDays ?? 0;
  const minTs =
    recentDays > 0
      ? Math.max(syncFromTs, Date.now() - recentDays * 24 * 3_600_000)
      : syncFromTs;

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

  const { data: globalDup } = await db
    .from("kasa_transactions")
    .select("tron_tx_id")
    .not("tron_tx_id", "is", null);
  const globalSeen = new Set(
    (globalDup ?? []).map((r) => String((r as { tron_tx_id: string }).tron_tx_id))
  );

  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  let totalIn = 0;
  let totalOut = 0;
  let outgoingFound = 0;
  let pagesFetched = 0;
  const collected = new Map<string, TronTrc20Tx>();

  const passes: FetchPass[] = ["all", "outgoing", "incoming"];

  for (const pass of passes) {
    let fingerprint: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const { txs, fingerprint: nextFp } = await fetchTrc20Page({
        address,
        minTs,
        fingerprint,
        pass,
        headers,
      });
      pagesFetched++;
      for (const tx of txs) {
        if (tx.transaction_id) collected.set(tx.transaction_id, tx);
      }
      fingerprint = nextFp;
      if (!fingerprint || txs.length === 0) break;
    }
  }

  for (const tx of collected.values()) {
    if (!tx.transaction_id || seen.has(tx.transaction_id)) {
      skipped++;
      continue;
    }
    if (globalSeen.has(tx.transaction_id)) {
      skipped++;
      continue;
    }
    const decimals = tx.token_info?.decimals ?? 6;
    const amount = Number(tx.value) / 10 ** decimals;
    if (!Number.isFinite(amount) || amount <= 0) {
      skipped++;
      continue;
    }

    const toMe = addrsEqual(tx.to ?? "", address);
    const fromMe = addrsEqual(tx.from ?? "", address);
    if (!toMe && !fromMe) {
      skipped++;
      continue;
    }

    const direction: KasaTransaction["direction"] = toMe ? "in" : "out";
    if (direction === "out") outgoingFound++;
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
    globalSeen.add(tx.transaction_id);
  }

  if (rows.length > 0) {
    const { error } = await db
      .from("kasa_transactions")
      .upsert(rows, { onConflict: "tron_tx_id", ignoreDuplicates: true });
    if (error) {
      const { error: err2 } = await db.from("kasa_transactions").insert(rows);
      if (err2 && !err2.message.includes("duplicate")) {
        throw new Error(err2.message);
      }
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
    outgoingFound,
  };
}

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
