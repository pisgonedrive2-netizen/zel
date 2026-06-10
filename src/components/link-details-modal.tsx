"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtDateShort } from "@/lib/fmt-date";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Hash,
  Heart,
  Loader2,
  MessageCircle,
  Music,
  RefreshCw,
  Share2,
  Tag,
  User,
  Verified,
} from "lucide-react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore, type BrandLink } from "@/store/store";
import {
  applyLinkMetricsToStore,
  type LinkMetricsStoreUpdate,
} from "@/lib/social-api/link-store-sync";

interface RichLinkDetails {
  platform: "youtube" | "instagram" | "tiktok";
  kind: string;
  externalRef: string;
  fetchedAt: string;
  metrics: {
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
  };
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  durationSeconds?: number;
  author?: {
    name?: string;
    username?: string;
    avatarUrl?: string;
    verified?: boolean;
    followerCount?: number;
  };
  hashtags?: string[];
  extras?: Record<string, number | string | null | undefined>;
  premium?: {
    engagementRate?: number | null;
    verifiedCommentCount?: number | null;
    extraApiCalls?: number;
    recentComments?: Array<{ author?: string; text: string; likes?: number }>;
    relatedVideos?: Array<{ title: string; views?: number | null; videoId?: string }>;
    recentPosts?: Array<{ title?: string; url?: string; views?: number | null }>;
    musicInfo?: { title?: string; author?: string; videoCount?: number | null };
    challengeInfo?: { name?: string; viewCount?: number | null; userCount?: number | null };
  };
}

interface ApiResponse {
  ok: boolean;
  details?: RichLinkDetails;
  error?: string;
  quotaExhausted?: boolean;
  platform?: string;
  linkUpdate?: LinkMetricsStoreUpdate;
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
}

function fmtDate(s?: string): string {
  if (!s) return "—";
  // Unix timestamp olabilir
  const maybe = /^\d{9,11}$/.test(s) ? new Date(parseInt(s, 10) * 1000) : new Date(s);
  if (Number.isNaN(maybe.getTime())) return s;
  return maybe.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDuration(sec?: number): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m === 0) return `${s} sn`;
  return `${m} dk ${s.toString().padStart(2, "0")} sn`;
}

function platformAccent(p?: string) {
  if (p === "youtube") return "border-red-300 bg-red-50/40 dark:border-red-500/45 dark:bg-red-950/30";
  if (p === "instagram") return "border-pink-300 bg-pink-50/40 dark:border-pink-500/45 dark:bg-pink-950/30";
  if (p === "tiktok") return "border-purple-300 bg-purple-50/40 dark:border-purple-500/45 dark:bg-purple-950/30";
  return "border-border";
}

export interface LinkDetailsModalProps {
  link: BrandLink | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Tek bir link için RapidAPI'den zengin bir snapshot çeker ve modal'da gösterir.
 *
 *   - Modal açıldığında otomatik bir API çağrısı yapılır.
 *   - "Yeniden çek" ile manuel olarak tekrar çağrılabilir (her biri 1 kota).
 *   - Kota dolduysa friendly bir uyarı gösterir, çağrı yapmaz.
 */
export function LinkDetailsModal({ link, open, onClose }: LinkDetailsModalProps) {
  const updateBrandLink = useStore((s) => s.updateBrandLink);
  const upsertLinkSnapshot = useStore((s) => s.upsertLinkSnapshot);
  const [details, setDetails] = useState<RichLinkDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);

