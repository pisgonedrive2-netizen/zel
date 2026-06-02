import type { WeekBrandReel } from "@/store/store";

export type AchievementSyncSummary = {
  attempted: number;
  synced: number;
  skipped: number;
  failed: number;
  errors: string[];
};

export type AchievementSyncResponse = {
  ok: boolean;
  reels?: WeekBrandReel[];
  summary?: AchievementSyncSummary;
  error?: string;
};

/** Marka linklerinden (içerik URL + API) achievement / week_brand_reels senkronu. */
export async function syncAchievementFromBrandLinks(
  employeeId?: string
): Promise<AchievementSyncResponse> {
  const qs = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : "";
  const res = await fetch(`/api/streamer/sync-achievement-from-links${qs}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as AchievementSyncResponse;
  if (!res.ok) {
    throw new Error(json.error ?? `Senkron hatası (${res.status})`);
  }
  return json;
}
