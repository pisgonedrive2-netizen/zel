"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, X } from "lucide-react";
import type { BrandLink } from "@/store/store";
import { accountIdentityFromLink } from "@/lib/yeni-hesaplar";
import type { ProfilePostItem } from "@/lib/social-api/streamer-profile-posts";
import { mediaKeyFromUrl, parseMediaRef } from "@/lib/media-ref";
import { UNKNOWN_HANDLE, platformFamily } from "@/lib/hesap-gruplari";
import {
  FAMILY_LABEL,
  VideoPlayerModal,
  VideoThumb,
  fmtCompact,
  type PlayableMedia,
} from "@/components/izlenme/link-thumb";
import { cn } from "@/lib/utils";

export interface AccountSelection {
  platform: string;
  handle: string;
  views: number;
  channelViews: number;
  links: number;
}

export function isContentMediaUrl(url: string): boolean {
  return parseMediaRef(url) != null;
}

interface CardModel {
  key: string;
  url: string;
  title: string;
  views: number | null;
  thumbnailUrl?: string;
  tracked: boolean;
  brandIds: string[];
}

function cardsFromKnown(links: BrandLink[], selection: AccountSelection): CardModel[] {
  const family = platformFamily(selection.platform);
  const handle = selection.handle.toLowerCase();
  const map = new Map<string, CardModel>();
  for (const link of links) {
    if (!link.url?.trim() || !isContentMediaUrl(link.url)) continue;
    if (platformFamily(link.platform, link.url) !== family) continue;
    if ((accountIdentityFromLink(link)?.handle ?? UNKNOWN_HANDLE) !== handle) continue;
    const key = mediaKeyFromUrl(link.url);
    const prev = map.get(key);
    if (prev) {
      prev.views = Math.max(prev.views ?? 0, link.lastViews ?? 0);
      if (!prev.brandIds.includes(link.brandId)) prev.brandIds.push(link.brandId);
      continue;
    }
    map.set(key, {
      key,
      url: link.url,
      title: link.notes?.trim() && link.notes !== "Yeni hesap" ? link.notes.trim() : "",
      views: link.lastViews ?? null,
      tracked: true,
      brandIds: [link.brandId],
    });
  }
  return [...map.values()];
}

function remoteKeys(item: ProfilePostItem): string[] {
  const keys = new Set<string>();
  if (item.url) keys.add(mediaKeyFromUrl(item.url));
  const ref = item.externalRef?.trim().toLowerCase();
  if (ref && (item.platform === "youtube" || item.platform === "instagram" || item.platform === "tiktok")) {
    keys.add(`${item.platform}:${ref}`);
  }
  return [...keys];
}

function mergeCards(known: CardModel[], remote: ProfilePostItem[]): CardModel[] {
  const map = new Map<string, CardModel>();
  for (const card of known) map.set(card.key, card);
  for (const item of remote) {
    if (!item.url) continue;
    const keys = remoteKeys(item);
    const prev = keys.map((k) => map.get(k)).find(Boolean);
    const next: CardModel = {
      key: prev?.key ?? keys[0] ?? mediaKeyFromUrl(item.url),
      url: prev?.url || item.url,
      title: item.title?.trim() || prev?.title || "",
      views: item.views ?? prev?.views ?? null,
      thumbnailUrl: item.thumbnailUrl || prev?.thumbnailUrl,
      tracked: prev?.tracked ?? false,
      brandIds: prev?.brandIds ?? [],
    };
    for (const k of keys) map.delete(k);
    if (prev) map.delete(prev.key);
    map.set(next.key, next);
  }
  return [...map.values()].sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
}

type Filter = "all" | "tracked" | "untracked";

