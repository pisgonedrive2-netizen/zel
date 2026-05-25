import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { TronNewTx } from "@/lib/tron-sync";

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

export interface TronWatchConfig {
  address: string;
  syncFrom: string;
  label: string;
}

export interface TronWatchResult {
  address: string;
  newCount: number;
  newIn: number;
  newOut: number;
  skipped: number;
  newTxs: TronNewTx[];
  pagesFetched: number;
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

/** İzlenen cüzdan — iş kasasından ayrı (TRON_WATCH_ADDRESS öncelikli). */
export function getTronWatchConfig(): TronWatchConfig | null {
  const address = normalizeTronAddr(
    process.env.TRON_WATCH_ADDRESS?.trim() ||
      process.env.TRON_KASA_ADDRESS?.trim() ||
      ""
  );
  if (!address) return null;
  const syncFrom =
    process.env.TRON_WATCH_FROM?.trim() ||
    process.env.TRON_SYNC_FROM?.trim() ||
    DEFAULT_SYNC_FROM;
  const label =
    process.env.TRON_WATCH_LABEL?.trim() || "TRON cüzdan";
  return { address, syncFrom, label };
}

type FetchPass = "outgoing" | "incoming";

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
  if (opts.pass === "outgoing") url.searchParams.set("only_from", "true");
  else url.searchParams.set("only_to", "true");
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

/**
 * Cüzdanı izler; kasa_transactions'a yazmaz — yalnızca yeni işlemleri döner.
 */
export async function watchTronWallet(opts?: {
  recentDays?: number;
}): Promise<TronWatchResult> {
  const cfg = getTronWatchConfig();
  if (!cfg) {
    throw new Error(
      "TRON_WATCH_ADDRESS tanımlı değil — Vercel ortam değişkenine izlenecek cüzdan adresini ekleyin."
    );
  }

  const recentDays = opts?.recentDays ?? 3;
  const syncFromTs = new Date(`${cfg.syncFrom}T00:00:00Z`).getTime();
  const minTs = Math.max(
    syncFromTs,
    Date.now() - recentDays * 24 * 3_600_000
  );

  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = process.env.TRONGRID_API_KEY?.trim();
  if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;

  const db = getSupabaseAdmin();
  const { data: existing } = await db
    .from("tron_watch_seen")
    .select("tron_tx_id");
  const seen = new Set(
    (existing ?? []).map((r) => String((r as { tron_tx_id: string }).tron_tx_id))
  );

  const collected = new Map<string, TronTrc20Tx>();
  let pagesFetched = 0;

  for (const pass of ["outgoing", "incoming"] as FetchPass[]) {
    let fingerprint: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const { txs, fingerprint: nextFp } = await fetchTrc20Page({
        address: cfg.address,
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

  const newTxs: TronNewTx[] = [];
  const seenRows: Record<string, unknown>[] = [];
  let skipped = 0;
  let newIn = 0;
  let newOut = 0;

  for (const tx of collected.values()) {
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

    const toMe = addrsEqual(tx.to ?? "", cfg.address);
    const fromMe = addrsEqual(tx.from ?? "", cfg.address);
    if (!toMe && !fromMe) {
      skipped++;
      continue;
    }

    const direction = toMe ? ("in" as const) : ("out" as const);
    const rounded = Math.round(amount * 100) / 100;
    const txAt = new Date(tx.block_timestamp).toISOString();

    if (direction === "in") newIn++;
    else newOut++;

    newTxs.push({
      tronTxId: tx.transaction_id,
      direction,
      amountUsd: rounded,
      date: txAt,
      counterparty: direction === "in" ? tx.from : tx.to,
    });

    seenRows.push({
      tron_tx_id: tx.transaction_id,
      direction,
      amount_usd: rounded,
      tx_at: txAt,
      wallet_address: cfg.address,
    });
    seen.add(tx.transaction_id);
  }

  if (seenRows.length > 0) {
    const { error } = await db
      .from("tron_watch_seen")
      .upsert(seenRows, { onConflict: "tron_tx_id", ignoreDuplicates: true });
    if (error && !error.message.includes("does not exist")) {
      throw new Error(error.message);
    }
  }

  return {
    address: cfg.address,
    newCount: newTxs.length,
    newIn,
    newOut,
    skipped,
    newTxs,
    pagesFetched,
  };
}
