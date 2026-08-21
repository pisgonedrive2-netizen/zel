import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  isTelegramBotConfigured,
  telegramSendMessage,
  telegramSendVideoByUrl,
  telegramSendVideoFile,
} from "@/lib/telegram/bot";
import { getTelegramContentSettings, telegramTargetChatIds } from "./telegram-content-settings";
import { isTelegramAccountWatched } from "./telegram-content-accounts";
import { telegramThreadIdForChat } from "@/lib/telegram/group-chat";
import { downloadVideoBytes, resolveContentMediaUrl } from "./resolve-content-media";
import { buildContentCaption } from "./telegram-content-caption";
import {
  enqueueTelegramQueueRow,
  listPendingTelegramQueue,
  markTelegramQueueRow,
  resetStaleSendingTelegramRows,
  retryFailedTelegramQueue,
} from "./telegram-content-queue";

export { buildContentCaption };

export type TelegramForwardSummary = {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
};

export async function enqueueTelegramContentPost(opts: {
  reelId: string;
  contentUrl: string;
  platform: string;
  employeeId?: string | null;
}): Promise<boolean> {
  return enqueueTelegramQueueRow(opts);
}

async function employeeName(employeeId: string | null | undefined): Promise<string | null> {
  if (!employeeId) return null;
  const { data } = await getSupabaseAdmin()
    .from("employees")
    .select("name")
    .eq("id", employeeId)
    .maybeSingle();
  return data ? String((data as { name?: string }).name ?? "") || null : null;
}

async function sendResolvedVideo(opts: {
  chatId: string;
  threadId?: number | null;
  contentUrl: string;
  platform: string;
  caption: string;
}): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const media = await resolveContentMediaUrl({
    contentUrl: opts.contentUrl,
    platformHint: opts.platform,
  });
  if (!media) {
    const fallback = await telegramSendMessage({
      chatId: opts.chatId,
      threadId: opts.threadId,
      text: `${opts.caption}\n\n(Video dosyası alınamadı — link)`,
    });
    return fallback.ok
      ? { ok: true, messageId: fallback.messageId }
      : { ok: false, error: fallback.error };
  }

  if (!media.downloadPreferred) {
    const byUrl = await telegramSendVideoByUrl({
      chatId: opts.chatId,
      threadId: opts.threadId,
      videoUrl: media.url,
      caption: opts.caption,
    });
    if (byUrl.ok) return { ok: true, messageId: byUrl.messageId };
  }

  try {
    const bytes = await downloadVideoBytes(media.url);
    const uploaded = await telegramSendVideoFile({
      chatId: opts.chatId,
      threadId: opts.threadId,
      bytes,
      filename: `${media.platform}-${Date.now()}.mp4`,
      caption: opts.caption,
    });
    if (uploaded.ok) return { ok: true, messageId: uploaded.messageId };
    const fallback = await telegramSendMessage({
      chatId: opts.chatId,
      threadId: opts.threadId,
      text: `${opts.caption}\n\n(Yükleme: ${uploaded.error ?? "hata"})`,
    });
    return fallback.ok
      ? { ok: true, messageId: fallback.messageId }
      : { ok: false, error: uploaded.error ?? fallback.error };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const fallback = await telegramSendMessage({
      chatId: opts.chatId,
      threadId: opts.threadId,
      text: `${opts.caption}\n\n(İndirme: ${msg})`,
    });
    return fallback.ok ? { ok: true, messageId: fallback.messageId } : { ok: false, error: msg };
  }
}

/**
 * Bekleyen kuyruk satırlarını, botun kayıtlı olduğu Telegram gruplarına atar.
 * Yeni içerik sync sonrası ve cron ile çağrılır.
 */
