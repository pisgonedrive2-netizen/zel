/**
 * Yeni hesapların o gün (İstanbul) video / reel / hikaye paylaşıp paylaşmadığını tarar.
 *
 * Gece 00:00 (İstanbul) bir önceki günü kesin tarar ve tek bildirim gönderir.
 * Sonuçlar takvimde tutulur (byDate).
 */
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { notificationToRow } from "@/lib/db/mappers";
import { MAIN_ADMIN_ID } from "@/lib/user-guards";
import { telegramSendMessage, getTelegramContentChatIdEnv } from "@/lib/telegram/bot";
import { isRapidApiEnabled } from "@/lib/env";
import { rapidApiGet } from "@/lib/social-api/clients";
import {
  parseInstagramMediaList,
  parseTikTokUserPosts,
  parseYouTubeChannelVideos,
  pickIgUserId,
  type ProfilePostItem,
} from "@/lib/social-api/streamer-profile-posts";
import { pickPublishedAtIso } from "@/lib/social-api/published-at";
import { resolveLinkDetection } from "@/lib/social-api/platform-detect";
import {
  HESAP_TAG_LABEL,
  YENI_HESAPLAR,
  type YeniHesapAccount,
} from "@/lib/yeni-hesaplar";
import type { AppNotification } from "@/store/store";
import {
  hesapGunlukIstanbulDate,
  istanbulDayRangeEnding,
  istanbulDayToClose,
  shiftIstanbulDay,
  type HesapGunlukItem,
  type HesapGunlukReport,
  type HesapGunlukRow,
  type HesapGunlukStore,
} from "@/lib/hesap-gunluk-aktivite-shared";

export type {
  HesapAktiviteKind,
  HesapGunlukItem,
  HesapGunlukReport,
  HesapGunlukRow,
  HesapGunlukStore,
} from "@/lib/hesap-gunluk-aktivite-shared";
export {
  hesapGunlukIstanbulDate,
  istanbulDayRangeEnding,
  istanbulDayToClose,
  shiftIstanbulDay,
  shouldAutoBackfillHesapGunluk,
} from "@/lib/hesap-gunluk-aktivite-shared";

export const HESAP_GUNLUK_SETTINGS_KEY = "hesap.gunlukAktivite";
const HISTORY_DAYS = 92;
const DETAIL_DAYS = 21;
const MAX_ITEMS_PER_ROW = 8;


function isoOnIstanbulDay(iso: string | undefined, day: string): boolean {
  if (!iso) return false;
  try {
    return hesapGunlukIstanbulDate(new Date(iso)) === day;
  } catch {
    return false;
  }
}

