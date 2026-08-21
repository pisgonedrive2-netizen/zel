import { getSupabaseAdmin } from "@/lib/supabase/admin";

const QUEUE_KEY = "telegramContent.queue";
const MAX_SETTINGS_ROWS = 200;

export type TelegramQueueRow = {
  id: string;
  reel_id: string;
  content_url: string;
  platform: string;
  employee_id: string | null;
  status: string;
  error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  chat_id: string | null;
  telegram_message_id: number | null;
};

function missingTable(message: string): boolean {
  return /content_telegram_posts|does not exist|schema cache/i.test(message);
}

function asRow(v: unknown): TelegramQueueRow | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const id = String(r.id ?? "").trim();
  const reelId = String(r.reel_id ?? "").trim();
  const url = String(r.content_url ?? "").trim();
  if (!id || !reelId || !url) return null;
  return {
    id,
    reel_id: reelId,
    content_url: url,
    platform: String(r.platform ?? ""),
    employee_id: r.employee_id == null ? null : String(r.employee_id),
    status: String(r.status ?? "pending"),
    error: r.error == null ? null : String(r.error),
    attempts: Number.isFinite(Number(r.attempts)) ? Number(r.attempts) : 0,
    created_at: String(r.created_at ?? new Date().toISOString()),
    updated_at: String(r.updated_at ?? new Date().toISOString()),
    sent_at: r.sent_at == null ? null : String(r.sent_at),
    chat_id: r.chat_id == null ? null : String(r.chat_id),
    telegram_message_id:
      r.telegram_message_id == null ? null : Number(r.telegram_message_id),
  };
}

async function loadSettingsQueue(): Promise<TelegramQueueRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("app_settings")
    .select("value")
    .eq("key", QUEUE_KEY)
    .maybeSingle();
  if (error || data == null) return [];
  const raw = (data as { value: unknown }).value;
  if (!Array.isArray(raw)) return [];
  return raw.map(asRow).filter((x): x is TelegramQueueRow => Boolean(x));
}

async function saveSettingsQueue(rows: TelegramQueueRow[]): Promise<void> {
  const trimmed = rows
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, MAX_SETTINGS_ROWS);
  const { error } = await getSupabaseAdmin().from("app_settings").upsert(
    { key: QUEUE_KEY, value: trimmed, updated_by: null },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
}

export function queueId(reelId: string): string {
  return `tg-${reelId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40)}`;
}

export async function enqueueTelegramQueueRow(opts: {
  reelId: string;
  contentUrl: string;
  platform: string;
  employeeId?: string | null;
}): Promise<boolean> {
  const url = opts.contentUrl.trim();
  if (!url || !opts.reelId) return false;
  const now = new Date().toISOString();
  const row = {
    id: queueId(opts.reelId),
    reel_id: opts.reelId,
    content_url: url,
    platform: opts.platform || "",
    employee_id: opts.employeeId ?? null,
    status: "pending",
    updated_at: now,
  };
  const db = getSupabaseAdmin();
  const { error } = await db.from("content_telegram_posts").upsert(row, {
    onConflict: "reel_id",
    ignoreDuplicates: true,
  });
  if (!error) return true;
  if (!missingTable(error.message)) throw new Error(error.message);

  const current = await loadSettingsQueue();
  if (current.some((r) => r.reel_id === opts.reelId || r.id === row.id)) return true;
  current.push({
    ...row,
    error: null,
    attempts: 0,
    created_at: now,
    sent_at: null,
    chat_id: null,
    telegram_message_id: null,
  });
  await saveSettingsQueue(current);
  return true;
}

export async function markTelegramQueueRow(id: string, patch: Record<string, unknown>): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("content_telegram_posts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (!error) return;
  if (!missingTable(error.message)) throw new Error(error.message);

  const current = await loadSettingsQueue();
  const now = new Date().toISOString();
  await saveSettingsQueue(
    current.map((r) => (r.id === id ? ({ ...r, ...patch, updated_at: now } as TelegramQueueRow) : r))
  );
}

export async function resetStaleSendingTelegramRows(): Promise<void> {
  const stale = new Date(Date.now() - 15 * 60_000).toISOString();
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await db
    .from("content_telegram_posts")
    .update({ status: "pending", updated_at: now })
    .eq("status", "sending")
    .lt("updated_at", stale);
  if (!error) return;
  if (!missingTable(error.message)) throw new Error(error.message);

  const current = await loadSettingsQueue();
  await saveSettingsQueue(
    current.map((r) =>
      r.status === "sending" && r.updated_at < stale ? { ...r, status: "pending", updated_at: now } : r
    )
  );
}

