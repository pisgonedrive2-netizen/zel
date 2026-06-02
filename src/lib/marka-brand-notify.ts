import { insertNotificationSafe } from "@/lib/brand-offer-shared";
import { markaHref } from "@/lib/use-marka-view-month";
import type { AppNotification } from "@/store/store";

function newNotifId(): string {
  return `n-${crypto.randomUUID().slice(0, 12)}`;
}

/** Marka link senkronu / yeni içerik sonrası bildirim. */
export async function notifyBrandContentPublished(opts: {
  brandId: string;
  synced: number;
  monthYm: string;
  employeeId?: string;
  employeeName?: string;
}): Promise<void> {
  if (opts.synced <= 0) return;
  const href = markaHref("/marka/izlenmeler", opts.monthYm);
  const who = opts.employeeName ? `${opts.employeeName} — ` : "";
  const notif: AppNotification = {
    id: newNotifId(),
    type: "content_published",
    title: "İçerik paylaşımı güncellendi",
    message: `${who}${opts.synced} link/reel achievement takvimine yazıldı.`,
    forRole: "brand",
    forBrandId: opts.brandId,
    refId: opts.employeeId,
    createdAt: new Date().toISOString(),
    read: false,
    href,
  };
  await insertNotificationSafe(notif);
}

/** Anlaşma teslimatı gecikmiş / eksik (tek seferlik, ref ile). */
export async function notifyBrandDeliverableLate(opts: {
  brandId: string;
  dealId: string;
  dealTitle: string;
  missingTotal: number;
}): Promise<void> {
  if (opts.missingTotal <= 0) return;
  const notif: AppNotification = {
    id: newNotifId(),
    type: "deliverable_late",
    title: "Teslimat eksik",
    message: `${opts.dealTitle}: ${opts.missingTotal} deliverable henüz tamamlanmadı.`,
    forRole: "brand",
    forBrandId: opts.brandId,
    refId: opts.dealId,
    createdAt: new Date().toISOString(),
    read: false,
    href: `/marka/anlasmalar/${opts.dealId}`,
  };
  await insertNotificationSafe(notif);
}
