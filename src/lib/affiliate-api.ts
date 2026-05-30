/**
 * Affiliate (partner / günlük istatistik / ödeme) — istemci fetch yardımcıları.
 *
 * `streamer-pool-api.ts` desenini izler: `credentials: "include"`,
 * `cache: "no-store"`, JSON hata çıkarımı ile `ApiError` fırlatır.
 * Backend henüz hazır değilse (404/500/503) UI `isPoolNotReadyError` ile
 * yakalayıp "Sistem hazırlanıyor" banner'ı gösterir.
 */

import { ApiError } from "@/lib/streamer-pool-api";
import type {
  AffiliateDailyStat,
  AffiliatePartner,
  AffiliatePayout,
} from "@/store/store";

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(init?.body && typeof init.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    let msg = `Sunucu hatası (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) msg = data.error;
    } catch {
      /* json parse opsiyonel */
    }
    throw new ApiError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function buildQuery(filters: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// ─── Partnerler ───────────────────────────────────────────────────────────────

export async function fetchAffiliatePartners(
  brandId?: string
): Promise<AffiliatePartner[]> {
  const data = await jsonFetch<{ partners?: AffiliatePartner[] }>(
    `/api/affiliate/partners${buildQuery({ brandId })}`
  );
  return Array.isArray(data.partners) ? data.partners : [];
}

export async function createAffiliatePartner(
  body: Partial<AffiliatePartner>
): Promise<AffiliatePartner> {
  const data = await jsonFetch<{ partner: AffiliatePartner }>(
    `/api/affiliate/partners`,
    { method: "POST", body: JSON.stringify(body) }
  );
  return data.partner;
}

export async function updateAffiliatePartner(
  id: string,
  body: Partial<AffiliatePartner>
): Promise<AffiliatePartner> {
  const data = await jsonFetch<{ partner: AffiliatePartner }>(
    `/api/affiliate/partners/${id}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
  return data.partner;
}

export async function deleteAffiliatePartner(id: string): Promise<void> {
  await jsonFetch<{ ok: true }>(`/api/affiliate/partners/${id}`, {
    method: "DELETE",
  });
}

// ─── Günlük istatistik ──────────────────────────────────────────────────────

export async function fetchAffiliateStats(filters: {
  brandId?: string;
  partnerId?: string;
  from?: string;
  to?: string;
}): Promise<AffiliateDailyStat[]> {
  const data = await jsonFetch<{ stats?: AffiliateDailyStat[] }>(
    `/api/affiliate/stats${buildQuery(filters)}`
  );
  return Array.isArray(data.stats) ? data.stats : [];
}

export interface BulkUpsertStatsResult {
  ok: boolean;
  count: number;
  errors: { index: number; reason: string }[];
}

export async function bulkUpsertAffiliateStats(
  rows: Partial<AffiliateDailyStat>[]
): Promise<BulkUpsertStatsResult> {
  const data = await jsonFetch<Partial<BulkUpsertStatsResult>>(
    `/api/affiliate/stats`,
    { method: "POST", body: JSON.stringify({ rows }) }
  );
  return {
    ok: data.ok ?? false,
    count: data.count ?? 0,
    errors: Array.isArray(data.errors) ? data.errors : [],
  };
}

export interface CsvImportResult {
  ok?: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: { line: number; reason: string }[];
}

/** CSV içe aktarım — `file` (Blob) ya da düz `csv` metni kabul eder. */
export async function importAffiliateCsv(
  brandId: string | undefined,
  source: File | Blob | string
): Promise<CsvImportResult> {
  const url = `/api/affiliate/stats/import-csv${buildQuery({ brandId })}`;
  let res: Response;
  if (typeof source === "string") {
    res = await fetch(url, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: source }),
    });
  } else {
    const form = new FormData();
    form.append("file", source);
    res = await fetch(url, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      body: form,
    });
  }
  const data = (await res.json().catch(() => null)) as
    | (Partial<CsvImportResult> & { error?: string })
    | null;
  if (!res.ok) {
    throw new ApiError(data?.error ?? `Sunucu hatası (${res.status})`, res.status);
  }
  return {
    ok: data?.ok,
    inserted: data?.inserted ?? 0,
    updated: data?.updated ?? 0,
    skipped: data?.skipped ?? 0,
    errors: Array.isArray(data?.errors) ? data.errors : [],
  };
}

/** CSV şablonu — başlık satırı + bir örnek satır. */
export function affiliateCsvTemplate(): string {
  const header =
    "partner_external_ref,date,clicks,registrations,ftd_count,ftd_amount,deposit,withdrawal,currency";
  const today = new Date().toISOString().slice(0, 10);
  const example = `AFF123,${today},1200,85,12,2400,5200,800,USD`;
  return `${header}\n${example}`;
}

// ─── Ödemeler ─────────────────────────────────────────────────────────────────

export async function fetchAffiliatePayouts(
  brandId?: string
): Promise<AffiliatePayout[]> {
  const data = await jsonFetch<{ payouts?: AffiliatePayout[] }>(
    `/api/affiliate/payouts${buildQuery({ brandId })}`
  );
  return Array.isArray(data.payouts) ? data.payouts : [];
}

export async function createAffiliatePayout(
  body: Partial<AffiliatePayout>
): Promise<AffiliatePayout> {
  const data = await jsonFetch<{ payout: AffiliatePayout }>(
    `/api/affiliate/payouts`,
    { method: "POST", body: JSON.stringify(body) }
  );
  return data.payout;
}

export async function updateAffiliatePayout(
  id: string,
  body: Partial<AffiliatePayout>
): Promise<AffiliatePayout> {
  const data = await jsonFetch<{ payout: AffiliatePayout }>(
    `/api/affiliate/payouts/${id}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
  return data.payout;
}

export async function deleteAffiliatePayout(id: string): Promise<void> {
  await jsonFetch<{ ok: true }>(`/api/affiliate/payouts/${id}`, {
    method: "DELETE",
  });
}
