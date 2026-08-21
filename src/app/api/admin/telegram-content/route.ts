import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isRapidApiEnabled, isSupabaseEnabled } from "@/lib/env";
import { listRecentTelegramQueue, loadTelegramQueueStats } from "@/lib/social-api/telegram-content-queue";
import {
  ensureTelegramContentWebhook,
  isTelegramBotConfigured,
  telegramDiscoverGroupChats,
  telegramEnrichForumGroups,
  telegramGetMe,
  telegramGetWebhookInfo,
  telegramSendMessage,
} from "@/lib/telegram/bot";
import { isTelegramGroupChatId, mergeTelegramGroups, telegramThreadIdForChat } from "@/lib/telegram/group-chat";
import {
  getTelegramContentSettings,
  saveTelegramContentSettings,
  removeTelegramContentGroup,
  selectTelegramGroupTopic,
  telegramTargetChatIds,
} from "@/lib/social-api/telegram-content-settings";
import {
  createTelegramWatchAccount,
  idsAfterAddAccount,
  idsAfterRemoveAccount,
  listTelegramContentAccounts,
  pickTelegramPollAccountIds,
} from "@/lib/social-api/telegram-content-accounts";
import { applyPreferredForumTopicSelection } from "@/lib/telegram/forum-topic";
import { syncPersonalAccountsByIds } from "@/lib/social-api/streamer-achievement-sync";
import {
  enqueueRecentPersonalContent,
  processTelegramContentQueue,
  retryFailedTelegramPosts,
} from "@/lib/social-api/telegram-content-forward";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