export async function processTelegramContentQueue(opts?: {
  maxItems?: number;
}): Promise<TelegramForwardSummary> {
  const summary: TelegramForwardSummary = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  if (!isTelegramBotConfigured()) {
    summary.skipped = 1;
    summary.errors.push("TELEGRAM_BOT_TOKEN tanımlı değil");
    return summary;
  }

  const settings = await getTelegramContentSettings();
  if (!settings.enabled) {
    summary.skipped = 1;
    summary.errors.push("Telegram iletimi kapalı");
    return summary;
  }
  const chatIds = telegramTargetChatIds(settings);
  if (!chatIds.length) {
    summary.skipped = 1;
    summary.errors.push("Kayıtlı Telegram grubu yok — botu gruba ekleyip Grupları bul");
    return summary;
  }

  await resetStaleSendingTelegramRows();

  const limit = opts?.maxItems ?? settings.maxPerRun;
  const rows = await listPendingTelegramQueue(limit);

  for (const r of rows) {
    summary.attempted += 1;
    await markTelegramQueueRow(r.id, { status: "sending", attempts: (r.attempts ?? 0) + 1 });
    try {
      const name = await employeeName(r.employee_id);
      const caption = buildContentCaption({
        employeeName: name,
        platform: r.platform,
        url: r.content_url,
      });
      const perChat: Array<{ chatId: string; ok: boolean; messageId?: number; error?: string }> = [];
      for (const chatId of chatIds) {
        const sent = await sendResolvedVideo({
          chatId,
          threadId: telegramThreadIdForChat(settings.groups, chatId),
          contentUrl: r.content_url,
          platform: r.platform,
          caption,
        });
        perChat.push({ chatId, ...sent });
      }
      const okChats = perChat.filter((c) => c.ok);
      const failChats = perChat.filter((c) => !c.ok);
      if (!okChats.length) {
        const err = failChats.map((c) => `${c.chatId}: ${c.error ?? "hata"}`).join("; ");
        await markTelegramQueueRow(r.id, {
          status: "failed",
          error: err || "Telegram hatası",
          chat_id: chatIds[0],
        });
        summary.failed += 1;
        summary.errors.push(`${r.content_url}: ${err || "hata"}`);
        continue;
      }
      await markTelegramQueueRow(r.id, {
        status: "sent",
        error: failChats.length
          ? failChats.map((c) => `${c.chatId}: ${c.error ?? "hata"}`).join("; ")
          : null,
        chat_id: okChats.map((c) => c.chatId).join(","),
        telegram_message_id: okChats[0]?.messageId ?? null,
        sent_at: new Date().toISOString(),
      });
      summary.sent += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markTelegramQueueRow(r.id, { status: "failed", error: msg.slice(0, 500) });
      summary.failed += 1;
      summary.errors.push(`${r.content_url}: ${msg.slice(0, 120)}`);
    }
  }

  return summary;
}

/** Son N saatteki kişisel hesap videolarını kuyruğa alır (ilk açılış / kaçanlar). */
export async function enqueueRecentPersonalContent(lookbackHours: number): Promise<number> {
  const since = new Date(Date.now() - lookbackHours * 3600_000).toISOString();
  const db = getSupabaseAdmin();
  const settings = await getTelegramContentSettings();
  const { data, error } = await db
    .from("week_brand_reels")
    .select("id, content_url, platform, employee_id, streamer_account_id, published_at, created_at")
    .not("streamer_account_id", "is", null)
    .gte("created_at", since)
    .limit(80);
  if (error) throw new Error(error.message);
  let n = 0;
  for (const row of data ?? []) {
    const r = row as {
      id: string;
      content_url: string;
      platform: string;
      employee_id: string;
      streamer_account_id?: string | null;
    };
    if (!isTelegramAccountWatched(String(r.streamer_account_id ?? ""), settings.accountIds)) continue;
    const ok = await enqueueTelegramContentPost({
      reelId: r.id,
      contentUrl: r.content_url,
      platform: r.platform,
      employeeId: r.employee_id,
    });
    if (ok) n += 1;
  }
  return n;
}

export async function retryFailedTelegramPosts(): Promise<number> {
  return retryFailedTelegramQueue();
}
