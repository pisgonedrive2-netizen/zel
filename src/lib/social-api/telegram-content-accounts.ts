import { allowsPersonalAccountSync } from "@/lib/active-streamers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type TelegramWatchAccount = {
  id: string;
  employeeId: string;
  employeeName: string;
  platform: string;
  handle: string;
  url: string;
  status: string;
};

export type TelegramAccountPayload = {
  watched: TelegramWatchAccount[];
  available: TelegramWatchAccount[];
  implicitAll: boolean;
  employees: Array<{ id: string; name: string }>;
};

const WATCH_PLATFORMS = ["YouTube", "Instagram", "TikTok"] as const;

export function parseTelegramAccountIds(v: unknown): string[] | null {
  if (v == null) return null;
  if (!Array.isArray(v)) return null;
  return [...new Set(v.map((x) => String(x ?? "").trim()).filter(Boolean))];
}

export function isTelegramAccountWatched(
  accountId: string,
  accountIds: string[] | null | undefined
): boolean {
  const id = accountId.trim();
  if (!id) return false;
  if (accountIds == null) return true;
  return accountIds.includes(id);
}

export function isTelegramAchievementPlatform(platform: string): boolean {
  const p = platform.toLowerCase();
  return p.includes("youtube") || p.includes("instagram") || p.includes("tiktok");
}

export function canonicalWatchPlatform(platform: string): (typeof WATCH_PLATFORMS)[number] | null {
  const p = platform.toLowerCase();
  if (p.includes("youtube")) return "YouTube";
  if (p.includes("instagram")) return "Instagram";
  if (p.includes("tiktok")) return "TikTok";
  return null;
}

export function profileUrlFromHandle(platform: string, handle: string, url?: string): string {
  const given = (url ?? "").trim();
  if (given) return given;
  const h = handle.replace(/^@/, "").trim();
  if (!h) return "";
  const p = platform.toLowerCase();
  if (p.includes("instagram")) return `https://www.instagram.com/${h}/`;
  if (p.includes("tiktok")) return `https://www.tiktok.com/@${h}`;
  if (p.includes("youtube")) return `https://www.youtube.com/@${h}`;
  return "";
}

export function normalizeSocialHandle(handle: string): string {
  return handle.replace(/^@/, "").trim().toLowerCase();
}

export type TelegramForwardSpec = {
  id: string;
  platform: (typeof WATCH_PLATFORMS)[number];
  handle: string;
  url: string;
};

/** Telegram botunun tarayıp ileteceği resmi hesap listesi (Ramiz). */
export const TELEGRAM_FORWARD_CATALOG: TelegramForwardSpec[] = [
  {
    id: "sa-ramiz-ig-official",
    platform: "Instagram",
    handle: "ramiz.nurcinofficial",
    url: "https://www.instagram.com/ramiz.nurcinofficial/",
  },
  {
    id: "sa-ramiz-ig-lanetkelim",
    platform: "Instagram",
    handle: "lanetkelim",
    url: "https://www.instagram.com/lanetkelim/",
  },
  {
    id: "sa-ramiz-ig-vlog",
    platform: "Instagram",
    handle: "lanetkelvlog",
    url: "https://www.instagram.com/lanetkelvlog/",
  },
  {
    id: "sa-ramiz-ig-ordinaryuskel",
    platform: "Instagram",
    handle: "ordinaryuskel",
    url: "https://www.instagram.com/ordinaryuskel/",
  },
  {
    id: "sa-ramiz-yt-ben",
    platform: "YouTube",
    handle: "lanetkelben",
    url: "https://www.youtube.com/@lanetkelben",
  },
  {
    id: "sa-ramiz-1",
    platform: "YouTube",
    handle: "lanetkeltur",
    url: "https://www.youtube.com/@lanetkeltur",
  },
  {
    id: "sa-ramiz-yt-vlog",
    platform: "YouTube",
    handle: "lanetkelvlog",
    url: "https://www.youtube.com/@lanetkelvlog",
  },
  {
    id: "sa-ramiz-tt-official",
    platform: "TikTok",
    handle: "ramiz.nurcinofficial",
    url: "https://www.tiktok.com/@ramiz.nurcinofficial",
  },
  {
    id: "sa-ramiz-tt-benim",
    platform: "TikTok",
    handle: "lanetkelbenim",
    url: "https://www.tiktok.com/@lanetkelbenim",
  },
  {
    id: "sa-ramiz-tt-kelyiyici",
    platform: "TikTok",
    handle: "kelyiyici",
    url: "https://www.tiktok.com/@kelyiyici",
  },
  {
    id: "sa-ramiz-tt-tv",
    platform: "TikTok",
    handle: "lanetkeltv",
    url: "https://www.tiktok.com/@lanetkeltv",
  },
  {
    id: "sa-ramiz-tt-ramiz",
    platform: "TikTok",
    handle: "ramiznurcin",
    url: "https://www.tiktok.com/@ramiznurcin",
  },
  {
    id: "sa-ramiz-tt-storiyliksozle",
    platform: "TikTok",
    handle: "storiyliksozle_r",
    url: "https://www.tiktok.com/@storiyliksozle_r",
  },
  {
    id: "sa-ramiz-tt-plus",
    platform: "TikTok",
    handle: "lanetkelplus",
    url: "https://www.tiktok.com/@lanetkelplus",
  },
  {
    id: "sa-ramiz-tt-oficial",
    platform: "TikTok",
    handle: "lanetkeloficial",
    url: "https://www.tiktok.com/@lanetkeloficial",
  },
];

