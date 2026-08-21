export const TELEGRAM_GENERAL_TOPIC_ID = 1;

export type TelegramForumTopic = {
  threadId: number;
  name: string;
};

function isGroupChat(id: unknown, type?: string | null): boolean {
  const n = typeof id === "number" ? id : Number(String(id ?? "").trim());
  const t = (type ?? "").toLowerCase();
  return Number.isFinite(n) && n < 0 && (t === "group" || t === "supergroup");
}

export function parseForumThreadId(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.round(n);
}

export function parseForumTopics(v: unknown): TelegramForumTopic[] {
  if (!Array.isArray(v)) return [];
  return mergeForumTopics(
    [],
    v.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const rec = item as { threadId?: unknown; name?: unknown };
      const threadId = parseForumThreadId(rec.threadId);
      if (threadId == null) return [];
      return [{ threadId, name: String(rec.name ?? "").trim() }];
    })
  );
}

export function mergeForumTopics(
  current: TelegramForumTopic[],
  incoming: TelegramForumTopic[]
): TelegramForumTopic[] {
  const byId = new Map<number, TelegramForumTopic>();
  for (const t of [...current, ...incoming]) {
    const id = parseForumThreadId(t.threadId);
    if (id == null) continue;
    const prev = byId.get(id);
    const name = t.name.trim() || prev?.name || (id === TELEGRAM_GENERAL_TOPIC_ID ? "General" : `Topic ${id}`);
    byId.set(id, { threadId: id, name });
  }
  return [...byId.values()].sort((a, b) => a.threadId - b.threadId);
}

type TgMsg = {
  message_id?: number;
  message_thread_id?: number;
  is_topic_message?: boolean;
  chat?: { id?: number; type?: string };
  forum_topic_created?: { name?: string };
  forum_topic_edited?: { name?: string };
  reply_to_message?: TgMsg;
};

function topicNameFromMessage(msg: TgMsg, threadId: number): string {
  const created = msg.forum_topic_created?.name?.trim();
  if (created) return created;
  const edited = msg.forum_topic_edited?.name?.trim();
  if (edited) return edited;
  const replyCreated = msg.reply_to_message?.forum_topic_created?.name?.trim();
  if (replyCreated) return replyCreated;
  const replyEdited = msg.reply_to_message?.forum_topic_edited?.name?.trim();
  if (replyEdited) return replyEdited;
  if (threadId === TELEGRAM_GENERAL_TOPIC_ID) return "General";
  return `Topic ${threadId}`;
}

export function topicFromTelegramMessage(msg: unknown): {
  chatId: string;
  topic: TelegramForumTopic;
} | null {
  const m = (msg ?? {}) as TgMsg;
  const chat = m.chat;
  if (chat?.id == null || !isGroupChat(chat.id, chat.type)) {
    return null;
  }
  const created = Boolean(m.forum_topic_created || m.forum_topic_edited);
  const threadId =
    parseForumThreadId(m.message_thread_id) ??
    (created ? parseForumThreadId(m.message_id) : null);
  if (threadId == null) return null;
  // Forum mesajlarında is_topic_message bazen gelmez; thread id yeter.
  if (
    !created &&
    m.is_topic_message !== true &&
    threadId !== TELEGRAM_GENERAL_TOPIC_ID &&
    m.message_thread_id == null
  ) {
    return null;
  }
  return {
    chatId: String(chat.id),
    topic: { threadId, name: topicNameFromMessage(m, threadId) },
  };
}

export const TELEGRAM_PREFERRED_CONTENT_TOPIC = "videolar";

export function topicNameKey(name: string): string {
  return name.trim().toLocaleLowerCase("tr-TR");
}

/** videolar topici veya (yoksa) General dışı tek topic. */
export function pickPreferredForumThreadId(
  topics: TelegramForumTopic[] | undefined,
  current: number | null | undefined,
  preferredName = TELEGRAM_PREFERRED_CONTENT_TOPIC
): number | null {
  const list = topics ?? [];
  const want = topicNameKey(preferredName);
  const named = list.find((t) => topicNameKey(t.name) === want);
  if (named) return named.threadId;
  if (current && current > 0 && current !== TELEGRAM_GENERAL_TOPIC_ID) return current;
  const others = list.filter((t) => t.threadId !== TELEGRAM_GENERAL_TOPIC_ID);
  if (others.length === 1) return others[0]!.threadId;
  return current && current > 0 ? current : null;
}

export function applyPreferredForumTopicSelection<
  T extends { topics?: TelegramForumTopic[]; selectedThreadId?: number | null },
>(groups: T[], preferredName = TELEGRAM_PREFERRED_CONTENT_TOPIC): T[] {
  return groups.map((g) => {
    const picked = pickPreferredForumThreadId(g.topics, g.selectedThreadId, preferredName);
    if (picked == null || g.selectedThreadId === picked) return g;
    return { ...g, selectedThreadId: picked };
  });
}

type TgUpdate = {
  message?: TgMsg;
  edited_message?: TgMsg;
  channel_post?: TgMsg;
};

export function topicsFromTelegramUpdate(update: unknown): Array<{
  chatId: string;
  topic: TelegramForumTopic;
}> {
  const upd = (update ?? {}) as TgUpdate;
  const out: Array<{ chatId: string; topic: TelegramForumTopic }> = [];
  for (const msg of [upd.message, upd.edited_message, upd.channel_post]) {
    const hit = topicFromTelegramMessage(msg);
    if (hit) out.push(hit);
  }
  return out;
}

export function attachTopicsToGroups<T extends { id: string; topics?: TelegramForumTopic[]; isForum?: boolean }>(
  groups: T[],
  hits: Array<{ chatId: string; topic: TelegramForumTopic }>
): T[] {
  if (!hits.length) return groups;
  const byChat = new Map<string, TelegramForumTopic[]>();
  for (const h of hits) {
    byChat.set(h.chatId, mergeForumTopics(byChat.get(h.chatId) ?? [], [h.topic]));
  }
  return groups.map((g) => {
    const extra = byChat.get(g.id);
    if (!extra?.length) return g;
    return {
      ...g,
      isForum: true,
      topics: mergeForumTopics(g.topics ?? [], extra),
    };
  });
}
