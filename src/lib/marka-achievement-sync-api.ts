import type { WeekBrandReel } from "@/store/store";

export type MarkaAchievementSyncSummary = {
  attempted: number;
  synced: number;
  skipped: number;
  failed: number;
  localOnly?: number;
  errors: string[];
};

export type MarkaAchievementSyncResponse = {
  ok: boolean;
  reels?: WeekBrandReel[];
  summary?: MarkaAchievementSyncSummary;
  error?: string;
  warning?: string;
};

/** Markanın tüm aktif içerik linklerinden achievement / week_brand_reels senkronu. */
export async function syncMarkaAchievementFromLinks(
  brandId: string,
  employeeId?: string
): Promise<MarkaAchievementSyncResponse> {
  const params = new URLSearchParams({ brandId });
  if (employeeId) params.set("employeeId", employeeId);
  const res = await fetch(`/api/marka/sync-achievement-from-links?${params}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as MarkaAchievementSyncResponse;
  if (!res.ok) {
    throw new Error(json.error ?? `Senkron hatası (${res.status})`);
  }
  return json;
}
