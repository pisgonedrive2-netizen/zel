import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getTelegramContentChatIdEnv } from "@/lib/telegram/bot";
import {
  groupsFromTelegramUpdate,
  isTelegramGroupChatId,
  mergeTelegramGroups,
  telegramTargetChatIds,
  type TelegramGroupChat,
} from "@/lib/telegram/group-chat";
import {
  parseForumThreadId,
  parseForumTopics,
  topicsFromTelegramUpdate,
  attachTopicsToGroups,
  applyPreferredForumTopicSelection,
} from "@/lib/telegram/forum-topic";
import { parseTelegramAccountIds } from "./telegram-content-accounts";

export type TelegramContentSettings = {
  enabled: boolean;
  chatId: string;
  groups: TelegramGroupChat[];
  lookbackHours: number;
  maxPerRun: number;
  /** null = tüm kişisel YT/IG/TT hesapları. [] = hiçbiri. */
  accountIds: string[] | null;
};

const DEFAULTS: TelegramContentSettings = {
  enabled: false,
  chatId: "",
  groups: [],
  lookbackHours: 48,
  maxPerRun: 6,
  accountIds: null,
};

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === true) return true;
  if (v === "false" || v === false) return false;
  return fallback;
}

function asNum(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function parseTelegramGroups(v: unknown): TelegramGroupChat[] {
  if (!Array.isArray(v)) return [];
  const incoming: TelegramGroupChat[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const rec = item as {
      id?: unknown;
      title?: unknown;
      type?: unknown;
      isForum?: unknown;
      topics?: unknown;
      selectedThreadId?: unknown;
    };
    const id = String(rec.id ?? "").trim();
    if (!isTelegramGroupChatId(id)) continue;
    const topics = parseForumTopics(rec.topics);
    const selectedThreadId = parseForumThreadId(rec.selectedThreadId);
    incoming.push({
      id,
      title: String(rec.title ?? "").trim() || id,
      type: String(rec.type ?? "supergroup").trim() || "supergroup",
      ...(rec.isForum === true || rec.isForum === "true" ? { isForum: true } : {}),
      ...(topics.length ? { topics } : {}),
      ...(selectedThreadId != null ? { selectedThreadId } : {}),
    });
  }
  return mergeTelegramGroups([], incoming);
}

function onlyGroupChatId(id: string | null | undefined): string {
  const t = String(id ?? "").trim();
  return isTelegramGroupChatId(t) ? t : "";
}

export { telegramTargetChatIds };

export async function getTelegramContentSettings(): Promise<TelegramContentSettings> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "telegramContent.enabled",
        "telegramContent.chatId",
        "telegramContent.groups",
        "telegramContent.lookbackHours",
        "telegramContent.maxPerRun",
        "telegramContent.accountIds",
      ]);
    if (error || !data?.length) {
      const chatId = onlyGroupChatId(getTelegramContentChatIdEnv());
      return {
        ...DEFAULTS,
        chatId,
        groups: chatId ? [{ id: chatId, title: chatId, type: "supergroup" }] : [],
      };
    }
    const map = new Map(
      data.map((r) => [String((r as { key: string }).key), (r as { value: unknown }).value])
    );
    const chatFromDb = onlyGroupChatId(String(map.get("telegramContent.chatId") ?? "").trim());
    const chatId = chatFromDb || onlyGroupChatId(getTelegramContentChatIdEnv());
    const groups = mergeTelegramGroups(
      parseTelegramGroups(map.get("telegramContent.groups")),
      chatId ? [{ id: chatId, title: chatId, type: "supergroup" }] : []
    );
    return {
      enabled: asBool(map.get("telegramContent.enabled"), DEFAULTS.enabled),
      chatId: chatId || groups[0]?.id || "",
      groups,
      lookbackHours: asNum(map.get("telegramContent.lookbackHours"), DEFAULTS.lookbackHours, 6, 168),
      maxPerRun: asNum(map.get("telegramContent.maxPerRun"), DEFAULTS.maxPerRun, 1, 20),
      accountIds: parseTelegramAccountIds(map.get("telegramContent.accountIds")),
    };
  } catch {
    const chatId = onlyGroupChatId(getTelegramContentChatIdEnv());
    return {
      ...DEFAULTS,
      chatId,
      groups: chatId ? [{ id: chatId, title: chatId, type: "supergroup" }] : [],
    };
  }
}