function isVideoLike(p: ProfilePostItem): boolean {
  return (p.contentType ?? "").toLowerCase() !== "story";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isQuotaError(msg: string): boolean {
  return /429|rate limit|kota|requests limit/i.test(msg);
}

/** Son paylaşımları çeker (gün filtresi yok) — aynı yanıt birkaç güne bölünebilir. */
async function fetchRecentActivity(account: YeniHesapAccount): Promise<{
  videos: ProfilePostItem[];
  stories: ProfilePostItem[];
}> {
  const handle = account.handle.replace(/^@/, "");
  if (account.platform === "Instagram") {
    const profileRaw = await rapidApiGet("instagram", "/profile", { username: handle });
    const userId = pickIgUserId(profileRaw);
    if (!userId) throw new Error(`Instagram id yok (@${handle})`);
    const reelsRaw = await rapidApiGet("instagram", "/reels", { user_id: userId });
    const videos = parseInstagramMediaList(reelsRaw, "reels");
    let stories: ProfilePostItem[] = [];
    try {
      const raw = await rapidApiGet("instagram", "/stories", { user_id: userId });
      const list =
        (raw as { data?: { reels?: unknown[] } })?.data?.reels ??
        (Array.isArray((raw as { items?: unknown[] }).items) ? (raw as { items: unknown[] }).items : []) ??
        [];
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        const media = (o.media ?? o) as Record<string, unknown>;
        const code = String(media.code ?? media.id ?? media.pk ?? "").trim();
        const publishedAt = pickPublishedAtIso(media) ?? pickPublishedAtIso(o);
        const thumb =
          (typeof media.thumbnail_url === "string" && media.thumbnail_url) ||
          (typeof media.display_url === "string" && media.display_url) ||
          (typeof media.image_url === "string" && media.image_url) ||
          undefined;
        stories.push({
          url: code
            ? `https://www.instagram.com/stories/${handle}/${code}/`
            : `https://www.instagram.com/${handle}/`,
          platform: "instagram",
          contentType: "story",
          externalRef: code || `story-${stories.length}`,
          publishedAt: publishedAt ?? new Date().toISOString(),
          thumbnailUrl: thumb,
          title: "Hikaye",
        });
      }
    } catch {
      /* hikaye opsiyonel */
    }
    return { videos, stories };
  }

  if (account.platform === "YouTube") {
    const detected = resolveLinkDetection({
      url: account.url,
      platform: account.platform,
      handle: account.handle,
    });
    if (!detected) return { videos: [], stories: [] };
    const channelId = detected.externalRef;
    const raw = await rapidApiGet("youtube", "/channel/videos/", {
      id: channelId,
      filter: "shorts_latest",
    });
    let videos = parseYouTubeChannelVideos(raw, true);
    if (videos.length === 0) {
      const raw2 = await rapidApiGet("youtube", "/channel/videos/", {
        id: channelId,
        filter: "videos_latest",
      });
      videos = parseYouTubeChannelVideos(raw2, false);
    }
    return { videos, stories: [] };
  }

  const raw = await rapidApiGet("tiktok", "/user/posts", {
    unique_id: `@${handle}`,
    count: "30",
  });
  const videos = parseTikTokUserPosts(raw).map((p) =>
    p.url.includes("/@")
      ? p
      : {
          ...p,
          url: p.externalRef
            ? `https://www.tiktok.com/@${handle}/video/${p.externalRef}`
            : account.url,
        }
  );
  return { videos, stories: [] };
}

function toStoredItem(p: ProfilePostItem): HesapGunlukItem {
  return {
    url: p.url,
    contentType: p.contentType || "reels",
    title: p.title?.trim().slice(0, 100) || undefined,
    thumbnailUrl: p.thumbnailUrl?.trim() || undefined,
    views: p.views ?? null,
    publishedAt: p.publishedAt ?? null,
  };
}

function rowFromActivity(
  account: YeniHesapAccount,
  day: string,
  activity: { videos: ProfilePostItem[]; stories: ProfilePostItem[] } | null,
  error?: string
): HesapGunlukRow {
  const base: HesapGunlukRow = {
    platform: account.platform,
    handle: account.handle,
    url: account.url,
    tag: account.tag,
    kind: "none",
    count: 0,
    storyCount: 0,
    videoCount: 0,
    latestAt: null,
    sampleUrl: null,
    sampleThumb: null,
    items: [],
  };
  if (error) {
    return { ...base, kind: "error", error };
  }
  if (!activity) return base;
  const videos = activity.videos.filter(
    (p) => isVideoLike(p) && isoOnIstanbulDay(p.publishedAt, day)
  );
  const stories = activity.stories.filter((p) => isoOnIstanbulDay(p.publishedAt, day));
  const videoCount = videos.length;
  const storyCount = stories.length;
  const all = [...videos, ...stories];
  all.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const latest = all[0];
  const items = all.slice(0, MAX_ITEMS_PER_ROW).map(toStoredItem);
  return {
    ...base,
    kind:
      storyCount > 0 && videoCount === 0
        ? "story"
        : videoCount > 0 || storyCount > 0
          ? "video"
          : "none",
    count: videoCount + storyCount,
    videoCount,
    storyCount,
    latestAt: latest?.publishedAt ?? null,
    sampleUrl: latest?.url ?? null,
    sampleThumb: latest?.thumbnailUrl ?? items[0]?.thumbnailUrl ?? null,
    items,
  };
}

