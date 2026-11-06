import { parseMediaRef, youtubeThumbUrl, type MediaRef } from "@/lib/media-ref";
import { isSupabaseEnabled } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface FreeThumb {
  thumbnailUrl?: string;
  title?: string;
  /** Kısa TikTok linkinin çözülmüş video id'si. */
  videoId?: string;
}

const BUCKET = "link-thumbs";
const TTL_MS = 6 * 60 * 60 * 1000;
const MISS_TTL_MS = 30 * 60 * 1000;
const STORED_TTL_MS = 5 * 60 * 1000;
/** Art arda bu kadar boş yanıt gelirse platform bir süre denenmez (IP engeli). */
const BREAKER_FAILS = 6;
const BREAKER_PAUSE_MS = 15 * 60 * 1000;

const cache = new Map<string, { at: number; value: FreeThumb }>();
const misses = new Map<string, number>();
const breaker: Record<string, { fails: number; pausedUntil: number }> = {
  instagram: { fails: 0, pausedUntil: 0 },
  tiktok: { fails: 0, pausedUntil: 0 },
};
let stored: { at: number; names: Set<string> } | null = null;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

function decodeHtml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function metaContent(html: string, prop: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i");
  const m = html.match(re);
  const v = m?.[1] ? decodeHtml(m[1]).trim() : "";
  return v || undefined;
}

async function fetchText(url: string, ua: string, timeoutMs = 8000): Promise<{ text: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": ua, "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return { text: await res.text(), finalUrl: res.url };
  } catch {
    return null;
  }
}

function objectName(ref: MediaRef): string {
  const id = ref.id.replace(/[^A-Za-z0-9_-]/g, "");
  return `${ref.platform}/${ref.shortLink ? "s_" : ""}${id}.jpg`;
}

function publicUrl(name: string): string {
  return getSupabaseAdmin().storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
}

let storedLoading: Promise<Set<string>> | null = null;

function storedNames(): Promise<Set<string>> {
  if (stored && Date.now() - stored.at < STORED_TTL_MS) return Promise.resolve(stored.names);
  storedLoading ??= loadStoredNames().finally(() => {
    storedLoading = null;
  });
  return storedLoading;
}

async function loadStoredNames(): Promise<Set<string>> {
  const names = new Set<string>();
  if (!isSupabaseEnabled()) return names;
  const bucket = getSupabaseAdmin().storage.from(BUCKET);
  for (const folder of ["instagram", "tiktok"]) {
    for (let offset = 0; offset < 20000; offset += 1000) {
      const { data, error } = await bucket.list(folder, { limit: 1000, offset });
      if (error || !data) break;
      for (const f of data) names.add(`${folder}/${f.name}`);
      if (data.length < 1000) break;
    }
  }
  stored = { at: Date.now(), names };
  return names;
}

/** Kapak görselini kalıcı depoya kopyalar; CDN imzalı linklerinin süresi dolsa da görünür kalır. */
async function persistImage(ref: MediaRef, imageUrl: string): Promise<string | null> {
  if (!isSupabaseEnabled()) return null;
  try {
    const res = await fetch(imageUrl, { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(8000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength < 500 || bytes.byteLength > 2_000_000) return null;
    const name = objectName(ref);
    const { error } = await getSupabaseAdmin()
      .storage.from(BUCKET)
      .upload(name, bytes, { contentType: type.split(";")[0], upsert: true, cacheControl: "604800" });
    if (error) return null;
    stored?.names.add(name);
    return publicUrl(name);
  } catch {
    return null;
  }
}

export async function persistThumbForUrl(url: string, imageUrl: string): Promise<void> {
  const ref = parseMediaRef(url);
  if (!ref || ref.platform === "youtube" || !imageUrl) return;
  const names = await storedNames().catch(() => new Set<string>());
  if (names.has(objectName(ref))) return;
  await persistImage(ref, imageUrl);
}

async function tiktokThumb(ref: MediaRef, url: string): Promise<FreeThumb> {
  let canonical = url;
  let videoId = ref.shortLink ? undefined : ref.id;
  if (ref.shortLink) {
    const page = await fetchText(url, BROWSER_UA);
    if (page) {
      canonical = page.finalUrl;
      videoId = canonical.match(/\/video\/(\d+)/)?.[1];
    }
  }
  {
    const oembed = await fetchText(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonical)}`,
      BROWSER_UA,
      5000
    );
    if (oembed?.text.startsWith("{")) {
      try {
        const j = JSON.parse(oembed.text) as { thumbnail_url?: string; title?: string; embed_product_id?: string };
        if (j.thumbnail_url) {
          return { thumbnailUrl: j.thumbnail_url, title: j.title?.trim() || undefined, videoId: videoId ?? j.embed_product_id };
        }
      } catch {
        /* og:image ile devam */
      }
    }
  }
  const page = await fetchText(canonical, CRAWLER_UA, 6000);
  if (!page) return { videoId };
  return {
    thumbnailUrl: metaContent(page.text, "og:image"),
    title: metaContent(page.text, "og:title"),
    videoId: videoId ?? page.finalUrl.match(/\/video\/(\d+)/)?.[1],
  };
}

async function instagramThumb(ref: MediaRef): Promise<FreeThumb> {
  const page = await fetchText(`https://www.instagram.com/reel/${ref.id}/`, CRAWLER_UA);
  if (!page) return {};
  const title = metaContent(page.text, "og:title") ?? metaContent(page.text, "og:description");
  return { thumbnailUrl: metaContent(page.text, "og:image"), title };
}

export async function resolveFreeThumb(url: string): Promise<FreeThumb> {
  const ref = parseMediaRef(url);
  if (!ref) return {};
  if (ref.platform === "youtube") return { thumbnailUrl: youtubeThumbUrl(ref.id) };

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const name = objectName(ref);
  const names = await storedNames().catch(() => new Set<string>());
  if (names.has(name)) {
    const value = { thumbnailUrl: publicUrl(name), videoId: ref.shortLink ? undefined : ref.id };
    cache.set(url, { at: Date.now(), value });
    return value;
  }

  const missAt = misses.get(url);
  if (missAt && Date.now() - missAt < MISS_TTL_MS) return {};
  const brk = breaker[ref.platform];
  if (brk && Date.now() < brk.pausedUntil) return {};

  const live = ref.platform === "tiktok" ? await tiktokThumb(ref, url) : await instagramThumb(ref);
  if (!live.thumbnailUrl) {
    misses.set(url, Date.now());
    if (brk && ++brk.fails >= BREAKER_FAILS) {
      brk.pausedUntil = Date.now() + BREAKER_PAUSE_MS;
      brk.fails = 0;
    }
    return live.videoId ? { videoId: live.videoId } : {};
  }
  if (brk) brk.fails = 0;
  const permanent = await persistImage(ref, live.thumbnailUrl);
  const value = { ...live, thumbnailUrl: permanent ?? live.thumbnailUrl };
  cache.set(url, { at: Date.now(), value });
  return value;
}

export async function resolveFreeThumbs(urls: string[], concurrency = 8): Promise<Record<string, FreeThumb>> {
  const out: Record<string, FreeThumb> = {};
  const queue = [...new Set(urls)];
  async function worker() {
    for (;;) {
      const url = queue.shift();
      if (!url) return;
      out[url] = await resolveFreeThumb(url);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return out;
}
