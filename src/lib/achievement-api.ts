import type { ActivityDayItem } from "@/lib/streamer-activity-dates";
import type { BrandLink, LinkSnapshot, WeekBrandReel } from "@/store/store";
import { useStore } from "@/store/store";
import { allowsPersonalAccountSync } from "@/lib/active-streamers";

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
  if (!allowsPersonalAccountSync(account.employeeId)) return null;
  if (account.status !== "active") return null;
  if (!ACHIEVEMENT_SYNC_PLATFORMS.test(account.platform)) return null;
  return syncStreamerAchievementFromAccounts(account.employeeId);
}

export function mergeAchievementReelsIntoStore(reels: WeekBrandReel[], _employeeId?: string) {
  if (reels.length === 0) return;
  useStore.setState((s) => {
    const byId = new Map(s.weekBrandReels.map((r) => [r.id, r]));
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

export type AssignAchievementBrandResponse = {
  ok: boolean;
  assigned: number;
  created: number;
  reused: number;
  refreshed: number;
  links: BrandLink[];
  snapshots: LinkSnapshot[];
  reelPatches: { id: string; brandId: string; brandLinkId: string; views?: number | null }[];
  errors: string[];
  error?: string;
};

export async function assignAchievementItemsToBrand(opts: {
  employeeId: string;
  brandId: string;
  date: string;
  items: { id: string; url: string; platform?: string }[];
}): Promise<AssignAchievementBrandResponse> {
  const res = await fetch("/api/streamer/assign-achievement-brand", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const json = (await res.json()) as AssignAchievementBrandResponse;
  if (!res.ok) throw new Error(json.error ?? `Atama hatası (${res.status})`);
  return json;
}

export function mergeAssignedAchievementIntoStore(result: AssignAchievementBrandResponse) {
  const links = result.links ?? [];
  const snapshots = result.snapshots ?? [];
  const reelPatches = result.reelPatches ?? [];
  if (!links.length && !reelPatches.length) return;
  useStore.setState((s) => {
    const linksById = new Map(s.brandLinks.map((l) => [l.id, l]));
    for (const link of links) {
      linksById.set(link.id, { ...linksById.get(link.id), ...link });
    }
    const snapsById = new Map(s.linkSnapshots.map((sn) => [sn.id, sn]));
    for (const sn of snapshots) {
      snapsById.set(sn.id, { ...snapsById.get(sn.id), ...sn });
    }
    const patchById = new Map(reelPatches.map((p) => [p.id, p]));
    const weekBrandReels = s.weekBrandReels.map((r) => {
      const patch = patchById.get(r.id);
      if (!patch) return r;
      return {
        ...r,
        brandId: patch.brandId,
        brandLinkId: patch.brandLinkId,
        lastViews: patch.views ?? r.lastViews,
      };
    });
    return {
      brandLinks: [...linksById.values()],
      linkSnapshots: [...snapsById.values()],
      weekBrandReels,
    };
  });
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
