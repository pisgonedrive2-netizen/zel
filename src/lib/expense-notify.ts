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
