/** Ajansın yeni profil hesapları. Eski marka linkleri bu markaya taşınmaz. */
export const YENI_HESAPLAR_BRAND_ID = "br-yeni-hesaplar";

export type YeniHesapPlatform = "Instagram" | "YouTube" | "TikTok";
export type HesapTag = "naz" | "ponpon";

export interface YeniHesapAccount {
  platform: YeniHesapPlatform;
  handle: string;
  url: string;
  /** Moderasyon / sahiplik etiketi — UI’de hesap yanında görünür. */
  tag?: HesapTag;
}

function ig(handle: string, tag?: HesapTag): YeniHesapAccount {
  return {
    platform: "Instagram",
    handle: `@${handle}`,
    url: `https://www.instagram.com/${handle}/`,
    tag,
  };
}

function yt(handle: string, tag?: HesapTag): YeniHesapAccount {
  return {
    platform: "YouTube",
    handle: `@${handle}`,
    url: `https://www.youtube.com/@${handle}`,
    tag,
  };
}

function tt(handle: string, tag?: HesapTag): YeniHesapAccount {
  return {
    platform: "TikTok",
    handle: `@${handle}`,
    url: `https://www.tiktok.com/@${handle}`,
    tag,
  };
}

/**
 * Takip edilen IG / YT / TT profilleri.
 * Naz / Ponpon etiketli hesaplar moderatör sorumluluğunu gösterir.
 */
export const YENI_HESAPLAR: YeniHesapAccount[] = [
  // Instagram — ajans
  ig("ramiznurcinoffical"),
  ig("lanetkelvlog"),
  ig("lanetkel31"),
  ig("lanetkelpromax"),
  ig("lanetlikeltos"),
  ig("lanetkeltv"),
  ig("keladamkomedi", "naz"),
  ig("lanetkelindunyasi", "ponpon"),
  ig("mizahlanetkel"),
  ig("lanetkelkomedi"),
  ig("lanetkelsakso"),
  // Instagram — Naz / Ponpon ekstra
  ig("lanetkel.toon", "naz"),
  ig("sifabilgibirikim", "ponpon"),
  // YouTube — ajans
  yt("lanetkelben"),
  yt("lanetkeltur"),
  yt("lanetkelvlog"),
  yt("lanetkelreis"),
  // YouTube — Naz / Ponpon
  yt("handekorkusuz", "naz"),
  yt("roblooxmeryeeemmm", "ponpon"),
  // TikTok — ajans
  tt("lanetkeltv"),
  tt("ramiznurcin"),
  tt("lanetkeli"),
  // TikTok — Naz / Ponpon
  tt("erdemhesap1", "naz"),
  tt("mehmet_47_07_", "ponpon"),
];

/** Telegram / Facebook / Pornhub — ölçüm dışı, yayıncı hesap defteri. */
export type AjansDigerPlatform = "Telegram" | "Facebook" | "Diğer";

export interface AjansDigerHesap {
  platform: AjansDigerPlatform;
  handle: string;
  url: string;
  notes: string;
}

export const AJANS_DIGER_HESAPLAR: AjansDigerHesap[] = [
  { platform: "Telegram", handle: "lanetkelhub", url: "https://t.me/lanetkelhub", notes: "Hub kanalı" },
  { platform: "Telegram", handle: "lanetkeltv", url: "https://t.me/lanetkeltv", notes: "Yetişkin içeriği kanalı" },
  { platform: "Telegram", handle: "lanetkelchat", url: "https://t.me/lanetkelchat", notes: "Sohbet kanalı" },
  { platform: "Telegram", handle: "lanetkelhouse", url: "https://t.me/lanetkelhouse", notes: "" },
  { platform: "Telegram", handle: "lanetkelclub", url: "https://t.me/lanetkelclub", notes: "" },
  { platform: "Telegram", handle: "lanetkelprime", url: "https://t.me/lanetkelprime", notes: "" },
  { platform: "Telegram", handle: "lanetkelyayin", url: "https://t.me/lanetkelyayin", notes: "" },
  { platform: "Telegram", handle: "lanetkelbetting", url: "https://t.me/lanetkelbetting", notes: "" },
  { platform: "Telegram", handle: "lanetkelspin", url: "https://t.me/lanetkelspin", notes: "" },
  { platform: "Telegram", handle: "lanetkeltahmin", url: "https://t.me/lanetkeltahmin", notes: "" },
  { platform: "Telegram", handle: "lanetkeli", url: "https://t.me/lanetkeli", notes: "" },
  {
    platform: "Facebook",
    handle: "lanetkel",
    url: "https://www.facebook.com/share/1Cr2CQivNi",
    notes: "Facebook profil",
  },
  {
    platform: "Diğer",
    handle: "lanetkel",
    url: "https://www.pornhub.com/model/lanetkel",
    notes: "Yetişkin model profili",
  },
];