async function fetchAccountSafe(
  account: YeniHesapAccount
): Promise<{ activity: { videos: ProfilePostItem[]; stories: ProfilePostItem[] } | null; error?: string }> {
  try {
    return { activity: await fetchRecentActivity(account) };
  } catch (e) {
    return {
      activity: null,
      error: e instanceof Error ? e.message.slice(0, 160) : String(e).slice(0, 160),
    };
  }
}

async function scanAllAccounts(): Promise<
  { account: YeniHesapAccount; activity: { videos: ProfilePostItem[]; stories: ProfilePostItem[] } | null; error?: string }[]
> {
  const out: {
    account: YeniHesapAccount;
    activity: { videos: ProfilePostItem[]; stories: ProfilePostItem[] } | null;
    error?: string;
  }[] = [];
  let igPaused = false;
  for (const account of YENI_HESAPLAR) {
    if (account.platform === "Instagram" && igPaused) {
      out.push({
        account,
        activity: null,
        error: "Instagram günlük kota doldu — yarın tekrar denenecek",
      });
      continue;
    }
    const result = await fetchAccountSafe(account);
    out.push({ account, ...result });
    if (account.platform === "Instagram") {
      if (result.error && isQuotaError(result.error)) igPaused = true;
      await sleep(800);
    } else {
      await sleep(200);
    }
  }
  return out;
}

function buildReportFromScan(
  day: string,
  scan: Awaited<ReturnType<typeof scanAllAccounts>>,
  opts: { triggeredBy: "cron" | "manual"; final: boolean; notified?: boolean }
): HesapGunlukReport {
  const rows = scan.map(({ account, activity, error }) =>
    rowFromActivity(account, day, activity, error)
  );
  return {
    date: day,
    checkedAt: new Date().toISOString(),
    rows,
    posted: rows.filter((r) => r.kind === "video" || r.kind === "story").length,
    missing: rows.filter((r) => r.kind === "none").length,
    errors: rows.filter((r) => r.kind === "error").length,
    triggeredBy: opts.triggeredBy,
    final: opts.final,
    notified: opts.notified ?? false,
  };
}

async function scanAll(day: string): Promise<HesapGunlukRow[]> {
  const scan = await scanAllAccounts();
  return scan.map(({ account, activity, error }) =>
    rowFromActivity(account, day, activity, error)
  );
}

function stripHeavyItems(report: HesapGunlukReport): HesapGunlukReport {
  return {
    ...report,
    rows: report.rows.map((r) => ({
      ...r,
      items: undefined,
      sampleThumb: r.sampleThumb ?? null,
    })),
  };
}

function pruneHistory(byDate: Record<string, HesapGunlukReport>): Record<string, HesapGunlukReport> {
  const keys = Object.keys(byDate).sort();
  let next = { ...byDate };
  if (keys.length > HISTORY_DAYS) {
    const drop = keys.slice(0, keys.length - HISTORY_DAYS);
    for (const k of drop) delete next[k];
  }
  const today = hesapGunlukIstanbulDate();
  const detailFrom = shiftIstanbulDay(today, -(DETAIL_DAYS - 1));
  for (const [date, report] of Object.entries(next)) {
    if (date < detailFrom) next[date] = stripHeavyItems(report);
  }
  return next;
}

