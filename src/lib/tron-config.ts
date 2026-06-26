import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { kasaAccountFromRow } from "@/lib/db/mappers";
import { findPrimaryTronKasa } from "@/lib/kasa-tron-metrics";
import { kasaFromRow } from "@/lib/db/mappers";
import { DEFAULT_TRON_KASA_ADDRESS } from "@/lib/tron-grid-auth";
import type { Kasa } from "@/store/store";

const DEFAULT_SYNC_FROM = "2025-04-01";

function resolveEnvKasaAddress(): string {
  return (
    process.env.TRON_KASA_ADDRESS?.trim() ||
    process.env.NEXT_PUBLIC_TRON_KASA_ADDRESS?.trim() ||
    DEFAULT_TRON_KASA_ADDRESS
  );
}

export type ResolvedTronConfig = {
  /** Bildirim + izleme adresi */
  watchAddress: string | null;
  watchSyncFrom: string | null;
  watchLabel: string;
  watchSource: "env-watch" | "env-kasa" | "kasa-db" | null;
  /** Kasa senkron adresi (DB veya env) */
  kasaAddress: string | null;
  kasaSyncFrom: string | null;
  primaryKasaId: string | null;
  primaryKasaName: string | null;
};

function normalizeAddr(addr: string): string {
  return addr.trim();
}

/** Env + Supabase kasa kaydından TRON adreslerini çözümler. */
export async function resolveTronConfig(): Promise<ResolvedTronConfig> {
  const envWatch = process.env.TRON_WATCH_ADDRESS?.trim() ?? "";
  const envKasa = resolveEnvKasaAddress();
  const envSyncFrom =
    process.env.TRON_WATCH_FROM?.trim() ||
    process.env.TRON_SYNC_FROM?.trim() ||
    DEFAULT_SYNC_FROM;
  const watchLabel = process.env.TRON_WATCH_LABEL?.trim() || "TRON cüzdan";

  const db = getSupabaseAdmin();
  const { data: kasaRows } = await db
    .from("kasas")
    .select("*")
    .eq("archived", false)
    .order("order_index", { ascending: true });
  const { data: txRows } = await db.from("kasa_transactions").select("*");

  const kasas = (kasaRows ?? []).map((r) =>
    kasaAccountFromRow(r as Record<string, unknown>)
  );
  const txs = (txRows ?? []).map((r) => kasaFromRow(r as Record<string, unknown>));
  const primary = findPrimaryTronKasa(kasas, txs);

  const kasaAddress = primary?.tronAddress?.trim() || envKasa || null;
  const kasaSyncFrom = primary?.tronSyncFrom?.trim() || envSyncFrom;

  let watchAddress: string | null = null;
  let watchSource: ResolvedTronConfig["watchSource"] = null;

  if (envWatch) {
    watchAddress = normalizeAddr(envWatch);
    watchSource = "env-watch";
  } else if (envKasa) {
    watchAddress = normalizeAddr(envKasa);
    watchSource = "env-kasa";
  } else if (kasaAddress) {
    watchAddress = kasaAddress;
    watchSource = "kasa-db";
  }

  return {
    watchAddress,
    watchSyncFrom: envWatch || envKasa ? envSyncFrom : kasaSyncFrom,
    watchLabel: primary?.name?.trim() || watchLabel,
    watchSource,
    kasaAddress,
    kasaSyncFrom,
    primaryKasaId: primary?.id ?? null,
    primaryKasaName: primary?.name ?? null,
  };
}

/** İstemci kasa kaydını DB ile birleştirir (senkron öncesi). */
export async function persistKasaTronFields(
  kasaId: string,
  fields: { tronAddress?: string; tronSyncFrom?: string }
): Promise<Kasa | null> {
  const updates: Record<string, unknown> = {};
  if (fields.tronAddress?.trim()) updates.tron_address = fields.tronAddress.trim();
  if (fields.tronSyncFrom?.trim()) updates.tron_sync_from = fields.tronSyncFrom.trim();
  if (Object.keys(updates).length === 0) return null;

  const db = getSupabaseAdmin();
  const { error } = await db.from("kasas").update(updates).eq("id", kasaId);
  if (error) throw new Error(error.message);

  const { data } = await db.from("kasas").select("*").eq("id", kasaId).maybeSingle();
  if (!data) return null;
  return kasaAccountFromRow(data as Record<string, unknown>);
}
