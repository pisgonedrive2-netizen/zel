import type { Role } from "@/store/auth";

/** Rol için bildirim merkezi rotası. */
export function notificationsHrefForRole(role: Role | null | undefined): string {
  if (role === "brand") return "/marka/bildirimler";
  if (role === "streamer") return "/yayinci/bildirimler";
  return "/bildirimler";
}

/** Bildirim kaydı için hedef — forRole öncelikli, yoksa genel admin rotası. */
export function notificationHrefFor(
  forRole?: string | null,
  explicitHref?: string | null
): string {
  if (explicitHref?.trim()) return explicitHref.trim();
  if (forRole === "brand") return "/marka/bildirimler";
  if (forRole === "streamer") return "/yayinci/bildirimler";
  return "/bildirimler";
}
