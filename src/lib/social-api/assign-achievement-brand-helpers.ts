import { resolveLinkDetection } from "./platform-detect";

export type AchievementAssignItem = {
  id: string;
  url: string;
  platform?: string;
};

export function displayPlatformFromUrl(url: string, fallback?: string): string {
  const detected = resolveLinkDetection({ url, platform: fallback });
  if (detected?.platform === "youtube") return "YouTube";
  if (detected?.platform === "instagram") return "Instagram";
  if (detected?.platform === "tiktok") return "TikTok";
  const hint = (fallback ?? "").trim();
  if (hint) return hint;
  return "Diğer";
}

export function handleFromContentUrl(url: string): string {
  const detected = resolveLinkDetection({ url });
  if (detected?.externalRef?.trim()) return detected.externalRef.trim().slice(0, 80);
  try {
    const raw = /^https?:/i.test(url) ? url : `https://${url}`;
    const u = new URL(raw);
    const path = u.pathname.replace(/\/+$/, "");
    return (path || u.hostname).replace(/^\//, "").slice(0, 80) || "post";
  } catch {
    return "post";
  }
}

export function parseBrandPostId(itemId: string): string | null {
  return itemId.startsWith("post-") ? itemId.slice(5) : null;
}
