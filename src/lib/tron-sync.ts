import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { kasaFromRow } from "@/lib/db/mappers";
import {
  TRON_BACKGROUND_RECENT_DAYS,
  TRON_PAGES_FULL,
  TRON_PAGES_INCREMENTAL,
  TRON_REQUEST_GAP_MS,
} from "@/lib/tron-grid-config";
import { calcKasaBalance, type Kasa, type KasaTransaction } from "@/store/store";

const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const DEFAULT_SYNC_FROM = "2025-04-01";

type TronTrc20Tx = {
  transaction_id: string;
  block_timestamp: number;
  from: string;
  to: string;
  value: string;
  token_info?: { symbol?: string; decimals?: number };
};

export type TronNewTx = {
  tronTxId: string;
  direction: KasaTransaction["direction"];
  amountUsd: number;
  date: string;
  counterparty?: string;
};

export interface TronSyncResult {
  imported: number;
  importedIn: number;
  importedOut: number;
  skipped: number;
  totalIn: number;
  totalOut: number;
  balanceUsd: number;
  pagesFetched: number;
  outgoingFound: number;
  newTxs: TronNewTx[];
  /** Bazı sayfalar kota/limit nedeniyle atlandı — tarihi daha yakın bir günden tekrar deneyin. */
  truncated?: boolean;
  minTimestampUsed?: number;
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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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

  const retries = 4;
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt <= retries; attempt++) {
    await sleep(TRON_REQUEST_GAP_MS);
    const res = await fetch(url.toString(), {
      headers: opts.headers,
      signal: AbortSignal.timeout(25_000),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        data?: TronTrc20Tx[];
        meta?: { fingerprint?: string };
      };
      return { txs: json.data ?? [], fingerprint: json.meta?.fingerprint };
    }

    lastStatus = res.status;
    lastBody = (await res.text().catch(() => "")) || res.statusText;

    if ((res.status === 429 || res.status === 503) && attempt < retries) {
      const wait = Math.min(2000 * (attempt + 1), 8000);
      await sleep(wait);
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `TronGrid yetkilendirme hatası (${res.status}). TRONGRID_API_KEY kontrol edin.`
      );
    }
    throw new Error(
      `TronGrid HTTP ${lastStatus}${lastBody ? `: ${lastBody.slice(0, 160)}` : ""}`
    );
  }

  throw new Error(
    `TronGrid HTTP ${lastStatus}${lastBody ? `: ${lastBody.slice(0, 160)}` : ""}`
  );
}

async function getLastImportedTxMs(kasaId: string): Promise<number | null> {
  const { data } = await getSupabaseAdmin()
    .from("kasa_transactions")
    .select("date")
    .eq("kasa_id", kasaId)
    .not("tron_tx_id", "is", null)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.date) return null;
  const t = new Date(String(data.date)).getTime();
  return Number.isFinite(t) ? t : null;
}

function resolveMinTimestamp(opts: {
  syncFrom: string;
  recentDays?: number;
  lastImportedMs: number | null;
}): number {
  const syncFromTs = new Date(`${opts.syncFrom}T00:00:00Z`).getTime();
  const recentDays = opts.recentDays ?? 0;
  const recentFloor =
    recentDays > 0
      ? Date.now() - recentDays * 24 * 3_600_000
      : syncFromTs;

  if (recentDays > 0 || opts.lastImportedMs) {
    const overlapMs = 12 * 3_600_000;
    const incrementalFloor = opts.lastImportedMs
      ? opts.lastImportedMs - overlapMs
      : recentFloor;
    return Math.max(syncFromTs, recentFloor, incrementalFloor);
  }

  return syncFromTs;
}

