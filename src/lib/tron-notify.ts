import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notificationToRow } from "@/lib/db/mappers";
import { fmt } from "@/lib/data";
import type { AppNotification } from "@/store/store";

/** TRON senkron sonrası admin/denetçiye tekilleştirilmiş bildirim. */
export async function notifyTronSyncResult(args: {
  kasaId: string;
  kasaName: string;
  imported: number;
  skipped: number;
  totalIn: number;
  totalOut: number;
  balanceUsd: number;
  syncFrom: string;
  triggeredBy?: string;
}): Promise<void> {
  if (args.imported === 0) return;

  const refId = `tron-sync:${args.kasaId}:${new Date().toISOString().slice(0, 10)}`;
  const db = getSupabaseAdmin();
  const { data: existing } = await db
    .from("app_notifications")
    .select("id")
    .eq("ref_id", refId)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString())
    .limit(1);
  if (existing && existing.length > 0) return;

  const msg = [
    `${args.imported} yeni hareket (${args.syncFrom} itibariyle)`,
    `Gelen: +${fmt(args.totalIn)} · Giden: −${fmt(args.totalOut)}`,
    `Güncel kasa bakiyesi: ${fmt(args.balanceUsd)}`,
    "Otomatik satırları düzenleyip açıklama ekleyebilirsiniz.",
  ].join("\n");

  const now = new Date().toISOString();
  const href = `/kasa`;

  for (const forRole of ["admin", "auditor"] as const) {
    const notif: AppNotification = {
      id: `n-${crypto.randomUUID().slice(0, 12)}`,
      type: "general",
      title: `TRON kasa güncellendi · ${args.kasaName}`,
      message: msg,
      forRole,
      refId,
      createdAt: now,
      read: false,
      href,
      triggeredBy: args.triggeredBy,
    };
    await db.from("app_notifications").insert(notificationToRow(notif));
  }
}
