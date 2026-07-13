import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fmtCompactViews } from "@/lib/brand-month-metrics";

export type LandingGalleryPlatform = "youtube" | "tiktok" | "instagram" | "other";

export type LandingGalleryItem = {
  /** Stabil anahtar (platform + external id). */
  id: string;
  platform: LandingGalleryPlatform;
  /** Platform native id (YT videoId, TT video_id, IG shortcode). */
  externalId: string;
  url: string;
  brand: string;
  /** Ham izlenme sayısı (gösterim için). */
  views: number;
  /** Opsiyonel thumbnail URL. */
  thumbnailUrl?: string;
  /** Kart rengi (marka). */
  color: string;
  title?: string;
};

const SETTINGS_KEY = "landing.galleryItems";

const BRAND_COLORS: Record<string, string> = {
  Padişahbet: "#F59E0B",
  Betoffice: "#3B82F6",
  Galabet: "#22C55E",
  Hitbet: "#EC4899",
  Betpipo: "#8B5CF6",
};

/** Kodda sabit fallback — ayar yoksa kullanılır. */
export const DEFAULT_LANDING_GALLERY: LandingGalleryItem[] = [
  {
    id: "youtube:lsk5wAFGGpo",
    platform: "youtube",
    externalId: "lsk5wAFGGpo",
    url: "https://www.youtube.com/shorts/lsk5wAFGGpo",
    brand: "Padişahbet",
    views: 40_771_561,
    color: "#F59E0B",
    thumbnailUrl: "https://i.ytimg.com/vi/lsk5wAFGGpo/hqdefault.jpg",
  },
  {
    id: "youtube:rcSNWCZHX0k",
    platform: "youtube",
    externalId: "rcSNWCZHX0k",
    url: "https://www.youtube.com/shorts/rcSNWCZHX0k",
    brand: "Padişahbet",
    views: 1_056_714,
    color: "#F59E0B",
    thumbnailUrl: "https://i.ytimg.com/vi/rcSNWCZHX0k/hqdefault.jpg",
  },
  {
    id: "youtube:JVvF8iOLVgc",
    platform: "youtube",
    externalId: "JVvF8iOLVgc",
    url: "https://www.youtube.com/shorts/JVvF8iOLVgc",
    brand: "Padişahbet",
    views: 945_735,
    color: "#F59E0B",
    thumbnailUrl: "https://i.ytimg.com/vi/JVvF8iOLVgc/hqdefault.jpg",
  },
  {
    id: "youtube:SynH74Vs0SI",
    platform: "youtube",
    externalId: "SynH74Vs0SI",
    url: "https://www.youtube.com/shorts/SynH74Vs0SI",
    brand: "Padişahbet",
    views: 792_203,
    color: "#F59E0B",
    thumbnailUrl: "https://i.ytimg.com/vi/SynH74Vs0SI/hqdefault.jpg",
  },
];

export function brandColor(brand: string): string {
  return BRAND_COLORS[brand] ?? "#FF6B00";
}

export function galleryViewsLabel(views: number): string {
  return fmtCompactViews(views);
}

