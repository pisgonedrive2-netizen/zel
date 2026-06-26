import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notificationToRow } from "@/lib/db/mappers";
import type { AppNotification } from "@/store/store";

function newNotifId(): string {
  const rand = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `notif-${rand}`;
}

/** Yayıncıya görev hatırlatması — panelde görev panosu yok, bildirim gider. */
export async function notifyStreamerTaskReminder(opts: {
  assigneeEmployeeId: string;
  title: string;
  dueDate?: string | null;
  triggeredBy?: string;
}): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { data: userRow } = await db
    .from("app_users")
    .select("id")
    .eq("employee_id", opts.assigneeEmployeeId)
    .eq("active", true)
    .eq("role", "streamer")
    .limit(1)
    .maybeSingle();
  const userId = userRow?.id ? String(userRow.id) : null;
  if (!userId) return false;

  const due = opts.dueDate ? ` · Son tarih: ${opts.dueDate}` : "";
  const notif: AppNotification = {
    id: newNotifId(),
    type: "general",
    title: "Bugünkü görevin",
    message: `${opts.title}${due}`,
    forRole: "streamer",
    forUserId: userId,
    triggeredBy: opts.triggeredBy,
    createdAt: new Date().toISOString(),
    read: false,
    href: "/yayinci/bildirimler",
  };
  const { error } = await db.from("app_notifications").insert(notificationToRow(notif));
  if (error) {
    const fallback: AppNotification = { ...notif, type: "schedule_updated", title: "Görev hatırlatması" };
    await db.from("app_notifications").insert(notificationToRow(fallback));
  }
  return true;
}

/** Marka ekibine görev hatırlatması. */
export async function notifyBrandTaskReminder(opts: {
  brandId: string;
  forUserId?: string;
  title: string;
  dueDate?: string | null;
  triggeredBy?: string;
}): Promise<void> {
  const db = getSupabaseAdmin();
  const due = opts.dueDate ? ` · Son tarih: ${opts.dueDate}` : "";
  const notif: AppNotification = {
    id: newNotifId(),
    type: "general",
    title: "Bugünkü görev",
    message: `${opts.title}${due}`,
    forRole: "brand",
    forBrandId: opts.brandId,
    forUserId: opts.forUserId,
    triggeredBy: opts.triggeredBy,
    createdAt: new Date().toISOString(),
    read: false,
    href: "/marka/takip",
  };
  await db.from("app_notifications").insert(notificationToRow(notif));
}
