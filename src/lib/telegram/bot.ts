/** Telegram Bot API — içerik grubuna video / mesaj. */

import { createHash } from "crypto";
import {
  groupsFromTelegramUpdate,
  mergeTelegramGroups,
  type TelegramGroupChat,
} from "./group-chat";
import {
  TELEGRAM_GENERAL_TOPIC_ID,
  attachTopicsToGroups,
  mergeForumTopics,
  topicsFromTelegramUpdate,
} from "./forum-topic";
import { getSiteBaseUrl } from "@/lib/site-url";

const API = "https://api.telegram.org";
const MAX_CAPTION = 1024;
const MAX_UPLOAD_BYTES = 48 * 1024 * 1024;

export type { TelegramGroupChat };

export function getTelegramBotToken(): string | null {
  const t = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return t && t.length > 20 ? t : null;
}

export function isTelegramBotConfigured(): boolean {
  return Boolean(getTelegramBotToken());
}

export function getTelegramContentChatIdEnv(): string | null {
  const id = process.env.TELEGRAM_CONTENT_CHAT_ID?.trim();
  return id || null;
}

/** Telegram secret_token: 1–256 karakter, A-Za-z0-9_-. */
export function getTelegramWebhookSecret(): string | null {
  const explicit = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (explicit && /^[A-Za-z0-9_-]{1,256}$/.test(explicit)) return explicit;
  const base = process.env.CRON_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (!base || base.length < 16) return null;
  return createHash("sha256").update(`tg-content-webhook:${base}`).digest("hex").slice(0, 48);
}

export function telegramContentWebhookUrl(): string {
  return `${getSiteBaseUrl()}/api/telegram/content-webhook`;
}

export type TelegramApiResult = {
  ok: boolean;
  messageId?: number;
  chatId?: string;
  error?: string;
  description?: string;
};

async function telegramCall(
  token: string,
  method: string,
  body: BodyInit,
  headers?: HeadersInit
): Promise<TelegramApiResult> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(90_000),
  });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    result?: { message_id?: number; chat?: { id?: number } };
    description?: string;
  } | null;
  if (!json?.ok) {
    return {
      ok: false,
      error: json?.description ?? `Telegram HTTP ${res.status}`,
      description: json?.description,
    };
  }
  return {
    ok: true,
    messageId: json.result?.message_id,
    chatId: json.result?.chat?.id != null ? String(json.result.chat.id) : undefined,
  };
}

export function clipCaption(text: string): string {
  const t = text.trim();
  if (t.length <= MAX_CAPTION) return t;
  return `${t.slice(0, MAX_CAPTION - 1)}…`;
}

export async function telegramGetMe(token = getTelegramBotToken()): Promise<{
  ok: boolean;
  username?: string;
  name?: string;
  error?: string;
}> {
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN yok" };
  const res = await fetch(`${API}/bot${token}/getMe`, { signal: AbortSignal.timeout(15_000) });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    result?: { username?: string; first_name?: string };
    description?: string;
  } | null;
  if (!json?.ok) return { ok: false, error: json?.description ?? `HTTP ${res.status}` };
  return {
    ok: true,
    username: json.result?.username,
    name: json.result?.first_name,
  };
}

export async function telegramGetChat(
  chatId: string,
  token = getTelegramBotToken()
): Promise<{ ok: boolean; title?: string; isForum?: boolean; error?: string }> {
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN yok" };
  const res = await fetch(
    `${API}/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`,
    { signal: AbortSignal.timeout(15_000) }
  );
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    result?: { title?: string; is_forum?: boolean };
    description?: string;
  } | null;
  if (!json?.ok) return { ok: false, error: json?.description ?? `HTTP ${res.status}` };
  return {
    ok: true,
    title: json.result?.title,
    isForum: Boolean(json.result?.is_forum),
  };
}

/** Forum gruplarına General topic ekler; getChat ile is_forum işaretler. */
export async function telegramEnrichForumGroups(
  groups: TelegramGroupChat[],
  token = getTelegramBotToken()
): Promise<TelegramGroupChat[]> {
  if (!groups.length) return groups;
  const next: TelegramGroupChat[] = [];
  for (const g of groups) {
    const info = token ? await telegramGetChat(g.id, token) : { ok: false as const };
    const isForum = info.ok ? Boolean(info.isForum) : Boolean(g.isForum);
    const topics = isForum
      ? mergeForumTopics([{ threadId: TELEGRAM_GENERAL_TOPIC_ID, name: "General" }], g.topics ?? [])
      : g.topics;
    next.push({
      ...g,
      title: info.ok && info.title ? info.title : g.title,
      ...(isForum ? { isForum: true } : {}),
      ...(topics?.length ? { topics } : {}),
    });
  }
  return next;
}