export async function listPendingTelegramQueue(limit: number): Promise<TelegramQueueRow[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("content_telegram_posts")
    .select("id, reel_id, content_url, platform, employee_id, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (!error) return (data ?? []).map((r) => asRow(r)).filter((x): x is TelegramQueueRow => Boolean(x));
  if (!missingTable(error.message)) throw new Error(error.message);
  return (await loadSettingsQueue())
    .filter((r) => r.status === "pending")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, limit);
}

export async function listRecentTelegramQueue(limit: number): Promise<{
  rows: TelegramQueueRow[];
  counts: { pending: number; sent: number; failed: number };
  tableReady: boolean;
}> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("content_telegram_posts")
    .select("id, reel_id, content_url, platform, status, error, sent_at, created_at, attempts")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!error) {
    const { data: statusRows } = await db.from("content_telegram_posts").select("status");
    const counts = { pending: 0, sent: 0, failed: 0 };
    for (const r of statusRows ?? []) {
      const s = String((r as { status: string }).status);
      if (s === "pending" || s === "sending") counts.pending += 1;
      else if (s === "sent") counts.sent += 1;
      else if (s === "failed") counts.failed += 1;
    }
    return {
      rows: (data ?? []).map((r) => asRow(r)).filter((x): x is TelegramQueueRow => Boolean(x)),
      counts,
      tableReady: true,
    };
  }
  if (!missingTable(error.message)) throw new Error(error.message);

  const all = await loadSettingsQueue();
  const counts = { pending: 0, sent: 0, failed: 0 };
  for (const r of all) {
    if (r.status === "pending" || r.status === "sending") counts.pending += 1;
    else if (r.status === "sent") counts.sent += 1;
    else if (r.status === "failed") counts.failed += 1;
  }
  return {
    rows: all.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit),
    counts,
    tableReady: true,
  };
}

export type TelegramQueueStats = {
  today: number;
  week: number;
  month: number;
  lastSentAt: string | null;
  byDay: Array<{ date: string; sent: number }>;
  byPlatform: Array<{ platform: string; sent: number }>;
};

function istanbulDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

export function computeTelegramQueueStats(
  rows: Array<{ status: string; platform?: string | null; sent_at?: string | null }>
): TelegramQueueStats {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const monthPrefix = today.slice(0, 7);
  const weekStart = new Date(now.getTime() - 6 * 86400_000).toLocaleDateString("en-CA", {
    timeZone: "Europe/Istanbul",
  });
  let lastSentAt: string | null = null;
  const dayMap = new Map<string, number>();
  const platMap = new Map<string, number>();
  let todayN = 0;
  let weekN = 0;
  let monthN = 0;
  for (const r of rows) {
    if (r.status !== "sent" || !r.sent_at) continue;
    if (!lastSentAt || r.sent_at > lastSentAt) lastSentAt = r.sent_at;
    const day = istanbulDay(r.sent_at);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    const plat = (r.platform || "video").toLowerCase();
    platMap.set(plat, (platMap.get(plat) ?? 0) + 1);
    if (day === today) todayN += 1;
    if (day >= weekStart) weekN += 1;
    if (day.startsWith(monthPrefix)) monthN += 1;
  }
  const byDay = [...dayMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14)
    .map(([date, sent]) => ({ date, sent }));
  const byPlatform = [...platMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([platform, sent]) => ({ platform, sent }));
  return { today: todayN, week: weekN, month: monthN, lastSentAt, byDay, byPlatform };
}

export async function loadTelegramQueueStats(): Promise<TelegramQueueStats> {
  const db = getSupabaseAdmin();
  const since = new Date(Date.now() - 40 * 86400_000).toISOString();
  const { data, error } = await db
    .from("content_telegram_posts")
    .select("status, platform, sent_at")
    .gte("created_at", since)
    .limit(2000);
  if (!error) return computeTelegramQueueStats(data ?? []);
  if (!missingTable(error.message)) throw new Error(error.message);
  return computeTelegramQueueStats(await loadSettingsQueue());
}

export async function retryFailedTelegramQueue(): Promise<number> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("content_telegram_posts")
    .update({ status: "pending", error: null, updated_at: new Date().toISOString() })
    .eq("status", "failed")
    .select("id");
  if (!error) return data?.length ?? 0;
  if (!missingTable(error.message)) throw new Error(error.message);

  const now = new Date().toISOString();
  const current = await loadSettingsQueue();
  let n = 0;
  const next = current.map((r) => {
    if (r.status !== "failed") return r;
    n += 1;
    return { ...r, status: "pending", error: null, updated_at: now };
  });
  await saveSettingsQueue(next);
  return n;
}
