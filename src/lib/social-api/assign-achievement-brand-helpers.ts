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

/** İzlenme geri gitmesin — taşıma / yenilemede yüksek olan kalır. */
export function pickNonDecreasingViews(
  current: number | null | undefined,
  incoming: number | null | undefined
): number | null {
  const a = current != null && Number.isFinite(Number(current)) ? Number(current) : null;
  const b = incoming != null && Number.isFinite(Number(incoming)) ? Number(incoming) : null;
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

export type AchievementBrandLinkPlan =
  | { kind: "create" }
  | { kind: "reuse"; linkId: string }
  | { kind: "move"; linkId: string }
  | { kind: "merge"; keepId: string; dropId: string };

/** Mevcut linki yeni markaya taşı; aynı URL hedefte varsa birleştir (çift sayım olmasın). */
export function planAchievementBrandLink(opts: {
  targetBrandId: string;
  currentLink?: { id: string; brandId: string } | null;
  duplicateOnTarget?: { id: string } | null;
}): AchievementBrandLinkPlan {
  const cur = opts.currentLink;
  const dup = opts.duplicateOnTarget;
  if (cur && cur.brandId === opts.targetBrandId) {
    return { kind: "reuse", linkId: cur.id };
  }
  if (dup && cur && dup.id !== cur.id) {
    return { kind: "merge", keepId: dup.id, dropId: cur.id };
  }
  if (dup) return { kind: "reuse", linkId: dup.id };
  if (cur) return { kind: "move", linkId: cur.id };
  return { kind: "create" };
}