  const load = useCallback(async () => {
    if (!link) return;
    setLoading(true);
    setError(null);
    setQuotaExhausted(false);
    try {
      const res = await fetch(`/api/admin/link-details/${link.id}`, {
        credentials: "include",
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.ok) {
        if (json.quotaExhausted) setQuotaExhausted(true);
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setDetails(json.details ?? null);
      if (json.linkUpdate && link) {
        applyLinkMetricsToStore(link.id, json.linkUpdate, {
          updateBrandLink,
          upsertLinkSnapshot,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "?");
    } finally {
      setLoading(false);
    }
  }, [link, updateBrandLink, upsertLinkSnapshot]);

  // Modal her açıldığında ya da link değiştiğinde yükle
  useEffect(() => {
    if (!open || !link) {
      setDetails(null);
      setError(null);
      return;
    }
    void load();
  }, [open, link, load]);

  if (!link) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`${link.platform} · detaylı veri`}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground truncate min-w-0">
            {link.url || link.handle || "—"}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void load()}
            disabled={loading || quotaExhausted}
            className="h-7 gap-1.5 text-xs shrink-0"
            title="Yeni bir API çağrısı yapar (1 kota tüketir)"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            Yeniden çek
          </Button>
        </div>

        {quotaExhausted && (
          <div className="rounded-md border border-red-300 bg-red-50/40 px-3 py-2 text-sm text-red-800 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-200">
            <p className="font-medium flex items-center gap-1.5">
              <AlertTriangle size={14} /> Aylık kota neredeyse doldu
            </p>
            <p className="text-xs mt-0.5 opacity-90">{error}</p>
          </div>
        )}

        {error && !quotaExhausted && (
          <div className="rounded-md border border-red-300 bg-red-50/40 px-3 py-2 text-sm text-red-800 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-200">
            <p className="font-medium flex items-center gap-1.5">
              <AlertTriangle size={14} /> API hatası
            </p>
            <p className="text-xs mt-0.5 break-words">{error}</p>
            <p className="text-[11px] mt-1 opacity-75">
              RapidAPI sağlık çipini kontrol edebilir, kotanız dolmamışsa biraz sonra tekrar deneyebilirsiniz.
            </p>
          </div>
        )}

        {loading && !details && (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
            <Loader2 className="animate-spin" size={14} /> API'den çekiliyor…
          </div>
        )}

        {details && (
          <div className={`rounded-lg border p-4 space-y-4 ${platformAccent(details.platform)}`}>
            <div className="flex items-start gap-3">
              {details.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={details.thumbnailUrl}
                  alt={details.title ?? "kapak"}
                  className="h-24 w-24 rounded-md object-cover border border-border shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="h-24 w-24 rounded-md border border-dashed border-border bg-muted/40 shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
                  görsel yok
                </div>
              )}
              <div className="flex-1 min-w-0">
                {details.title && (
                  <h3 className="text-sm font-semibold leading-tight line-clamp-2">{details.title}</h3>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                  <Badge variant="outline" className="text-[10px] uppercase">{details.platform}</Badge>
                  <Badge variant="outline" className="text-[10px]">{details.kind}</Badge>
                  {details.publishedAt && (
                    <span className="inline-flex items-center gap-0.5">
                      <Calendar size={10} /> {fmtDate(details.publishedAt)}
                    </span>
                  )}
                  {details.durationSeconds != null && (
                    <span className="inline-flex items-center gap-0.5">
                      <Clock size={10} /> {fmtDuration(details.durationSeconds)}
                    </span>
                  )}
                </div>
                {details.author && (details.author.name || details.author.username) && (
                  <div className="mt-2 flex items-center gap-2">
                    {details.author.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={details.author.avatarUrl}
                        alt={details.author.username ?? "yazar"}
                        className="h-7 w-7 rounded-full object-cover border border-border"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                        <User size={12} />
                      </div>
                    )}
                    <div className="text-xs min-w-0">
                      <p className="font-medium truncate flex items-center gap-0.5">
                        {details.author.name ?? details.author.username}
                        {details.author.verified && (
                          <Verified size={11} className="text-blue-500 shrink-0" />
                        )}
                      </p>
                      {details.author.followerCount != null && (
                        <p className="text-[10px] text-muted-foreground">
                          {fmtNum(details.author.followerCount)} takipçi
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MetricTile icon={Eye} label="İzlenme" value={fmtNum(details.metrics.views)} accent="blue" />
              <MetricTile icon={Heart} label="Beğeni" value={fmtNum(details.metrics.likes)} accent="rose" />
              <MetricTile
                icon={MessageCircle}
                label="Yorum"
                value={fmtNum(details.premium?.verifiedCommentCount ?? details.metrics.comments)}
                accent="amber"
              />
              <MetricTile
                icon={Share2}
                label={
                  details.kind === "user" || details.kind === "channel"
                    ? "Takipçi / abone"
                    : "Paylaşım"
                }
                value={fmtNum(details.metrics.shares)}
                accent="violet"
              />
            </div>

            {details.premium?.engagementRate != null && (
              <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Activity size={10} /> Etkileşim oranı (premium)
                </p>
                <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  %{details.premium.engagementRate.toLocaleString("tr-TR")}
                </p>
              </div>
            )}

            {details.premium?.musicInfo?.title && (
              <div className="rounded border border-border/60 bg-card/60 px-3 py-2 text-xs">
                <p className="text-[10px] uppercase text-muted-foreground mb-0.5 flex items-center gap-1">
                  <Music size={10} /> Kullanılan ses
                </p>
                <p className="font-medium">{details.premium.musicInfo.title}</p>
                {details.premium.musicInfo.videoCount != null && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {fmtNum(details.premium.musicInfo.videoCount)} video kullanımı
                  </p>
                )}
              </div>
            )}

            {details.premium?.challengeInfo?.name && (
              <div className="rounded border border-border/60 bg-card/60 px-3 py-2 text-xs">
                <p className="text-[10px] uppercase text-muted-foreground mb-0.5 flex items-center gap-1">
                  <Hash size={10} /> Challenge
                </p>
                <p className="font-medium">#{details.premium.challengeInfo.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {fmtNum(details.premium.challengeInfo.viewCount)} görüntülenme ·{" "}
                  {fmtNum(details.premium.challengeInfo.userCount)} katılımcı
                </p>
              </div>
            )}

            {details.premium?.recentComments && details.premium.recentComments.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                  <MessageCircle size={10} /> Son yorumlar (premium)
                </p>
                <ul className="space-y-1.5 max-h-36 overflow-y-auto">
                  {details.premium.recentComments.map((c, i) => (
                    <li
                      key={i}
                      className="rounded border border-border/60 bg-card/60 px-2 py-1.5 text-[11px]"
                    >
                      {c.author && <span className="font-medium text-foreground/90">{c.author}: </span>}
                      <span className="text-foreground/80">{c.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {details.premium?.relatedVideos && details.premium.relatedVideos.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  İlgili videolar (premium)
                </p>
                <ul className="space-y-1 text-[11px]">
                  {details.premium.relatedVideos.map((v, i) => (
                    <li key={i} className="truncate text-foreground/85">
                      {v.title}
                      {v.views != null && (
                        <span className="text-muted-foreground"> · {fmtNum(v.views)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {details.premium?.recentPosts && details.premium.recentPosts.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Son içerikler (premium)
                </p>
                <ul className="space-y-1 text-[11px]">
                  {details.premium.recentPosts.map((p, i) => (
                    <li key={i} className="truncate">
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {p.title ?? p.url}
                        </a>
                      ) : (
                        <span>{p.title ?? "—"}</span>
                      )}
                      {p.views != null && (
                        <span className="text-muted-foreground"> · {fmtNum(p.views)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {details.description && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                  <Tag size={10} /> Açıklama
                </p>
                <p className="text-xs whitespace-pre-wrap leading-relaxed text-foreground/90 max-h-32 overflow-y-auto rounded border border-border/60 bg-card/60 p-2">
                  {details.description}
                </p>
              </div>
            )}

            {details.hashtags && details.hashtags.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                  <Hash size={10} /> Etiketler
                </p>
                <div className="flex flex-wrap gap-1">
                  {details.hashtags.map((h) => (
                    <Badge key={h} variant="outline" className="text-[10px]">
                      #{h}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {details.extras && Object.keys(details.extras).length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                  <Music size={10} /> Ek bilgi
                </p>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                  {Object.entries(details.extras).map(([k, v]) =>
                    v == null || v === "" ? null : (
                      <div key={k} className="rounded border border-border/60 bg-card/60 px-2 py-1">
                        <dt className="text-[9px] uppercase text-muted-foreground">{k}</dt>
                        <dd className="font-medium truncate">{typeof v === "number" ? fmtNum(v) : String(v)}</dd>
                      </div>
                    )
                  )}
                </dl>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 size={10} className="text-emerald-600 dark:text-emerald-400" />
                {fmtDateShort(details.fetchedAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Activity size={10} />
                ref: {details.externalRef}
              </span>
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground border-t border-border/40 pt-2 leading-relaxed">
          Temel çekim 1 kota; premium özellikler (yorumlar, ilgili içerik, müzik/challenge) ek
          istekler tüketir. Başarılı olunca metrikler listeye ve bu ayın snapshot kaydına yazılır.
        </p>
      </div>
    </Modal>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  accent: "blue" | "rose" | "amber" | "violet";
}) {
  const cls =
    accent === "blue"
      ? "text-blue-700 dark:text-blue-300"
      : accent === "rose"
        ? "text-rose-700 dark:text-rose-300"
        : accent === "amber"
          ? "text-amber-700 dark:text-amber-300"
          : "text-violet-700 dark:text-violet-300";
  return (
    <div className="rounded-lg border border-border/60 bg-card/80 px-3 py-2">
      <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
        <Icon size={10} className={cls} /> {label}
      </p>
      <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