export async function telegramDiscoverGroupChats(token = getTelegramBotToken()): Promise<{
  groups: TelegramGroupChat[];
  webhookActive?: boolean;
  error?: string;
}> {
  if (!token) return { groups: [], error: "TELEGRAM_BOT_TOKEN yok" };
  const allowed = encodeURIComponent(JSON.stringify(["message", "edited_message", "my_chat_member", "chat_member"]));
  const res = await fetch(
    `${API}/bot${token}/getUpdates?limit=100&timeout=0&allowed_updates=${allowed}`,
    { signal: AbortSignal.timeout(20_000) }
  );
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    result?: unknown[];
    description?: string;
    error_code?: number;
  } | null;
  if (!json?.ok || !Array.isArray(json.result)) {
    const desc = json?.description ?? `HTTP ${res.status}`;
    const webhookActive = json?.error_code === 409 || /webhook/i.test(desc);
    return { groups: [], webhookActive, error: desc };
  }
  let groups: TelegramGroupChat[] = [];
  let topicHits: Array<{ chatId: string; topic: { threadId: number; name: string } }> = [];
  for (const upd of json.result) {
    const { added } = groupsFromTelegramUpdate(upd);
    groups = mergeTelegramGroups(groups, added);
    topicHits = topicHits.concat(topicsFromTelegramUpdate(upd));
  }
  groups = attachTopicsToGroups(groups, topicHits);
  return { groups };
}

export async function telegramSetWebhook(opts: {
  url: string;
  secret: string;
  token?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const token = opts.token ?? getTelegramBotToken();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN yok" };
  const res = await fetch(`${API}/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: opts.url,
      secret_token: opts.secret,
      allowed_updates: ["message", "edited_message", "my_chat_member"],
      drop_pending_updates: false,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!json?.ok) return { ok: false, error: json?.description ?? `HTTP ${res.status}` };
  return { ok: true };
}

export async function telegramGetWebhookInfo(token = getTelegramBotToken()): Promise<{
  url?: string;
  pending?: number;
  error?: string;
}> {
  if (!token) return { error: "TELEGRAM_BOT_TOKEN yok" };
  const res = await fetch(`${API}/bot${token}/getWebhookInfo`, {
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    result?: { url?: string; pending_update_count?: number };
    description?: string;
  } | null;
  if (!json?.ok) return { error: json?.description ?? `HTTP ${res.status}` };
  return {
    url: json.result?.url ?? "",
    pending: json.result?.pending_update_count ?? 0,
  };
}

/** Üretimde grup ekleme olaylarını almak için webhook. localhost atlanır. */
export async function ensureTelegramContentWebhook(): Promise<{
  ok: boolean;
  url?: string;
  skipped?: boolean;
  error?: string;
}> {
  const token = getTelegramBotToken();
  const secret = getTelegramWebhookSecret();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN yok" };
  if (!secret) return { ok: false, error: "Webhook secret yok (SESSION_SECRET / CRON_SECRET)" };
  const url = telegramContentWebhookUrl();
  // Localhost must never register a webhook. Also skip off-Vercel so a local
  // "Grupları bul" cannot point Telegram at production with the wrong secret.
  if (process.env.VERCEL !== "1" || /localhost|127\.0\.0\.1/i.test(url)) {
    return { ok: true, skipped: true, url };
  }
  const set = await telegramSetWebhook({ url, secret, token });
  return { ...set, url };
}

export async function telegramSendMessage(opts: {
  chatId: string;
  text: string;
  threadId?: number | null;
  token?: string | null;
}): Promise<TelegramApiResult> {
  const token = opts.token ?? getTelegramBotToken();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN yok" };
  const payload: Record<string, unknown> = {
    chat_id: opts.chatId,
    text: clipCaption(opts.text),
    disable_web_page_preview: false,
  };
  if (opts.threadId && opts.threadId > 0) payload.message_thread_id = opts.threadId;
  return telegramCall(token, "sendMessage", JSON.stringify(payload), {
    "Content-Type": "application/json",
  });
}

export async function telegramSendVideoByUrl(opts: {
  chatId: string;
  videoUrl: string;
  caption: string;
  threadId?: number | null;
  token?: string | null;
}): Promise<TelegramApiResult> {
  const token = opts.token ?? getTelegramBotToken();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN yok" };
  const payload: Record<string, unknown> = {
    chat_id: opts.chatId,
    video: opts.videoUrl,
    caption: clipCaption(opts.caption),
    supports_streaming: true,
  };
  if (opts.threadId && opts.threadId > 0) payload.message_thread_id = opts.threadId;
  return telegramCall(token, "sendVideo", JSON.stringify(payload), {
    "Content-Type": "application/json",
  });
}

export async function telegramSendVideoFile(opts: {
  chatId: string;
  bytes: Uint8Array;
  filename: string;
  caption: string;
  threadId?: number | null;
  token?: string | null;
}): Promise<TelegramApiResult> {
  const token = opts.token ?? getTelegramBotToken();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN yok" };
  if (opts.bytes.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `Dosya ${Math.round(opts.bytes.byteLength / 1e6)}MB — Telegram limiti ~50MB` };
  }
  const form = new FormData();
  form.set("chat_id", opts.chatId);
  form.set("caption", clipCaption(opts.caption));
  form.set("supports_streaming", "true");
  if (opts.threadId && opts.threadId > 0) form.set("message_thread_id", String(opts.threadId));
  form.set(
    "video",
    new Blob([opts.bytes], { type: "video/mp4" }),
    opts.filename.endsWith(".mp4") ? opts.filename : `${opts.filename}.mp4`
  );
  return telegramCall(token, "sendVideo", form);
}

export { MAX_UPLOAD_BYTES };
