import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notificationToRow } from "@/lib/db/mappers";
import type { AppNotification } from "@/store/store";
import { fmt } from "@/lib/data";

/** Yayıncı harcama gönderdiğinde admin/denetçiye kalıcı bildirim (ref_id ile tekilleştirilir). */
export async function ensureExpenseSubmittedNotifications(args: {
  expenseId: string;
  employeeName: string;
  brandName: string;
  category: string;
  amountUsd: number;
  description: string;
  month: string;
  triggeredBy?: string;
}): Promise<void> {
  const refId = `expense-submit:${args.expenseId}`;
  const { data: existing } = await getSupabaseAdmin()
    .from("app_notifications")
    .select("id")
    .eq("ref_id", refId)
    .limit(1);
  if (existing && existing.length > 0) return;

  const msg = `${args.employeeName}: ${args.brandName} · ${args.category} · ${fmt(args.amountUsd)} — ${args.description.slice(0, 120)}`;
  const now = new Date().toISOString();
  const href = `/icerik-harcamalari?review=${args.expenseId}`;

  const base = {
    message: msg,
    refId,
    createdAt: now,
    read: false,
    href,
    triggeredBy: args.triggeredBy,
  };

  for (const forRole of ["admin", "auditor"] as const) {
    const notif: AppNotification = {
      id: `n-${crypto.randomUUID().slice(0, 12)}`,
      type: "expense_submitted",
      title:
        forRole === "admin"
          ? `${args.employeeName} yeni harcama gönderdi`
          : `Yeni yayıncı harcama raporu`,
      forRole,
      ...base,
    };
    const { error } = await getSupabaseAdmin()
      .from("app_notifications")
      .insert(notificationToRow(notif));
    if (error) {
      const isEnum =
        error.message.includes("enum") ||
        error.message.includes("invalid input value");
      if (isEnum) {
        await getSupabaseAdmin()
          .from("app_notifications")
          .insert(notificationToRow({ ...notif, type: "general" }));
      } else {
        throw new Error(error.message);
      }
    }
  }
}

/** Yayıncıya harcama inceleme sonucu (kalıcı, ref_id ile tekilleştirilir). */
export async function notifyStreamerExpenseUpdate(args: {
  expenseId: string;
  forUserId: string;
  type: AppNotification["type"];
  title: string;
  message: string;
  triggeredBy?: string;
}): Promise<void> {
  const refId = `expense-streamer:${args.type}:${args.expenseId}`;
  const { data: existing } = await getSupabaseAdmin()
    .from("app_notifications")
    .select("id")
    .eq("ref_id", refId)
    .limit(1);
  if (existing && existing.length > 0) return;

  const notif: AppNotification = {
    id: `n-${crypto.randomUUID().slice(0, 12)}`,
    type: args.type,
    title: args.title,
    message: args.message,
    forRole: "streamer",
    forUserId: args.forUserId,
    refId,
    href: `/yayinci/harcamalar?review=${args.expenseId}`,
    createdAt: new Date().toISOString(),
    read: false,
    triggeredBy: args.triggeredBy,
  };

  const { error } = await getSupabaseAdmin()
    .from("app_notifications")
    .insert(notificationToRow(notif));
  if (error) {
    const isEnum =
      error.message.includes("enum") || error.message.includes("invalid input value");
    if (isEnum) {
      await getSupabaseAdmin()
        .from("app_notifications")
        .insert(
          notificationToRow({
            ...notif,
            type: "general",
            title: args.title,
          })
        );
    } else {
      throw new Error(error.message);
    }
  }
}

/** Yayıncı harcama gönderdi — kendisine onay bildirimi. */
export async function notifyStreamerExpenseSubmitted(args: {
  expenseId: string;
  forUserId: string;
  brandName: string;
  amountUsd: number;
}): Promise<void> {
  await notifyStreamerExpenseUpdate({
    expenseId: args.expenseId,
    forUserId: args.forUserId,
    type: "general",
    title: "Harcamanız alındı",
    message: `${args.brandName} · ${fmt(args.amountUsd)} incelemeye gönderildi. Sonuç burada görünecek.`,
    triggeredBy: args.forUserId,
  });
}