async function collectTrc20Transfers(opts: {
  address: string;
  minTs: number;
  headers: Record<string, string>;
  maxPagesPerPass: number;
}): Promise<{ txs: Map<string, TronTrc20Tx>; pagesFetched: number; truncated: boolean }> {
  const collected = new Map<string, TronTrc20Tx>();
  let pagesFetched = 0;
  let truncated = false;

  const passes: FetchPass[] = ["outgoing", "incoming"];

  for (const pass of passes) {
    let fingerprint: string | undefined;
    for (let page = 0; page < opts.maxPagesPerPass; page++) {
      const { txs, fingerprint: nextFp } = await fetchTrc20Page({
        address: opts.address,
        minTs: opts.minTs,
        fingerprint,
        pass,
        headers: opts.headers,
      });
      pagesFetched++;
      for (const tx of txs) {
        if (tx.transaction_id) collected.set(tx.transaction_id, tx);
      }
      fingerprint = nextFp;
      if (!fingerprint || txs.length === 0) break;
      if (page === opts.maxPagesPerPass - 1 && fingerprint) {
        truncated = true;
      }
    }
  }

  return { txs: collected, pagesFetched, truncated };
}

/** TronGrid TRC20 transferlerini kasa hareketlerine dönüştürür. */
export async function syncTronTransfersForKasa(
  kasa: Kasa,
  opts?: { syncFrom?: string; recentDays?: number }
): Promise<TronSyncResult> {
  const configured = await ensureTronKasaConfigured(kasa);
  const address = normalizeTronAddr(configured.tronAddress ?? "");
  const syncFrom =
    opts?.syncFrom?.trim() || configured.tronSyncFrom?.trim() || DEFAULT_SYNC_FROM;
  if (!address) {
    throw new Error(
      "TRON adresi gerekli — kasa ayarlarından veya TRON_KASA_ADDRESS ortam değişkeninden."
    );
  }

  const lastImportedMs = await getLastImportedTxMs(kasa.id);
  /** Yalnızca recentDays verilmediğinde tam tarih aralığı (tarihten itibaren çek). */
  const isFullFromDate = opts?.recentDays == null;
  const effectiveRecentDays = isFullFromDate
    ? 0
    : (opts.recentDays ?? TRON_BACKGROUND_RECENT_DAYS);

  const minTs = resolveMinTimestamp({
    syncFrom,
    recentDays: effectiveRecentDays,
    lastImportedMs,
  });

  const maxPagesPerPass = isFullFromDate ? TRON_PAGES_FULL : TRON_PAGES_INCREMENTAL;

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

  const { txs: collected, pagesFetched, truncated } = await collectTrc20Transfers({
    address,
    minTs,
    headers,
    maxPagesPerPass,
  });

  const rows: Record<string, unknown>[] = [];
  const newTxs: TronNewTx[] = [];
  let skipped = 0;
  let importedIn = 0;
  let importedOut = 0;
  let totalIn = 0;
  let totalOut = 0;
  let outgoingFound = 0;

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
    if (direction === "out") {
      outgoingFound++;
      importedOut++;
    } else {
      importedIn++;
    }
    const rounded = Math.round(amount * 100) / 100;
    if (direction === "in") totalIn += rounded;
    else totalOut += rounded;

    const iso = new Date(tx.block_timestamp).toISOString().slice(0, 16);
    const counterparty = direction === "in" ? tx.from : tx.to;
    newTxs.push({
      tronTxId: tx.transaction_id,
      direction,
      amountUsd: rounded,
      date: iso,
      counterparty,
    });
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
      counterparty,
      proof: tx.transaction_id,
      notes: "TronGrid — açıklama ve kategori sonradan düzenlenebilir",
      tron_tx_id: tx.transaction_id,
      auto_imported: true,
    });
    seen.add(tx.transaction_id);
    globalSeen.add(tx.transaction_id);
  }

  if (rows.length > 0) {
    const { error } = await db.from("kasa_transactions").insert(rows);
    if (error) {
      if (!error.message.includes("duplicate") && !error.message.includes("unique")) {
        throw new Error(`Kasa hareketi kaydı: ${error.message}`);
      }
      for (const row of rows) {
        const { error: oneErr } = await db.from("kasa_transactions").insert(row);
        if (
          oneErr &&
          !oneErr.message.includes("duplicate") &&
          !oneErr.message.includes("unique")
        ) {
          throw new Error(oneErr.message);
        }
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
    importedIn,
    importedOut,
    skipped,
    totalIn: Math.round(totalIn * 100) / 100,
    totalOut: Math.round(totalOut * 100) / 100,
    balanceUsd,
    pagesFetched,
    outgoingFound,
    newTxs,
    truncated: truncated || undefined,
    minTimestampUsed: minTs,
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
