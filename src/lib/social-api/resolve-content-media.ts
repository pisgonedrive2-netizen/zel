import { rapidApiGet } from "./clients";
import { incrementUsage } from "./quota";
import { resolveLinkDetection } from "./platform-detect";
import {
  extractDirectVideoUrl,
  TELEGRAM_VIDEO_MAX_BYTES,
} from "./content-media-url";
import type { SocialPlatform } from "./config";

export type ResolvedMedia = {
  url: string;
  platform: SocialPlatform;
  downloadPreferred: boolean;
};

export async function resolveContentMediaUrl(opts: {
  contentUrl: string;
  platformHint?: string;
}): Promise<ResolvedMedia | null> {
  const detected = resolveLinkDetection({
    url: opts.contentUrl,
    platform: opts.platformHint,
  });
  if (!detected || detected.kind !== "video") return null;

  if (detected.platform === "youtube") {
    const raw = await rapidApiGet("youtube", "/video/streaming-data/", {
      id: detected.externalRef,
    });
    await incrementUsage("youtube", 1);
    const url = extractDirectVideoUrl(raw);
    if (!url) return null;
    return { url, platform: "youtube", downloadPreferred: true };
  }

  if (detected.platform === "tiktok") {
    const source =
      detected.sourceUrl?.trim() ||
      opts.contentUrl.trim() ||
      (detected.externalRef.match(/^\d+$/)
        ? `https://www.tiktok.com/video/${detected.externalRef}`
        : "");
    if (!source) return null;
    const raw = await rapidApiGet("tiktok", "/", { url: source, hd: "1" });
    await incrementUsage("tiktok", 1);
    const url = extractDirectVideoUrl(raw);
    if (!url) return null;
    return { url, platform: "tiktok", downloadPreferred: false };
  }

  if (detected.platform === "instagram") {
    const raw = await rapidApiGet("instagram", "/post", {
      shortcode: detected.externalRef,
    });
    await incrementUsage("instagram", 1);
    const url = extractDirectVideoUrl(raw);
    if (!url) return null;
    return { url, platform: "instagram", downloadPreferred: false };
  }

  return null;
}

export async function downloadVideoBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      accept: "*/*",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Video indirilemedi HTTP ${res.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > TELEGRAM_VIDEO_MAX_BYTES) {
    throw new Error(`Video ${Math.round(len / 1e6)}MB — Telegram limiti ~50MB`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > TELEGRAM_VIDEO_MAX_BYTES) {
    throw new Error(`Video ${Math.round(buf.byteLength / 1e6)}MB — Telegram limiti ~50MB`);
  }
  return buf;
}