export function youtubeThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function parseGalleryUrl(raw: string): {
  platform: LandingGalleryPlatform;
  externalId: string;
  url: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname;

  if (host.includes("youtube.com") || host === "youtu.be") {
    let id = "";
    if (host === "youtu.be") id = path.replace(/^\//, "").split("/")[0] ?? "";
    else if (path.includes("/shorts/")) id = path.split("/shorts/")[1]?.split(/[/?#]/)[0] ?? "";
    else if (path.includes("/embed/")) id = path.split("/embed/")[1]?.split(/[/?#]/)[0] ?? "";
    else id = url.searchParams.get("v") ?? "";
    if (!id || id.length < 6) return null;
    return {
      platform: "youtube",
      externalId: id,
      url: `https://www.youtube.com/watch?v=${id}`,
    };
  }

  if (host.includes("tiktok.com")) {
    const m = path.match(/\/video\/(\d+)/);
    if (m?.[1]) {
      const handle = path.match(/@([^/]+)/)?.[1];
      return {
        platform: "tiktok",
        externalId: m[1],
        url: handle
          ? `https://www.tiktok.com/@${handle}/video/${m[1]}`
          : `https://www.tiktok.com/video/${m[1]}`,
      };
    }
    // vt.tiktok.com kısa link — id yoksa raw URL sakla
    if (host.startsWith("vt.") || host.startsWith("vm.")) {
      return { platform: "tiktok", externalId: trimmed, url: trimmed };
    }
    return null;
  }

  if (host.includes("instagram.com")) {
    const m = path.match(/\/(reel|reels|p|tv)\/([^/?#]+)/i);
    if (m?.[2]) {
      return {
        platform: "instagram",
        externalId: m[2],
        url: `https://www.instagram.com/reel/${m[2]}/`,
      };
    }
    return null;
  }

  return { platform: "other", externalId: trimmed, url: trimmed };
}

function isItem(v: unknown): v is LandingGalleryItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.platform === "string" &&
    typeof o.externalId === "string" &&
    typeof o.url === "string" &&
    typeof o.brand === "string" &&
    typeof o.views === "number" &&
    typeof o.color === "string"
  );
}

export function normalizeGalleryItems(raw: unknown): LandingGalleryItem[] {
  if (!Array.isArray(raw)) return [...DEFAULT_LANDING_GALLERY];
  const out: LandingGalleryItem[] = [];
  for (const row of raw) {
    if (!isItem(row)) continue;
    const platform = row.platform as LandingGalleryPlatform;
    const item: LandingGalleryItem = {
      id: row.id || `${platform}:${row.externalId}`,
      platform,
      externalId: row.externalId,
      url: row.url,
      brand: row.brand.trim() || "Foxstream",
      views: Math.max(0, Math.floor(Number(row.views) || 0)),
      color: row.color || brandColor(row.brand),
      title: row.title?.trim() || undefined,
      thumbnailUrl:
        row.thumbnailUrl?.trim() ||
        (platform === "youtube" ? youtubeThumb(row.externalId) : undefined),
    };
    out.push(item);
  }
  return out.length > 0 ? out.slice(0, 12) : [...DEFAULT_LANDING_GALLERY];
}

export async function getLandingGalleryItems(): Promise<LandingGalleryItem[]> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("app_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    if (error || data == null) return [...DEFAULT_LANDING_GALLERY];
    return normalizeGalleryItems((data as { value: unknown }).value);
  } catch {
    return [...DEFAULT_LANDING_GALLERY];
  }
}

export async function saveLandingGalleryItems(
  items: LandingGalleryItem[],
  updatedBy?: string
): Promise<LandingGalleryItem[]> {
  const next = normalizeGalleryItems(items);
  const { error } = await getSupabaseAdmin().from("app_settings").upsert(
    {
      key: SETTINGS_KEY,
      value: next,
      updated_by: updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
  return next;
}

export function embedSrc(item: LandingGalleryItem): string | null {
  if (item.platform === "youtube") {
    return `https://www.youtube.com/embed/${item.externalId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
  }
  if (item.platform === "tiktok" && /^\d+$/.test(item.externalId)) {
    return `https://www.tiktok.com/embed/v2/${item.externalId}`;
  }
  if (item.platform === "instagram") {
    return `https://www.instagram.com/reel/${item.externalId}/embed`;
  }
  return null;
}

export function buildItemFromParsed(opts: {
  url: string;
  brand?: string;
  views?: number;
  title?: string;
  thumbnailUrl?: string;
  color?: string;
}): LandingGalleryItem | null {
  const parsed = parseGalleryUrl(opts.url);
  if (!parsed) return null;
  const brand = opts.brand?.trim() || "Foxstream";
  return {
    id: `${parsed.platform}:${parsed.externalId}`,
    platform: parsed.platform,
    externalId: parsed.externalId,
    url: parsed.url,
    brand,
    views: Math.max(0, Math.floor(opts.views ?? 0)),
    color: opts.color || brandColor(brand),
    title: opts.title,
    thumbnailUrl:
      opts.thumbnailUrl ||
      (parsed.platform === "youtube" ? youtubeThumb(parsed.externalId) : undefined),
  };
}
