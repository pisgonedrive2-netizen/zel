import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notificationToRow } from "@/lib/db/mappers";
import { fmt } from "@/lib/data";
import { fmtDateTime } from "@/lib/fmt-date";
import type { AppNotification } from "@/store/store";
import type { TronNewTx } from "@/lib/tron-sync";
import { notificationHrefFor } from "@/lib/notification-href";

async function insertNotifOnce(notif: AppNotification): Promise<void> {
  const db = getSupabaseAdmin();
  const { data: existing } = await db
    .from("app_notifications")
    .select("id")
    .eq("ref_id", notif.refId ?? "")
    .limit(1);
  if (existing && existing.length > 0) return;
  await db.from("app_notifications").insert(notificationToRow(notif));
}

function shortAddr(addr?: string): string {
  const a = addr?.trim();
  if (!a || a.length < 12) return a ?? "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** İzlenen TRON cüzdan — işlem başına bildirim (kasa bakiyesine dokunmaz). */
export async function notifyTronWalletTransactions(args: {
  walletLabel: string;
  walletAddress: string;
  txs: TronNewTx[];
  triggeredBy?: string;
}): Promise<number> {
  if (args.txs.length === 0) return 0;

  const now = new Date().toISOString();
  const walletShort = shortAddr(args.walletAddress);
  let sent = 0;

  for (const tx of args.txs) {
    const isOut = tx.direction === "out";
    const title = isOut
      ? `Cüzdandan para çıkışı · −${fmt(tx.amountUsd)}`
      : `Cüzdana para girişi · +${fmt(tx.amountUsd)}`;
    const message = [
      `Saat: ${fmtDateTime(tx.date)}`,
      isOut
        ? `Çıkan tutar: −${fmt(tx.amountUsd)} USDT`
        : `Gelen tutar: +${fmt(tx.amountUsd)} USDT`,
      `Karşı adres: ${shortAddr(tx.counterparty)}`,
      `İzlenen cüzdan (${args.walletLabel}): ${walletShort}`,
    ].join("\n");

    for (const forRole of ["admin", "auditor"] as const) {
      await insertNotifOnce({
        id: `n-${crypto.randomUUID().slice(0, 12)}`,
        type: "general",
        title,
        message,
        forRole,
        refId: `tron-watch:${tx.tronTxId}:${forRole}`,
        createdAt: now,
        read: false,
        href: notificationHrefFor(forRole),
        triggeredBy: args.triggeredBy,
      });
      sent++;
    }
  }
  return sent;
}

/** Manuel kasa TRON import (eski akış — kasa hareketine yazılan). */
export async function notifyTronNewTransactions(args: {
  kasaId: string;
  kasaName: string;
  txs: TronNewTx[];
  balanceUsd: number;
  triggeredBy?: string;
}): Promise<number> {
  return notifyTronWalletTransactions({
    walletLabel: args.kasaName,
    walletAddress: "",
    txs: args.txs,
    triggeredBy: args.triggeredBy,
  });
}
