import { mergeForumTopics, type TelegramForumTopic } from "./forum-topic";

export type { TelegramForumTopic };

export type TelegramGroupChat = {
  id: string;
  title: string;
  type: string;
  isForum?: boolean;
  topics?: TelegramForumTopic[];
  selectedThreadId?: number | null;
};

/** Grup / süpergrup id'si eksi sayıdır. Kişi ve bot id'leri artıdır. */
export function isTelegramGroupChatId(id: string | number): boolean {
  const n = typeof id === "number" ? id : Number(String(id).trim());
  return Number.isFinite(n) && n < 0;
}

export function isTelegramGroupType(type?: string | null): boolean {
  const t = (type ?? "").toLowerCase();
  return t === "group" || t === "supergroup";
}

type TgChat = { id?: number; title?: string; type?: string; username?: string };

function asGroup(chat: TgChat | null | undefined): TelegramGroupChat | null {
  if (chat?.id == null) return null;
  const type = String(chat.type ?? "");
  if (!isTelegramGroupChatId(chat.id) || !isTelegramGroupType(type)) return null;
  return {
    id: String(chat.id),
    title: chat.title?.trim() || chat.username?.trim() || String(chat.id),
    type,
  };
}

type TgUpdate = {
  message?: { chat?: TgChat };
  edited_message?: { chat?: TgChat };
  channel_post?: { chat?: TgChat };
  my_chat_member?: {
    chat?: TgChat;
    new_chat_member?: { status?: string };
  };
  chat_member?: { chat?: TgChat };
};

export function groupsFromTelegramUpdate(update: unknown): {
  added: TelegramGroupChat[];
  removedIds: string[];
} {
  const upd = (update ?? {}) as TgUpdate;
  const added: TelegramGroupChat[] = [];
  const removedIds: string[] = [];

  const status = upd.my_chat_member?.new_chat_member?.status;
  const memberChat = asGroup(upd.my_chat_member?.chat);
  if (memberChat) {
    if (status === "left" || status === "kicked") removedIds.push(memberChat.id);
    else if (!status || status === "member" || status === "administrator" || status === "restricted") {
      added.push(memberChat);
    }
  }

  for (const chat of [upd.message?.chat, upd.edited_message?.chat, upd.channel_post?.chat, upd.chat_member?.chat]) {
    const g = asGroup(chat);
    if (g) added.push(g);
  }

  const uniq = new Map(added.map((g) => [g.id, g]));
  return { added: [...uniq.values()], removedIds };
}

export function mergeTelegramGroups(
  current: TelegramGroupChat[],
  incoming: TelegramGroupChat[],
  removedIds: string[] = []
): TelegramGroupChat[] {
  const byId = new Map(current.map((g) => [g.id, g]));
  for (const id of removedIds) byId.delete(id);
  for (const g of incoming) {
    const prev = byId.get(g.id);
    const topics = mergeForumTopics(prev?.topics ?? [], g.topics ?? []);
    const selected =
      g.selectedThreadId !== undefined ? g.selectedThreadId : prev?.selectedThreadId;
    const next: TelegramGroupChat = {
      id: g.id,
      title: g.title || prev?.title || g.id,
      type: g.type || prev?.type || "supergroup",
    };
    if (g.isForum ?? prev?.isForum) next.isForum = true;
    if (topics.length) next.topics = topics;
    if (selected != null) next.selectedThreadId = selected;
    byId.set(g.id, next);
  }
  return [...byId.values()].filter((g) => isTelegramGroupChatId(g.id));
}

/** Gönderilecek gruplar: kayıtlı liste + (varsa) eksi chat_id. Artı kişi/bot id yok. */
export function telegramTargetChatIds(settings: {
  groups?: TelegramGroupChat[];
  chatId?: string | null;
}): string[] {
  const extra = String(settings.chatId ?? "").trim();
  const incoming = isTelegramGroupChatId(extra)
    ? [{ id: extra, title: extra, type: "supergroup" }]
    : [];
  return mergeTelegramGroups(settings.groups ?? [], incoming).map((g) => g.id);
}

export function telegramThreadIdForChat(
  groups: TelegramGroupChat[] | undefined,
  chatId: string
): number | undefined {
  const g = (groups ?? []).find((x) => x.id === chatId);
  const n = g?.selectedThreadId;
  return typeof n === "number" && n > 0 ? n : undefined;
}