async function requireAdmin() {
  if (!isSupabaseEnabled()) {
    return { error: NextResponse.json({ ok: false, error: "Supabase yok" }, { status: 503 }) };
  }
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "auditor")) {
    return { error: NextResponse.json({ ok: false, error: "Yetki yok" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const settings = await getTelegramContentSettings();
  const accounts = await listTelegramContentAccounts(settings.accountIds).catch(() => ({
    watched: [],
    available: [],
    implicitAll: true as const,
    employees: [] as Array<{ id: string; name: string }>,
  }));
  const bot = isTelegramBotConfigured()
    ? await telegramGetMe()
    : { ok: false, error: "TELEGRAM_BOT_TOKEN yok" };
  const webhook = isTelegramBotConfigured() ? await telegramGetWebhookInfo() : { url: "" };

  let recent: unknown[] = [];
  const counts = { pending: 0, sent: 0, failed: 0 };
  let tableReady = true;
  let stats = {
    today: 0,
    week: 0,
    month: 0,
    lastSentAt: null as string | null,
    byDay: [] as Array<{ date: string; sent: number }>,
    byPlatform: [] as Array<{ platform: string; sent: number }>,
  };
  try {
    const listed = await listRecentTelegramQueue(40);
    recent = listed.rows;
    counts.pending = listed.counts.pending;
    counts.sent = listed.counts.sent;
    counts.failed = listed.counts.failed;
    tableReady = listed.tableReady;
    stats = await loadTelegramQueueStats();
  } catch {
    tableReady = false;
  }

  return NextResponse.json({
    ok: true,
    settings,
    accounts,
    targetChatIds: telegramTargetChatIds(settings),
    botConfigured: isTelegramBotConfigured(),
    bot,
    webhook,
    tableReady,
    counts,
    stats,
    recent,
  });
}

export async function POST(req: NextRequest) {
  try {
    return await postTelegramContent(req);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}

async function postTelegramContent(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const session = gate.session!;
  if (session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Yalnızca yönetici" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    enabled?: boolean;
    chatId?: string;
    lookbackHours?: number;
    maxPerRun?: number;
    removeChatId?: string;
    threadId?: number | null;
    accountId?: string;
    employeeId?: string;
    platform?: string;
    handle?: string;
    url?: string;
  };
  const action = body.action ?? "save";

  if (action === "start" || action === "stop") {
    const chatId = (body.chatId ?? "").trim();
    if (action === "start" && chatId && !isTelegramGroupChatId(chatId)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Bu bir kişi veya bot id'si. Grup id'si eksi sayıdır (ör. -1003892533929).",
        },
        { status: 400 }
      );
    }
    const settings = await saveTelegramContentSettings(
      {
        enabled: action === "start",
        chatId: chatId || undefined,
        lookbackHours: body.lookbackHours,
      },
      session.userId
    );
    if (action === "stop") {
      return NextResponse.json({ ok: true, settings });
    }
    if (!telegramTargetChatIds(settings).length) {
      return NextResponse.json(
        {
          ok: false,
          error: "Grup id girin (-100…) veya botu gruba ekleyip Grupları bul deyin.",
          settings,
        },
        { status: 400 }
      );
    }
    await ensureTelegramContentWebhook();
    let poll: { attempted: number; synced: number; failed: number } | undefined;
    if (isRapidApiEnabled()) {
      const listed = await listTelegramContentAccounts(settings.accountIds);
      const ids = pickTelegramPollAccountIds(listed.watched);
      if (ids.length) {
        const synced = await syncPersonalAccountsByIds(ids, { maxPostsPerAccount: 8 });
        poll = { attempted: synced.attempted, synced: synced.synced, failed: synced.failed };
      }
    }
    const summary = await processTelegramContentQueue({ maxItems: body.maxPerRun });
    return NextResponse.json({ ok: true, settings, poll, summary });
  }

  if (action === "save") {
    if (body.chatId != null && body.chatId.trim() && !isTelegramGroupChatId(body.chatId)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Bu bir kişi veya bot id'si. Grup id'si eksi sayıdır (ör. -100…). Botu gruba ekleyip Grupları bul kullanın.",
        },
        { status: 400 }
      );
    }
    const settings = await saveTelegramContentSettings(
      {
        enabled: body.enabled,
        chatId: body.chatId,
        lookbackHours: body.lookbackHours,
        maxPerRun: body.maxPerRun,
      },
      session.userId
    );
    if (settings.enabled) {
      await ensureTelegramContentWebhook();
    }
    return NextResponse.json({ ok: true, settings });
  }

  if (action === "discover") {
    const current = await getTelegramContentSettings();
    const found = await telegramDiscoverGroupChats();
    const merged = mergeTelegramGroups(current.groups, found.groups);
    const enriched = await telegramEnrichForumGroups(merged);
    const withTopic = applyPreferredForumTopicSelection(enriched);
    const settings = await saveTelegramContentSettings({ groups: withTopic }, session.userId);
    const webhook = await ensureTelegramContentWebhook();
    const chats = settings.groups;
    const topicCount = chats.reduce((n, g) => n + (g.topics?.length ?? 0), 0);
    let hint: string | undefined;
    if (!chats.length) {
      hint = found.webhookActive
        ? "Webhook açık — grubu yeniden ekleyin veya grupta bota bir mesaj yazın / etiketleyin."
        : "Grup bulunamadı. Botu gruba ekleyin, grupta bir mesaj yazın (gizlilik açıksa @botu etiketleyin), sonra tekrar deneyin.";
    } else if (chats.some((g) => g.topics?.some((t) => t.name.toLowerCase() === "videolar"))) {
      hint = "«videolar» topic bulundu — yeni içerikler oraya gidecek.";
    } else if (chats.some((g) => g.isForum) && topicCount <= chats.filter((g) => g.isForum).length) {
      hint =
        "Forum grubu görüldü. Telegram bot API tüm topicleri tek seferde listeleyemez — her topice bir mesaj yazın (gerekirse botu etiketleyin), sonra tekrar Grupları bul.";
    } else if (chats.some((g) => (g.selectedThreadId ?? 1) !== 1)) {
      hint = "Topic seçildi — videolar General yerine bu topice gidecek.";
    }
    return NextResponse.json({
      ok: true,
      chats,
      settings,
      webhook,
      discoverError: found.webhookActive ? undefined : found.error,
      hint,
    });
  }

  if (action === "select-topic") {
    const id = (body.chatId ?? "").trim();
    if (!isTelegramGroupChatId(id)) {
      return NextResponse.json({ ok: false, error: "Grup id gerekli" }, { status: 400 });
    }
    const raw = body.threadId;
    const threadId = typeof raw === "number" ? raw : Number(raw);
    const settings = await selectTelegramGroupTopic(
      id,
      Number.isFinite(threadId) && threadId > 0 ? threadId : null,
      session.userId
    );
    return NextResponse.json({ ok: true, settings, chats: settings.groups });
  }

  if (action === "remove-group") {
    const id = (body.removeChatId ?? body.chatId ?? "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "Grup id gerekli" }, { status: 400 });
    const settings = await removeTelegramContentGroup(id, session.userId);
    return NextResponse.json({ ok: true, settings, chats: settings.groups });
  }

  if (action === "test") {
    const settings = await getTelegramContentSettings();
    const requested = (body.chatId ?? "").trim();
    const chatIds = requested
      ? isTelegramGroupChatId(requested)
        ? [requested]
        : []
      : telegramTargetChatIds(settings);
    if (requested && !isTelegramGroupChatId(requested)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Kişi/bot id'sine gönderilmez. Grup id -100 ile başlar.",
        },
        { status: 400 }
      );
    }
    if (!chatIds.length) {
      return NextResponse.json({ ok: false, error: "Kayıtlı grup yok" }, { status: 400 });
    }
    const results = [];
    const sentTo = [];
    for (const chatId of chatIds) {
      const g = settings.groups.find((x) => x.id === chatId);
      const threadId = telegramThreadIdForChat(settings.groups, chatId);
      const topicName =
        g?.topics?.find((t) => t.threadId === (threadId ?? 1))?.name ??
        (threadId ? `Topic ${threadId}` : "General");
      const sent = await telegramSendMessage({
        chatId,
        threadId,
        text: "FoxStream içerik botu hazır. Yeni Shorts / Reels / TikTok videoları bu gruba düşecek.",
      });
      results.push(sent);
      sentTo.push({
        chatId,
        title: g?.title || chatId,
        topicName,
        ok: sent.ok,
        error: sent.error,
      });
    }
    const ok = results.some((r) => r.ok);
    const error = results.find((r) => !r.ok)?.error;
    return NextResponse.json({ ok, results, sentTo, error });
  }

  if (action === "backfill") {
    const settings = await getTelegramContentSettings();
    const hours = body.lookbackHours ?? settings.lookbackHours;
    const queued = await enqueueRecentPersonalContent(hours);
    return NextResponse.json({ ok: true, queued });
  }

  if (action === "retry") {
    const n = await retryFailedTelegramPosts();
    return NextResponse.json({ ok: true, retried: n });
  }

  if (action === "run") {
    const settings = await getTelegramContentSettings();
    let poll: { attempted: number; synced: number; failed: number } | undefined;
    if (isRapidApiEnabled() && settings.enabled) {
      const listed = await listTelegramContentAccounts(settings.accountIds);
      const ids = pickTelegramPollAccountIds(listed.watched);
      if (ids.length) {
        const synced = await syncPersonalAccountsByIds(ids, { maxPostsPerAccount: 8 });
        poll = { attempted: synced.attempted, synced: synced.synced, failed: synced.failed };
      }
    }
    const summary = await processTelegramContentQueue({ maxItems: body.maxPerRun });
    return NextResponse.json({ ok: true, settings, summary, poll });
  }

  if (action === "add-account") {
    const existingId = (body.accountId ?? "").trim();
    if (existingId) {
      const current = await getTelegramContentSettings();
      const settings = await saveTelegramContentSettings(
        { accountIds: await idsAfterAddAccount(current.accountIds, existingId) },
        session.userId
      );
      const accounts = await listTelegramContentAccounts(settings.accountIds);
      return NextResponse.json({ ok: true, settings, accounts });
    }
    try {
      const created = await createTelegramWatchAccount({
        employeeId: body.employeeId ?? "",
        platform: body.platform ?? "",
        handle: body.handle ?? "",
        url: body.url,
      });
      const current = await getTelegramContentSettings();
      const settings = await saveTelegramContentSettings(
        { accountIds: await idsAfterAddAccount(current.accountIds, created.id) },
        session.userId
      );
      const accounts = await listTelegramContentAccounts(settings.accountIds);
      return NextResponse.json({ ok: true, settings, accounts });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Hesap eklenemedi" },
        { status: 400 }
      );
    }
  }

  if (action === "remove-account") {
    const id = (body.accountId ?? "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "Hesap id gerekli" }, { status: 400 });
    const current = await getTelegramContentSettings();
    const settings = await saveTelegramContentSettings(
      { accountIds: await idsAfterRemoveAccount(current.accountIds, id) },
      session.userId
    );
    const accounts = await listTelegramContentAccounts(settings.accountIds);
    return NextResponse.json({ ok: true, settings, accounts });
  }

  return NextResponse.json({ ok: false, error: "Bilinmeyen action" }, { status: 400 });
}
