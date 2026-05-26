"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inferStaticLinkThumbnail } from "@/lib/link-thumbnail";
import { PlatformGlyph } from "@/lib/platform-glyph";
import { isAutoTrackable } from "@/lib/social-api/platform-detect";
import { cn } from "@/lib/utils";
import type { BrandLink } from "@/store/store";

const thumbCache = new Map<string, string>();
let thumbInflight = 0;
const THUMB_MAX_CONCURRENT = 3;
const thumbWaiters: Array<() => void> = [];

function cacheKey(linkId: string) {
  return `zel-link-thumb:${linkId}`;
}

function readCache(linkId: string): string | null {
  if (thumbCache.has(linkId)) return thumbCache.get(linkId)!;
  try {
    const v = sessionStorage.getItem(cacheKey(linkId));
    if (v) {
      thumbCache.set(linkId, v);
      return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCache(linkId: string, url: string) {
  thumbCache.set(linkId, url);
  try {
    sessionStorage.setItem(cacheKey(linkId), url);
  } catch {
    /* ignore */
  }
}

function runThumbQueued(task: () => Promise<void>) {
  const start = () => {
    thumbInflight += 1;
    void task().finally(() => {
      thumbInflight -= 1;
      const next = thumbWaiters.shift();
      if (next) next();
    });
  };
  if (thumbInflight < THUMB_MAX_CONCURRENT) start();
  else thumbWaiters.push(start);
}

export function BrandLinkThumb({
  link,
  className,
  lazyApi = true,
  priority = false,
}: {
  link: BrandLink;
  className?: string;
  lazyApi?: boolean;
  /** Lider liste gibi — görünür olur olmaz öncelikli önizleme. */
  priority?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const staticUrl = useMemo(() => inferStaticLinkThumbnail(link), [link]);
  const [src, setSrc] = useState<string | null>(
    () => readCache(link.id) ?? staticUrl ?? null
  );
  const [failed, setFailed] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    setSrc(readCache(link.id) ?? staticUrl ?? null);
    setFailed(false);
    fetchedRef.current = false;
  }, [link.id, staticUrl]);

  useEffect(() => {
    if (!lazyApi || staticUrl || readCache(link.id) || fetchedRef.current) return;
    if (
      !isAutoTrackable(link.url, link.platform, link.handle, link.externalRef)
    ) {
      return;
    }

    const el = rootRef.current;
    if (!el) return;

    const fetchThumb = () => {
      if (fetchedRef.current) return;
      fetchedRef.current = true;
      runThumbQueued(async () => {
        try {
          const r = await fetch(
            `/api/admin/link-details/${link.id}?thumbOnly=1`,
            { credentials: "include" }
          );
          const j = (await r.json()) as {
            ok?: boolean;
            details?: { thumbnailUrl?: string };
          };
          const url = j.ok ? j.details?.thumbnailUrl : undefined;
          if (url) {
            writeCache(link.id, url);
            setSrc(url);
          }
        } catch {
          /* platform ikonu kalır */
        }
      });
    };

    if (priority) {
      fetchThumb();
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      fetchThumb();
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          fetchThumb();
          obs.disconnect();
        }
      },
      { rootMargin: "160px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [link, lazyApi, staticUrl, priority]);

  const showImg = Boolean(src && !failed);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg border border-border bg-gradient-to-br from-muted/60 to-muted/30",
        className
      )}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt=""
          className="h-full w-full object-cover"
          loading={priority ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-violet-500/10 to-purple-500/5 text-violet-700 dark:text-violet-300">
          <PlatformGlyph platform={link.platform} size={20} />
        </div>
      )}
    </div>
  );
}