function normalizeStore(raw: unknown): HesapGunlukStore {
  if (!raw || typeof raw !== "object") return { byDate: {}, latestDate: null, lastBackfillAt: null };
  const o = raw as Record<string, unknown>;
  // Eski tek-rapor formatı
  if (typeof o.date === "string" && Array.isArray(o.rows)) {
    const report = o as unknown as HesapGunlukReport;
    return { byDate: { [report.date]: report }, latestDate: report.date, lastBackfillAt: null };
  }
  const byDate =
    o.byDate && typeof o.byDate === "object"
      ? (o.byDate as Record<string, HesapGunlukReport>)
      : {};
  return {
    byDate,
    latestDate: typeof o.latestDate === "string" ? o.latestDate : Object.keys(byDate).sort().at(-1) ?? null,
    lastBackfillAt: typeof o.lastBackfillAt === "string" ? o.lastBackfillAt : null,
  };
}

export async function loadHesapGunlukStore(): Promise<HesapGunlukStore> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", HESAP_GUNLUK_SETTINGS_KEY)
    .maybeSingle();
  return normalizeStore(data?.value);
}

export async function loadHesapGunlukReport(date?: string): Promise<HesapGunlukReport | null> {
  const store = await loadHesapGunlukStore();
  if (date) return store.byDate[date] ?? null;
  if (!store.latestDate) return null;
  return store.byDate[store.latestDate] ?? null;
}