export async function saveTelegramContentSettings(
  partial: Partial<TelegramContentSettings>,
  updatedBy?: string
): Promise<TelegramContentSettings> {
  const current = await getTelegramContentSettings();
  const groups =
    partial.groups !== undefined
      ? parseTelegramGroups(partial.groups)
      : current.groups;
  const requestedChat = onlyGroupChatId(partial.chatId ?? current.chatId);
  const merged = mergeTelegramGroups(
    groups,
    requestedChat ? [{ id: requestedChat, title: requestedChat, type: "supergroup" }] : []
  );
  const next: TelegramContentSettings = {
    enabled: partial.enabled ?? current.enabled,
    chatId: requestedChat || merged[0]?.id || "",
    groups: merged,
    lookbackHours: asNum(
      partial.lookbackHours ?? current.lookbackHours,
      DEFAULTS.lookbackHours,
      6,
      168
    ),
    maxPerRun: asNum(partial.maxPerRun ?? current.maxPerRun, DEFAULTS.maxPerRun, 1, 20),
    accountIds:
      partial.accountIds !== undefined
        ? parseTelegramAccountIds(partial.accountIds)
        : current.accountIds,
  };
  const rows: Array<{ key: string; value: unknown; updated_by: string | null }> = [
    { key: "telegramContent.enabled", value: next.enabled, updated_by: updatedBy ?? null },
    { key: "telegramContent.chatId", value: next.chatId, updated_by: updatedBy ?? null },
    { key: "telegramContent.groups", value: next.groups, updated_by: updatedBy ?? null },
    { key: "telegramContent.lookbackHours", value: next.lookbackHours, updated_by: updatedBy ?? null },
    { key: "telegramContent.maxPerRun", value: next.maxPerRun, updated_by: updatedBy ?? null },
  ];
  if (next.accountIds != null) {
    rows.push({
      key: "telegramContent.accountIds",
      value: next.accountIds,
      updated_by: updatedBy ?? null,
    });
  }
  const db = getSupabaseAdmin();
  const { error } = await db.from("app_settings").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
  if (next.accountIds == null) {
    await db.from("app_settings").delete().eq("key", "telegramContent.accountIds");
  }
  return next;
}

export async function mergeDiscoveredTelegramGroups(
  incoming: TelegramGroupChat[],
  updatedBy?: string
): Promise<TelegramContentSettings> {
  const current = await getTelegramContentSettings();
  return saveTelegramContentSettings(
    { groups: mergeTelegramGroups(current.groups, incoming) },
    updatedBy
  );
}

export async function removeTelegramContentGroup(
  chatId: string,
  updatedBy?: string
): Promise<TelegramContentSettings> {
  const id = String(chatId).trim();
  const current = await getTelegramContentSettings();
  const groups = current.groups.filter((g) => g.id !== id);
  return saveTelegramContentSettings(
    {
      groups,
      chatId: current.chatId === id ? groups[0]?.id ?? "" : current.chatId,
    },
    updatedBy
  );
}

export async function selectTelegramGroupTopic(
  chatId: string,
  threadId: number | null,
  updatedBy?: string
): Promise<TelegramContentSettings> {
  const id = String(chatId).trim();
  const current = await getTelegramContentSettings();
  const groups = current.groups.map((g) =>
    g.id === id
      ? { ...g, selectedThreadId: threadId && threadId > 0 ? threadId : null }
      : g
  );
  return saveTelegramContentSettings({ groups, chatId: id || current.chatId }, updatedBy);
}

export async function applyTelegramGroupUpdate(update: unknown): Promise<TelegramGroupChat[]> {
  const { added, removedIds } = groupsFromTelegramUpdate(update);
  const topicHits = topicsFromTelegramUpdate(update);
  if (!added.length && !removedIds.length && !topicHits.length) {
    const current = await getTelegramContentSettings();
    return current.groups;
  }
  const current = await getTelegramContentSettings();
  let groups = mergeTelegramGroups(current.groups, added, removedIds);
  groups = applyPreferredForumTopicSelection(attachTopicsToGroups(groups, topicHits));
  await saveTelegramContentSettings({
    groups,
    chatId: groups.some((g) => g.id === current.chatId)
      ? current.chatId
      : groups[0]?.id ?? "",
  });
  return groups;
}