export const HESAP_TAG_LABEL: Record<HesapTag, string> = {
  naz: "Naz",
  ponpon: "Ponpon",
};

export function notesForYeniHesap(account: YeniHesapAccount): string {
  if (account.tag === "naz") return "Naz";
  if (account.tag === "ponpon") return "Ponpon";
  return "Yeni hesap";
}

export function parseHesapTag(notes?: string | null): HesapTag | null {
  const n = (notes ?? "").trim().toLowerCase();
  if (n === "naz") return "naz";
  if (n === "ponpon") return "ponpon";
  return null;
}

export function yeniHesapLinkId(account: YeniHesapAccount): string {
  const slug = account.handle.replace(/^@/, "").toLowerCase();
  const platform = account.platform.toLowerCase();
  return `bl-yh-${platform}-${slug}`;
}

export function isYeniHesaplarBrandId(brandId: string | null | undefined): boolean {
  return brandId === YENI_HESAPLAR_BRAND_ID;
}

const GENERIC_HANDLES = new Set([
  "tiktok",
  "youtube",
  "instagram",
  "kick",
  "twitter",
  "x",
]);

function cleanHandle(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/^@/, "").toLowerCase();
}

function handleFromUrl(url: string | undefined, platform: string): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const parts = u.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
    const p = platform.toLowerCase();
    if (host.includes("tiktok") || p.includes("tiktok")) {
      const at = parts.find((part) => part.startsWith("@"));
      if (at) return cleanHandle(at);
      // Kısa link (vt/vm) ve video yolu hesap değil; /lanetkeli gibi çıplak profil yolu kabul.
      if (host.startsWith("vt.") || host.startsWith("vm.") || host.includes("vm.tiktok")) return "";
      const first = parts[0] ?? "";
      const reserved = new Set(["video", "photo", "t", "music", "tag", "discover", "foryou", "live"]);
      if (!first || reserved.has(first.toLowerCase())) return "";
      if (/^[\w.-]{2,40}$/.test(first)) return cleanHandle(first);
      return "";
    }
    if (host.includes("youtube") || host === "youtu.be" || p.includes("youtube")) {
      const at = parts.find((part) => part.startsWith("@"));
      return at ? cleanHandle(at) : "";
    }
    if (host.includes("instagram") || p.includes("instagram")) {
      const first = parts[0] ?? "";
      const reserved = new Set(["p", "reel", "reels", "stories", "tv", "explore", "share"]);
      if (!first || reserved.has(first.toLowerCase())) return "";
      return cleanHandle(first);
    }
  } catch {
    return "";
  }
  return "";
}

/** Linkten hesap kimliği. Video id ve boş handle hesap sayılmaz. */
export function accountIdentityFromLink(link: {
  platform: string;
  handle?: string;
  url?: string;
}): { platform: string; handle: string } | null {
  const fromUrl = handleFromUrl(link.url, link.platform);
  const fromHandle = cleanHandle(link.handle);
  const handle =
    fromUrl ||
    (fromHandle && !GENERIC_HANDLES.has(fromHandle) && !/^\d{5,}$/.test(fromHandle)
      ? fromHandle
      : "");
  if (!handle) return null;
  const platform = link.platform?.trim() || "Diğer";
  return { platform, handle };
}

/**
 * Aktif hesap: API bu linkten sayı döndürmüş.
 * Kota, hata veya hiç ölçülmemiş kayıtlar aktif sayılmaz.
 */
export function isApiFetchedAccount(link: {
  status?: string;
  url?: string;
  lastViews?: number | null;
  lastCheckedAt?: string | null;
  lastCheckError?: string | null;
  lastRefreshStatus?: string | null;
}): boolean {
  if (link.status && link.status !== "active") return false;
  if (!link.url?.trim()) return false;
  if (link.lastViews == null || !Number.isFinite(Number(link.lastViews))) return false;
  if (link.lastRefreshStatus && link.lastRefreshStatus !== "ok") return false;
  if (link.lastCheckError?.trim()) return false;
  if (link.lastRefreshStatus !== "ok" && !link.lastCheckedAt) return false;
  return true;
}

/** Instagram profilinde saklanan sayı takipçidir; YouTube/TikTok izlenmedir. */
export function yeniHesapPrimaryMetricLabel(platform: string): string {
  return platform.toLowerCase().includes("instagram") ? "Takipçi" : "İzlenme";
}

export function yeniHesapSecondaryMetricLabel(platform: string): string | null {
  const p = platform.toLowerCase();
  if (p.includes("youtube")) return "Abone";
  if (p.includes("tiktok")) return "Takipçi";
  return null;
}