export function matchCatalogAccountId(
  spec: TelegramForwardSpec,
  accounts: Array<{ id: string; platform: string; handle: string }>
): string | null {
  const want = normalizeSocialHandle(spec.handle);
  const hit = accounts.find(
    (a) =>
      canonicalWatchPlatform(a.platform) === spec.platform &&
      normalizeSocialHandle(a.handle) === want
  );
  return hit?.id ?? null;
}

/** Katalogdaki IG/YT/TT hesaplarını DB'de garantiler; mevcut satırları yeniden kullanır. */
export async function ensureTelegramForwardCatalog(
  employeeId = "emp-ramiz"
): Promise<string[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("streamer_accounts")
    .select("id, platform, handle, url, status")
    .eq("employee_id", employeeId);
  if (error) throw new Error(error.message);
  const existing = (data ?? []) as Array<{
    id: string;
    platform: string;
    handle: string;
    url: string;
    status: string;
  }>;
  const ids: string[] = [];
  for (const spec of TELEGRAM_FORWARD_CATALOG) {
    const found = matchCatalogAccountId(spec, existing);
    if (found) {
      ids.push(found);
      continue;
    }
    const { error: insErr } = await db.from("streamer_accounts").insert({
      id: spec.id,
      employee_id: employeeId,
      platform: spec.platform,
      handle: spec.handle,
      url: spec.url,
      notes: "Telegram içerik botu",
      status: "active",
    });
    if (insErr) throw new Error(insErr.message);
    existing.push({
      id: spec.id,
      platform: spec.platform,
      handle: spec.handle,
      url: spec.url,
      status: "active",
    });
    ids.push(spec.id);
  }
  return ids;
}

type AccountRow = {
  id: string;
  employee_id: string;
  platform: string;
  handle: string;
  url: string;
  status: string;
};