export function HesapVideoPanel({
  selection,
  links,
  brandNames,
  onClose,
}: {
  selection: AccountSelection;
  links: BrandLink[];
  brandNames?: Record<string, string>;
  onClose: () => void;
}) {
  const known = useMemo(() => cardsFromKnown(links, selection), [links, selection]);
  const [remote, setRemote] = useState<ProfilePostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [playing, setPlaying] = useState<PlayableMedia | null>(null);
  const family = platformFamily(selection.platform);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !playing) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, playing]);

  async function loadRemote(fresh = false) {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ platform: selection.platform, handle: selection.handle });
    if (fresh) params.set("fresh", "1");
    try {
      const res = await fetch(`/api/admin/account-videos?${params}`, { credentials: "include" });
      const json = (await res.json()) as { ok?: boolean; items?: ProfilePostItem[]; error?: string };
      if (!res.ok || !json.ok) setError(json.error ?? "Kanal videoları alınamadı");
      else setRemote(json.items ?? []);
    } catch {
      setError("Kanal videoları alınamadı");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  useEffect(() => {
    setRemote([]);
    setLoaded(selection.handle === UNKNOWN_HANDLE);
    if (selection.handle !== UNKNOWN_HANDLE) void loadRemote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.handle, selection.platform]);

  const cards = useMemo(() => mergeCards(known, remote), [known, remote]);
  const shown = cards.filter((c) =>
    filter === "all" ? true : filter === "tracked" ? c.tracked : !c.tracked
  );
  const trackedCount = cards.filter((c) => c.tracked).length;
  const trackedViews = cards.filter((c) => c.tracked).reduce((s, c) => s + (c.views ?? 0), 0);
  const allViews = cards.reduce((s, c) => s + (c.views ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-4xl flex-col bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="space-y-3 border-b border-border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {FAMILY_LABEL[family] ?? selection.platform}
              </p>
              <h2 className="truncate text-lg font-semibold">@{selection.handle}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadRemote(true)}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw size={12} className={cn(loading && "animate-spin")} /> Yenile
              </button>
              <a
                href={profileHref(family, selection.handle)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Profil <ExternalLink size={12} />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Video" value={String(cards.length)} />
            <MiniStat label="Bizde kayıtlı" value={`${trackedCount}`} hint={fmtCompact(trackedViews)} />
            <MiniStat label="Videoların izlenmesi" value={fmtCompact(allViews)} />
            <MiniStat
              label={family === "instagram" ? "Takipçi" : "Kanal toplamı"}
              value={selection.channelViews > 0 ? fmtCompact(selection.channelViews) : "—"}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["all", `Tümü (${cards.length})`],
                ["tracked", `Kayıtlı (${trackedCount})`],
                ["untracked", `Takip dışı (${cards.length - trackedCount})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  filter === key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && (
            <p className="mb-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              Kanaldaki son videolar API’den çekiliyor…
            </p>
          )}
          {error && (
            <p className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
              {error}
              {known.length > 0 ? " — Kayıtlı videolar aşağıda." : ""}
            </p>
          )}
          {shown.length === 0 && loaded && !loading ? (
            <p className="text-sm text-muted-foreground">Bu filtrede video yok.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
              {shown.map((card) => (
                <div key={card.key} className="space-y-1">
                  <VideoThumb
                    media={{
                      url: card.url,
                      title: card.title,
                      views: card.views,
                      family,
                      thumbnailUrl: card.thumbnailUrl,
                    }}
                    badge={card.tracked ? "Kayıtlı" : undefined}
                    onPlay={setPlaying}
                  />
                  {card.brandIds.length > 0 && brandNames && (
                    <p className="truncate text-[10px] text-muted-foreground">
                      {card.brandIds.map((id) => brandNames[id] ?? id).join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
      {playing && <VideoPlayerModal media={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">
        {value}
        {hint ? <span className="ml-1 text-[11px] font-normal text-muted-foreground">{hint}</span> : null}
      </p>
    </div>
  );
}

function profileHref(family: string, handle: string) {
  const h = handle.replace(/^@/, "");
  if (family === "youtube") return `https://www.youtube.com/@${h}`;
  if (family === "tiktok") return `https://www.tiktok.com/@${h}`;
  return `https://www.instagram.com/${h}/`;
}
