"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { resolveLinkDetection } from "@/lib/social-api/platform-detect";
import { PlatformGlyph } from "@/lib/platform-glyph";
import { cn } from "@/lib/utils";
import type { ActivityDayItem } from "@/lib/streamer-activity-dates";

type PreviewMeta =
  | { kind: "youtube"; thumb: string; embed: string }
  | { kind: "tiktok"; embed: string }
  | { kind: "instagram"; embed: string };

function previewForUrl(url: string, platformHint?: string): PreviewMeta | null {
  const detected = resolveLinkDetection({ url, platform: platformHint });
  if (!detected || detected.kind !== "video") return null;

  if (detected.platform === "youtube") {
    return {
      kind: "youtube",
      thumb: `https://img.youtube.com/vi/${detected.externalRef}/mqdefault.jpg`,
      embed: `https://www.youtube.com/embed/${detected.externalRef}?playsinline=1&rel=0&modestbranding=1`,
    };
  }
  if (detected.platform === "tiktok" && /^\d+$/.test(detected.externalRef)) {
    return {
      kind: "tiktok",
      embed: `https://www.tiktok.com/embed/v2/${detected.externalRef}`,
    };
  }
  if (detected.platform === "instagram") {
    return {
      kind: "instagram",
      embed: `https://www.instagram.com/reel/${detected.externalRef}/embed`,
    };
  }
  return null;
}

/**
 * Achievement gün detayında link yanındaki önizleme —
 * YouTube thumbnail; TikTok/IG gömülü oynatıcı.
 */
export function ActivityLinkPreview({
  item,
  className,
}: {
  item: ActivityDayItem;
  className?: string;
}) {
  const preview = useMemo(
    () => previewForUrl(item.url, item.platform),
    [item.url, item.platform]
  );
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  const shell = cn(
    "relative shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40",
    className
  );

  if (preview?.kind === "youtube") {
    if (playing) {
      return (
        <div className={cn(shell, "aspect-video w-[11rem] sm:w-[13rem]")}>
          <iframe
            title={item.label ?? "YouTube"}
            src={preview.embed}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className={cn(shell, "aspect-video w-[11rem] sm:w-[13rem] group")}
        title="Önizlemeyi oynat"
      >
        {!thumbFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.thumb}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PlatformGlyph platform={item.platform} size={22} />
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/35">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow">
            <Play size={16} fill="currentColor" className="ml-0.5" />
          </span>
        </span>
      </button>
    );
  }

  if (preview?.kind === "tiktok" || preview?.kind === "instagram") {
    return (
      <div
        className={cn(
          shell,
          preview.kind === "tiktok"
            ? "h-[11.5rem] w-[8.5rem]"
            : "h-[12rem] w-[9rem]"
        )}
      >
        <iframe
          title={item.label ?? preview.kind}
          src={preview.embed}
          className="h-full w-full"
          allow="encrypted-media; clipboard-write; picture-in-picture"
          allowFullScreen
          loading="lazy"
          scrolling="no"
        />
      </div>
    );
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        shell,
        "flex aspect-video w-[11rem] sm:w-[13rem] flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground"
      )}
      title="Linki aç"
    >
      <PlatformGlyph platform={item.platform} size={22} />
      <span className="inline-flex items-center gap-0.5 text-[9px]">
        Aç <ExternalLink size={9} />
      </span>
    </a>
  );
}