async function loadEligibleAccounts(): Promise<{
  accounts: TelegramWatchAccount[];
  employees: Array<{ id: string; name: string }>;
}> {
  const db = getSupabaseAdmin();
  const [{ data: empRows, error: empErr }, { data: accRows, error: accErr }] = await Promise.all([
    db.from("employees").select("id, name, status, kind").eq("status", "active"),
    db.from("streamer_accounts").select("id, employee_id, platform, handle, url, status"),
  ]);
  if (empErr) throw new Error(empErr.message);
  if (accErr) throw new Error(accErr.message);

  const employees = ((empRows ?? []) as Array<{ id: string; name: string; kind?: string }>)
    .filter((e) => allowsPersonalAccountSync(e.id))
    .map((e) => ({ id: String(e.id), name: String(e.name ?? "").trim() || String(e.id) }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const empName = new Map(employees.map((e) => [e.id, e.name]));
  const accounts = ((accRows ?? []) as AccountRow[])
    .filter((a) => isTelegramAchievementPlatform(a.platform))
    .filter((a) => allowsPersonalAccountSync(a.employee_id))
    .filter((a) => empName.has(String(a.employee_id)))
    .map((a) => ({
      id: String(a.id),
      employeeId: String(a.employee_id),
      employeeName: empName.get(String(a.employee_id)) ?? String(a.employee_id),
      platform: String(a.platform),
      handle: String(a.handle ?? ""),
      url: String(a.url ?? ""),
      status: String(a.status ?? "active"),
    }))
    .sort((a, b) =>
      `${a.employeeName} ${a.platform} ${a.handle}`.localeCompare(
        `${b.employeeName} ${b.platform} ${b.handle}`,
        "tr"
      )
    );

  return { accounts, employees };
}

export async function listTelegramContentAccounts(accountIds: string[] | null | undefined): Promise<TelegramAccountPayload> {
  const { accounts, employees } = await loadEligibleAccounts();
  const implicitAll = accountIds == null;
  const watched = accounts.filter((a) => isTelegramAccountWatched(a.id, accountIds));
  const watchedIds = new Set(watched.map((a) => a.id));
  const available = implicitAll ? [] : accounts.filter((a) => !watchedIds.has(a.id));
  return { watched, available, implicitAll, employees };
}

export async function idsAfterRemoveAccount(
  current: string[] | null | undefined,
  accountId: string
): Promise<string[]> {
  const id = accountId.trim();
  if (current == null) {
    const { accounts } = await loadEligibleAccounts();
    return accounts.map((a) => a.id).filter((x) => x !== id);
  }
  return current.filter((x) => x !== id);
}

export function idsAfterAddAccount(current: string[] | null | undefined, accountId: string): string[] | null {
  const id = accountId.trim();
  if (current == null) return null;
  if (current.includes(id)) return current;
  return [...current, id];
}

export const TELEGRAM_AUTO_ENQUEUE_MAX_HOURS = 4;

/** Yeni taramada eski arşivi gruba basmamak için — yalnızca taze gönderi kuyruğa girer. */
export function isFreshEnoughForTelegram(
  publishedAt: string,
  nowMs = Date.now(),
  maxHours = TELEGRAM_AUTO_ENQUEUE_MAX_HOURS
): boolean {
  const t = Date.parse(publishedAt);
  if (!Number.isFinite(t)) return true;
  const age = nowMs - t;
  return age <= maxHours * 3600_000 && age >= -5 * 60_000;
}

const POLL_HOT_HANDLES = new Set(["lanetkelvlog"]);

/** Telegram cron'unun RapidAPI ile tarayacağı hesaplar — vlog / Reels önce. */
export function pickTelegramPollAccountIds(
  watched: Array<{ id: string; handle: string; platform: string; status?: string }>,
  max = 20
): string[] {
  const active = watched.filter((a) => (a.status ?? "active") === "active");
  const score = (a: { handle: string; platform: string }) => {
    const h = a.handle.replace(/^@/, "").toLowerCase();
    if (POLL_HOT_HANDLES.has(h)) return 0;
    if (/instagram/i.test(a.platform)) return 1;
    if (/tiktok/i.test(a.platform)) return 2;
    return 3;
  };
  return [...active]
    .sort((a, b) => score(a) - score(b) || a.handle.localeCompare(b.handle, "tr"))
    .slice(0, max)
    .map((a) => a.id);
}

export async function createTelegramWatchAccount(opts: {
  employeeId: string;
  platform: string;
  handle: string;
  url?: string;
}): Promise<TelegramWatchAccount> {
  const employeeId = opts.employeeId.trim();
  const platform = canonicalWatchPlatform(opts.platform);
  const handle = opts.handle.replace(/^@/, "").trim();
  if (!employeeId) throw new Error("Yayıncı seçin");
  if (!platform) throw new Error("YouTube / Instagram / TikTok seçin");
  if (!handle) throw new Error("Kullanıcı adı gerekli");
  if (!allowsPersonalAccountSync(employeeId)) {
    throw new Error("Bu yayıncının kişisel hesabı taranmaz");
  }

  const url = profileUrlFromHandle(platform, handle, opts.url);
  const db = getSupabaseAdmin();
  const { data: emp, error: empErr } = await db
    .from("employees")
    .select("id, name, status")
    .eq("id", employeeId)
    .maybeSingle();
  if (empErr) throw new Error(empErr.message);
  if (!emp || String((emp as { status?: string }).status) !== "active") {
    throw new Error("Yayıncı bulunamadı");
  }

  const account: TelegramWatchAccount = {
    id: `sa-${crypto.randomUUID().slice(0, 12)}`,
    employeeId,
    employeeName: String((emp as { name?: string }).name ?? "").trim() || employeeId,
    platform,
    handle,
    url,
    status: "active",
  };

  const { error } = await db.from("streamer_accounts").insert({
    id: account.id,
    employee_id: account.employeeId,
    platform: account.platform,
    handle: account.handle,
    url: account.url,
    notes: "Telegram içerik botu",
    status: "active",
  });
  if (error) throw new Error(error.message);
  return account;
}
