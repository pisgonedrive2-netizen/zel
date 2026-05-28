/**
 * Yayıncı Havuzu + Teklif + Anlaşma + Post — istemci fetch yardımcıları
 * (B2B Faz G & H).
 *
 * Tüm yardımcılar `credentials: "include"` ve `cache: "no-store"` kullanır;
 * hatada `ApiError` fırlatır. Backend henüz dağıtmadıysa 404/500/503 alırız —
 * UI bunu `isPoolNotReadyError` ile yakalayıp "Sistem hazırlanıyor" banner'ı
 * gösterir.
 */

import type {
  BrandDeal,
  BrandOffer,
  BrandOfferMessage,
  BrandPost,
  StreamerPoolProfile,
} from "@/store/store";
import type {
  BrandDealUpdateBody,
  CreateBrandPostBody,
  UpdateBrandPostBody,
} from "@/types/brand-deals";
import type {
  BrandOfferDetailResponse,
  BrandOfferMessageBody,
  BrandOfferRespondBody,
  CreateBrandOfferBody,
  StreamerPoolFilters,
  StreamerPoolProfileUpsertBody,
} from "@/types/streamer-pool";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

/** Backend henüz hazır değil mi? (tablo yok / route yok / 503) */
export function isPoolNotReadyError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return err.status === 404 || err.status === 500 || err.status === 503;
}

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
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

// ─── Streamer Pool ────────────────────────────────────────────────────────────

export async function fetchStreamerPool(
  filters: StreamerPoolFilters = {}
): Promise<StreamerPoolProfile[]> {
  const qs = buildQuery({
    status: filters.status ?? "published",
    search: filters.search,
    category: filters.category,
    language: filters.language,
    country: filters.country,
    minRate: filters.minRate,
    maxRate: filters.maxRate,
    minFollowers: filters.minFollowers,
    maxFollowers: filters.maxFollowers,
  });
  const data = await jsonFetch<{ profiles?: StreamerPoolProfile[] }>(
    `/api/streamer-pool${qs}`
  );
  return Array.isArray(data.profiles) ? data.profiles : [];
}

export async function fetchMyPoolProfile(): Promise<StreamerPoolProfile | null> {
  try {
    const data = await jsonFetch<{ profile?: StreamerPoolProfile | null }>(
      `/api/streamer-pool/me`
    );
    return data.profile ?? null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function upsertMyPoolProfile(
  body: StreamerPoolProfileUpsertBody
): Promise<StreamerPoolProfile> {
  const data = await jsonFetch<{ profile: StreamerPoolProfile }>(
    `/api/streamer-pool/me`,
    { method: "PUT", body: JSON.stringify(body) }
  );
  return data.profile;
}

// ─── Offers ──────────────────────────────────────────────────────────────────

export async function fetchOffers(opts: {
  role: "brand" | "streamer";
  status?: string;
}): Promise<BrandOffer[]> {
  const qs = buildQuery({ role: opts.role, status: opts.status });
  const data = await jsonFetch<{ offers?: BrandOffer[] }>(`/api/brand-offers${qs}`);
  return Array.isArray(data.offers) ? data.offers : [];
}

export async function fetchOfferDetail(
  id: string
): Promise<BrandOfferDetailResponse> {
  const data = await jsonFetch<BrandOfferDetailResponse>(`/api/brand-offers/${id}`);
  return {
    offer: data.offer,
    messages: Array.isArray(data.messages) ? data.messages : [],
  };
}

export async function createOffer(body: CreateBrandOfferBody): Promise<BrandOffer> {
  const data = await jsonFetch<{ offer: BrandOffer }>(`/api/brand-offers`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.offer;
}

export async function respondToOffer(
  id: string,
  body: BrandOfferRespondBody
): Promise<{ offer: BrandOffer; deal?: BrandDeal | null }> {
  return jsonFetch(`/api/brand-offers/${id}/respond`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postOfferMessage(
  id: string,
  body: BrandOfferMessageBody
): Promise<BrandOfferMessage> {
  const data = await jsonFetch<{ message: BrandOfferMessage }>(
    `/api/brand-offers/${id}/messages`,
    { method: "POST", body: JSON.stringify(body) }
  );
  return data.message;
}

export async function withdrawOffer(id: string): Promise<BrandOffer> {
  const data = await jsonFetch<{ offer: BrandOffer }>(
    `/api/brand-offers/${id}/withdraw`,
    { method: "POST", body: JSON.stringify({}) }
  );
  return data.offer;
}

// ─── Deals ───────────────────────────────────────────────────────────────────

export async function fetchDeals(filters: {
  brandId?: string;
  employeeId?: string;
  status?: string;
}): Promise<BrandDeal[]> {
  const qs = buildQuery(filters);
  const data = await jsonFetch<{ deals?: BrandDeal[] }>(`/api/brand-deals${qs}`);
  return Array.isArray(data.deals) ? data.deals : [];
}

export async function fetchDealDetail(id: string): Promise<BrandDeal> {
  const data = await jsonFetch<{ deal: BrandDeal }>(`/api/brand-deals/${id}`);
  return data.deal;
}

export async function updateDeal(
  id: string,
  body: BrandDealUpdateBody
): Promise<BrandDeal> {
  const data = await jsonFetch<{ deal: BrandDeal }>(`/api/brand-deals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return data.deal;
}

// ─── Posts ───────────────────────────────────────────────────────────────────

export async function fetchPosts(filters: {
  brandId?: string;
  dealId?: string;
  employeeId?: string;
}): Promise<BrandPost[]> {
  const qs = buildQuery(filters);
  const data = await jsonFetch<{ posts?: BrandPost[] }>(`/api/brand-posts${qs}`);
  return Array.isArray(data.posts) ? data.posts : [];
}

export async function createPost(body: CreateBrandPostBody): Promise<BrandPost> {
  const data = await jsonFetch<{ post: BrandPost }>(`/api/brand-posts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.post;
}

export async function updatePost(
  id: string,
  body: UpdateBrandPostBody
): Promise<BrandPost> {
  const data = await jsonFetch<{ post: BrandPost }>(`/api/brand-posts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return data.post;
}

export async function deletePost(id: string): Promise<void> {
  await jsonFetch<void>(`/api/brand-posts/${id}`, { method: "DELETE" });
}

export async function refreshPostMetrics(id: string): Promise<BrandPost> {
  const data = await jsonFetch<{ post: BrandPost }>(
    `/api/brand-posts/${id}/refresh-metrics`,
    { method: "POST", body: JSON.stringify({}) }
  );
  return data.post;
}