async function saveStore(store: HesapGunlukStore): Promise<void> {
  const db = getSupabaseAdmin();
  const value: HesapGunlukStore = {
    byDate: pruneHistory(store.byDate),
    latestDate: store.latestDate,
    lastBackfillAt: store.lastBackfillAt ?? null,
  };
  const { error } = await db.from("app_settings").upsert(
    {
      key: HESAP_GUNLUK_SETTINGS_KEY,
      value,
      updated_at: new Date().toISOString(),
      updated_by: MAIN_ADMIN_ID,
    },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
}

/**
 * Cron (gece 00:00): bir önceki günü kesin tarar.
 * Manuel: varsayılan bugünü ara kontrol (final=false); date verilirse o günü tarar.
 */
export async function runHesapGunlukAktivite(opts: {
  triggeredBy: "cron" | "manual";
  /** Hangi gün taranacak. Cron için boş bırak → dün. */
  date?: string;
  final?: boolean;
  notify?: boolean;
}): Promise<HesapGunlukReport> {
  if (!isRapidApiEnabled()) {
    throw new Error("RAPIDAPI_KEY yok — günlük kontrol yapılamaz.");
  }

  const today = hesapGunlukIstanbulDate();
  const day =
    opts.date ??
    (opts.triggeredBy === "cron" ? istanbulDayToClose() : today);
  const final =
    opts.final ??
    (opts.triggeredBy === "cron" || day < today);

  const store = await loadHesapGunlukStore();
  const existing = store.byDate[day];

  if (opts.triggeredBy === "cron" && existing?.final && existing.notified) {
    return existing;
  }

  const rows = await scanAll(day);
  const posted = rows.filter((r) => r.kind === "video" || r.kind === "story").length;
  const missing = rows.filter((r) => r.kind === "none").length;
  const errors = rows.filter((r) => r.kind === "error").length;
  const alreadyNotified = existing?.notified === true;
  const wantNotify =
    opts.notify === true || (opts.notify !== false && final && opts.triggeredBy === "cron" && !alreadyNotified);

  const report: HesapGunlukReport = {
    date: day,
    checkedAt: new Date().toISOString(),
    rows,
    posted,
    missing,
    errors,
    triggeredBy: opts.triggeredBy,
    final,
    notified: alreadyNotified,
  };

  if (wantNotify) {
    await notifyGunlukAktivite(report);
    report.notified = true;
  }

  store.byDate[day] = report;
  store.latestDate = day;
  await saveStore(store);
  return report;
}

export const HESAP_GUNLUK_BACKFILL_MAX = 21;

/**
 * Tek API turu ile son N günü takvime yazar (video/reel tarihine göre).
 * Hikaye yalnızca hâlâ canlıysa ilgili güne düşer; eski hikayeler API'de yok.
 */
export async function backfillHesapGunlukAktivite(opts?: {
  days?: number;
  triggeredBy?: "cron" | "manual";
}): Promise<{ store: HesapGunlukStore; filled: string[]; days: number }> {
  if (!isRapidApiEnabled()) {
    throw new Error("RAPIDAPI_KEY yok — geçmiş doldurulamaz.");
  }
  const today = hesapGunlukIstanbulDate();
  const days = Math.max(
    1,
    Math.min(opts?.days ?? 14, HESAP_GUNLUK_BACKFILL_MAX)
  );
  const dayList = istanbulDayRangeEnding(today, days);
  const scan = await scanAllAccounts();
  const store = await loadHesapGunlukStore();
  const filled: string[] = [];
  const triggeredBy = opts?.triggeredBy ?? "manual";

  for (const day of dayList) {
    const existing = store.byDate[day];
    const report = buildReportFromScan(day, scan, {
      triggeredBy,
      final: day < today,
      notified: existing?.notified === true,
    });
    store.byDate[day] = report;
    filled.push(day);
  }

  store.latestDate =
    store.byDate[today]?.date ??
    filled.at(-1) ??
    store.latestDate;
  store.lastBackfillAt = new Date().toISOString();
  await saveStore(store);
  return { store, filled, days };
}

export function formatReportText(report: HesapGunlukReport): string {
  const lines: string[] = [
    `Hesap günlük paylaşım · ${report.date}` + (report.final ? " (kesin)" : " (ara)"),
    `Paylaşan: ${report.posted} · Paylaşmayan: ${report.missing}` +
      (report.errors ? ` · Hata: ${report.errors}` : ""),
    "",
  ];
  const missing = report.rows.filter((r) => r.kind === "none");
  const posted = report.rows.filter((r) => r.kind === "video" || r.kind === "story");
  if (missing.length) {
    lines.push(report.final ? "Paylaşmayanlar:" : "Şu ana kadar paylaşmayanlar:");
    for (const r of missing) {
      const tag = r.tag ? ` [${HESAP_TAG_LABEL[r.tag]}]` : "";
      lines.push(`· ${r.platform} ${r.handle}${tag}`);
    }
    lines.push("");
  }
  if (posted.length) {
    lines.push("Paylaşanlar:");
    for (const r of posted) {
      const bits = [
        r.videoCount ? `${r.videoCount} video` : null,
        r.storyCount ? `${r.storyCount} hikaye` : null,
      ].filter(Boolean);
      const tag = r.tag ? ` [${HESAP_TAG_LABEL[r.tag]}]` : "";
      lines.push(`· ${r.platform} ${r.handle}${tag} — ${bits.join(", ")}`);
    }
  }
  return lines.join("\n");
}

async function notifyGunlukAktivite(report: HesapGunlukReport): Promise<void> {
  const db = getSupabaseAdmin();
  const title =
    report.missing === 0
      ? `${report.date}: tüm hesaplar paylaştı (${report.posted})`
      : `${report.date}: ${report.missing} hesap paylaşmadı`;
  const message = formatReportText(report);
  const notif: AppNotification = {
    id: `n-hesap-gunluk-${report.date}`,
    type: "general",
    title,
    message: message.slice(0, 900),
    forRole: "admin",
    forUserId: MAIN_ADMIN_ID,
    href: "/izlenme/yeni-hesaplar",
    refId: `hesap-gunluk:${report.date}`,
    createdAt: report.checkedAt,
    read: false,
  };
  const { data: existing } = await db
    .from("app_notifications")
    .select("id")
    .eq("ref_id", notif.refId ?? "")
    .limit(1);
  if (!existing?.length) {
    await db.from("app_notifications").insert(notificationToRow(notif));
  } else {
    await db
      .from("app_notifications")
      .update({
        title: notif.title,
        message: notif.message,
        read: false,
        created_at: notif.createdAt,
      })
      .eq("ref_id", notif.refId ?? "");
  }

  const chatId = getTelegramContentChatIdEnv();
  if (chatId) {
    await telegramSendMessage({ chatId, text: message }).catch(() => undefined);
  }
}

