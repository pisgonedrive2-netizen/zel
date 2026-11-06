"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Play, X } from "lucide-react";
import { useLinkThumb } from "@/lib/link-thumb-client";
import { mediaEmbedUrl, parseMediaRef } from "@/lib/media-ref";
import { cn } from "@/lib/utils";

export function fmtCompact(n: number | null | undefined) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return Math.round(v).toLocaleString("tr-TR");
}

export const FAMILY_COLOR: Record<string, string> = {
  youtube: "#ef4444",
  instagram: "#db2777",
  tiktok: "#14b8a6",
  kick: "#22c55e",
  diger: "#64748b",
};

export const FAMILY_LABEL: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  kick: "Kick",
  diger: "Diğer",
};

function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || !ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

export interface PlayableMedia {
  url: string;
  title?: string;
  views?: number | null;
  family: string;
  /** Uzak API'den gelen kapak — varsa ücretsiz kapak isteği atlanır. */
  thumbnailUrl?: string;
}

export function VideoThumb({
  media,
  onPlay,
  badge,
  className,
  compact,
}: {
  media: PlayableMedia;
  onPlay?: (media: PlayableMedia) => void;
  badge?: string;
  className?: string;
  compact?: boolean;
}) {
  const [ref, inView] = useInView<HTMLButtonElement>();
  const thumb = useLinkThumb(media.url, inView && !media.thumbnailUrl);
  const ref0 = parseMediaRef(media.url);
  const src = media.thumbnailUrl || thumb?.thumbnailUrl;
  const [broken, setBroken] = useState(false);
  const portrait = ref0?.portrait ?? true;
  const title = media.title || thumb?.title;
  const color = FAMILY_COLOR[media.family] ?? FAMILY_COLOR.diger;

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onPlay?.({ ...media, title, thumbnailUrl: src })}
      title={title || media.url}
      className={cn(
        "group relative block w-full overflow-hidden rounded-lg border border-border/60 bg-muted text-left",
        portrait ? "aspect-[9/16]" : "aspect-video",
        className
      )}
    >
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-white/90"
          style={{ background: `linear-gradient(160deg, ${color}, #0f172a)` }}
        >
          <span className="font-semibold">{FAMILY_LABEL[media.family] ?? "Video"}</span>
          <span className="opacity-80">{thumb?.missing || broken ? "Kapak yok" : inView ? "Yükleniyor…" : ""}</span>
        </div>
      )}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
        <Play
          size={compact ? 18 : 26}
          className="text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100"
          fill="white"
        />
      </span>
      {badge && (
        <span className="absolute left-1 top-1 rounded bg-background/90 px-1 py-0.5 text-[9px] font-medium">
          {badge}
        </span>
      )}
      {media.views != null && media.views > 0 && (
        <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-white">
          {fmtCompact(media.views)}
        </span>
      )}
      {!compact && title && (
        <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-5 pt-6 text-[10px] leading-tight text-white">
          {title}
        </span>
      )}
    </button>
  );
}

export function VideoPlayerModal({ media, onClose }: { media: PlayableMedia; onClose: () => void }) {
  const ref = parseMediaRef(media.url);
  const thumb = useLinkThumb(media.url, ref?.shortLink === true);
  const embed = ref ? mediaEmbedUrl(ref, thumb?.videoId) : null;
  const portrait = ref?.portrait ?? true;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div
        className={cn("relative flex max-h-full w-full flex-col gap-2", portrait ? "max-w-sm" : "max-w-3xl")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 text-white">
          <p className="min-w-0 truncate text-sm font-medium">
            {media.title || media.url}
            {media.views ? <span className="ml-2 text-white/70">{fmtCompact(media.views)} izlenme</span> : null}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={media.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
            >
              Platformda aç <ExternalLink size={12} />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-white/10 p-1.5 hover:bg-white/20"
              aria-label="Kapat"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div
          className={cn(
            "overflow-hidden rounded-xl bg-black",
            portrait ? "aspect-[9/16] max-h-[80vh]" : "aspect-video"
          )}
        >
          {embed ? (
            <iframe
              src={embed}
              title={media.title || "Video"}
              className="h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/80">
              Bu video sitede oynatılamıyor. “Platformda aç” ile izleyebilirsin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
