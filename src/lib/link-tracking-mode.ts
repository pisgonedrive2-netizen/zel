import type { BrandLink } from "@/store/store";
import { isAutoTrackable } from "@/lib/social-api/platform-detect";

type LinkTrackInput = Pick<BrandLink, "url" | "platform" | "handle" | "autoTrack" | "externalRef">;

/** API cron / RapidAPI ile otomatik takip edilebilir link. */
export function isApiTrackedLink(link: LinkTrackInput): boolean {
  if (link.autoTrack === false) return false;
  return isAutoTrackable(link.url, link.platform, link.handle, link.externalRef);
}

/** Kick, Twitter vb. — personelin manuel snapshot girmesi gereken linkler. */
export function needsManualTracking(link: LinkTrackInput): boolean {
  if (!link.url?.trim() && !link.handle?.trim()) return false;
  return !isApiTrackedLink(link);
}

/** Aynı link + gün için tek snapshot satırı (API ve manuel çift kayıt olmasın). */
export function snapshotIdForLinkDate(linkId: string, date: string): string {
  const d = date.slice(0, 10).replace(/-/g, "");
  return `s-${linkId.slice(0, 12)}-${d}`;
}

/** Snapshot API'den mi geldi? */
export function isApiSnapshot(notes?: string, refreshedAt?: string): boolean {
  return notes === "auto" || !!refreshedAt;
}
