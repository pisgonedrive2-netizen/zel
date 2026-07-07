import type { AppNotification } from "@/store/store";

/** Marka bildirimi bu kullanıcı / marka kapsamına düşüyor mu? */
export function notificationMatchesBrandScope(
  n: AppNotification,
  userId: string,
  brandIds: string[],
): boolean {
  if (n.forRole !== "brand") return false;
  const brandSet = new Set(brandIds.filter(Boolean));
  if (n.forUserId === userId) return true;
  if (n.forBrandId && brandSet.has(n.forBrandId)) return true;
  if (!n.forUserId && !n.forBrandId) return true;
  return false;
}
