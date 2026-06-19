import type { ActivityDayItem } from "@/lib/streamer-activity-dates";
import type { WeekBrandReel } from "@/store/store";
import { useStore } from "@/store/store";

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
  rapidApiEnabled?: boolean;
  accountsReady?: number;
  error?: string;
  warning?: string;
};

export type AchievementDayResponse = {
  ok: boolean;
  date: string;
  items: ActivityDayItem[];
  error?: string;
};

export async function syncStreamerAchievementFromAccounts(
  employeeId: string
): Promise<AchievementSyncResponse> {
  const params = new URLSearchParams({ employeeId });
  const res = await fetch(`/api/streamer/sync-achievement-from-accounts?${params}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as AchievementSyncResponse;
  if (!res.ok) throw new Error(json.error ?? `Senkron hatası (${res.status})`);
  return json;
}

const ACHIEVEMENT_SYNC_PLATFORMS = /youtube|instagram|tiktok/i;

/** Hesap eklendi/güncellendiğinde kişisel içerikleri takvime yaz. */
export async function syncAchievementAfterAccountSave(
  account: { employeeId: string; platform: string; status: string },
): Promise<AchievementSyncResponse | null> {
  if (account.status !== "active") return null;
  if (!ACHIEVEMENT_SYNC_PLATFORMS.test(account.platform)) return null;
  return syncStreamerAchievementFromAccounts(account.employeeId);
}

export function mergeAchievementReelsIntoStore(reels: WeekBrandReel[], employeeId: string) {
  useStore.setState((s) => {
    const others = s.weekBrandReels.filter((r) => r.employeeId !== employeeId);
    const byId = new Map(others.map((r) => [r.id, r]));
    for (const r of reels) byId.set(r.id, r);
    return { weekBrandReels: [...byId.values()] };
  });
}

export async function syncMarkaAchievementFromAccounts(
  brandId: string,
  employeeId?: string
): Promise<AchievementSyncResponse> {
  const params = new URLSearchParams({ brandId });
  if (employeeId) params.set("employeeId", employeeId);
  const res = await fetch(`/api/marka/sync-achievement-from-accounts?${params}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as AchievementSyncResponse;
  if (!res.ok) throw new Error(json.error ?? `Senkron hatası (${res.status})`);
  return json;
}

export async function fetchStreamerAchievementDay(
  employeeId: string,
  date: string
): Promise<AchievementDayResponse> {
  const params = new URLSearchParams({ employeeId, date });
  const res = await fetch(`/api/streamer/achievement-day?${params}`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as AchievementDayResponse;
  if (!res.ok) throw new Error(json.error ?? `Yüklenemedi (${res.status})`);
  return json;
}

export async function fetchMarkaAchievementDay(
  brandId: string,
  date: string,
  employeeId?: string | "all"
): Promise<AchievementDayResponse> {
  const params = new URLSearchParams({ brandId, date });
  if (employeeId && employeeId !== "all") params.set("employeeId", employeeId);
  const res = await fetch(`/api/marka/achievement-day?${params}`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as AchievementDayResponse;
  if (!res.ok) throw new Error(json.error ?? `Yüklenemedi (${res.status})`);
  return json;
}
