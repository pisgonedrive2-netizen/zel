"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Copy,
  ExternalLink,
  Globe2,
  Hash,
  Languages,
  LayoutGrid,
  ListFilter,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
  UserRound,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Select } from "@/components/ui/field";
import type { SocialPlatform } from "@/lib/social-api/config";
import type { DiscoveryItemKind } from "@/lib/social-api/discovery";
import {
  DISCOVERY_COUNTRIES,
  DISCOVERY_LANGUAGES,
  DISCOVERY_QUERY_PRESETS,
  DISCOVERY_RESULT_COUNTS,
  INSTAGRAM_HASHTAG_SECTIONS,
  MIN_VIEWS_FILTERS,
  PLATFORM_DISCOVERY_MODES,
  RESULT_SORT_OPTIONS,
  TIKTOK_PUBLISH_TIMES,
  TIKTOK_SORT_TYPES,
  TIKTOK_USER_FOLLOWER_FILTERS,
  TIKTOK_USER_PROFILE_TYPES,
  TIKTOK_USER_SEARCH_MODES,
  YOUTUBE_CHANNEL_FILTERS,
  YOUTUBE_SEARCH_TYPES,
  type PanelDiscoveryType,
} from "@/lib/social-discovery-options";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import { cn } from "@/lib/utils";

export interface DiscoveryResultItem {
  title: string;
  subtitle?: string;
  views?: number | null;
  likes?: number | null;
  url?: string;
  imageUrl?: string;
  kind: DiscoveryItemKind;
  platform: SocialPlatform;
}

const PLATFORM_OPTIONS: { id: SocialPlatform; label: string; color: string }[] = [
  { id: "youtube", label: "YouTube", color: "text-red-600" },
  { id: "instagram", label: "Instagram", color: "text-pink-600" },
  { id: "tiktok", label: "TikTok", color: "text-foreground" },
];

const KIND_FILTERS: { id: "all" | DiscoveryItemKind; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "video", label: "Video" },
  { id: "user", label: "Profil" },
  { id: "hashtag", label: "Hashtag" },
  { id: "channel", label: "Kanal" },
];

function modeIcon(id: PanelDiscoveryType) {
  if (id === "trending") return <TrendingUp size={14} />;
  if (id === "user_search" || id === "user_profile") return <UserRound size={14} />;
  if (id === "hashtag" || id === "hashtag_discover") return <Hash size={14} />;
  return <Video size={14} />;
}

function kindLabel(kind: DiscoveryItemKind): string {
  if (kind === "video") return "Video";
  if (kind === "user") return "Profil";
  if (kind === "hashtag") return "Hashtag";
  return "Kanal";
}

export interface SocialDiscoveryPanelProps {
  onQuotaUsed?: () => void;
  compact?: boolean;
  hideIntro?: boolean;
}

export function SocialDiscoveryPanel({
  onQuotaUsed,
  compact = false,
  hideIntro = false,
}: SocialDiscoveryPanelProps) {
  const [platform, setPlatform] = useState<SocialPlatform>("youtube");
  const modes = PLATFORM_DISCOVERY_MODES[platform];
  const [type, setType] = useState<PanelDiscoveryType>(modes[0].id);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("TR");
  const [language, setLanguage] = useState("tr");
  const [resultCount, setResultCount] = useState(String(DISCOVERY_RESULT_COUNTS[1]));
  const [ytSearchType, setYtSearchType] = useState("video");
  const [igSection, setIgSection] = useState("top");
  const [ttSortType, setTtSortType] = useState("0");
  const [ttPublishTime, setTtPublishTime] = useState("0");
  const [ttFollowerCount, setTtFollowerCount] = useState("0");
  const [ttProfileType, setTtProfileType] = useState("0");
  const [ttOtherPref, setTtOtherPref] = useState("0");
  const [ytChannelFilter, setYtChannelFilter] = useState("videos_latest");
  const [resultSort, setResultSort] = useState("default");
  const [minViews, setMinViews] = useState("0");
  const [kindFilter, setKindFilter] = useState<"all" | DiscoveryItemKind>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DiscoveryResultItem[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [apiCalls, setApiCalls] = useState<number | null>(null);
  const [endpoints, setEndpoints] = useState<string[]>([]);

  const activeMode = useMemo(
    () => modes.find((m) => m.id === type) ?? modes[0],
    [modes, type],
  );
  const needsQuery = activeMode.needsQuery;
  const presets = DISCOVERY_QUERY_PRESETS[platform];

  const filteredResults = useMemo(() => {
    let list = kindFilter === "all" ? results : results.filter((r) => r.kind === kindFilter);
    const min = Number(minViews);
    if (min > 0) {
      list = list.filter((r) => (r.views ?? 0) >= min);
    }
    if (resultSort === "views_desc") {
      list = [...list].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    } else if (resultSort === "views_asc") {
      list = [...list].sort((a, b) => (a.views ?? 0) - (b.views ?? 0));
    } else if (resultSort === "likes_desc") {
      list = [...list].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    } else if (resultSort === "title_asc") {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title, "tr"));
    }
    return list;
  }, [results, kindFilter, minViews, resultSort]);

  const switchPlatform = (next: SocialPlatform) => {
    setPlatform(next);
    setType(PLATFORM_DISCOVERY_MODES[next][0].id);
    setResults([]);
    setError(null);
    setKindFilter("all");
  };

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setLatencyMs(null);
    setApiCalls(null);
    setEndpoints([]);
    const t0 = Date.now();
    try {
      const params = new URLSearchParams({
        platform,
        type,
        gl: country,
        hl: language,
        count: resultCount,
        ig_section: igSection,
        tt_sort_type: ttSortType,
        tt_publish_time: ttPublishTime,
        tt_follower_count: ttFollowerCount,
        tt_profile_type: ttProfileType,
        tt_other_pref: ttOtherPref,
        yt_channel_filter: ytChannelFilter,
      });
      if (query.trim()) params.set("q", query.trim());
      if (platform === "youtube" && type === "search") {
        params.set("search_type", ytSearchType);
      }
      const res = await fetch(`/api/admin/social-discovery?${params}`, { credentials: "include" });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        items?: DiscoveryResultItem[];
        apiCalls?: number;
        endpoints?: string[];
        latencyMs?: number;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setResults(json.items ?? []);
      setApiCalls(json.apiCalls ?? 1);
      setEndpoints(json.endpoints ?? []);
      setLatencyMs(json.latencyMs ?? Date.now() - t0);
      onQuotaUsed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "?");
    } finally {
      setLoading(false);
    }
  }, [
    platform, type, query, country, language, resultCount, ytSearchType, igSection,
    ttSortType, ttPublishTime, ttFollowerCount, ttProfileType, ttOtherPref, ytChannelFilter, onQuotaUsed,
  ]);

  return (
    <div className="space-y-5">
      {!hideIntro && !compact && (
        <div className="rounded-xl border border-violet-300/40 bg-gradient-to-br from-violet-50/80 via-card to-blue-50/50 dark:from-violet-950/25 dark:via-card dark:to-blue-950/20 px-4 py-3">
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <Sparkles size={15} className="text-violet-600" />
            Premium keşif motoru
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Trend, arama, profil, hashtag, challenge ve ilgili içerik modları — platform API
            yeteneklerine göre özelleştirildi.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {PLATFORM_OPTIONS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => switchPlatform(p.id)}
            className={cn(
              "rounded-lg border px-3 py-2.5 text-left transition-colors",
              platform === p.id
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border bg-card hover:bg-muted/40",
            )}
          >
            <span className={cn("text-xs font-semibold", p.color)}>{p.label}</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {PLATFORM_DISCOVERY_MODES[p.id].length} keşif modu
            </p>
          </button>
        ))}
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
          <LayoutGrid size={11} />
          Keşif modu
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setType(m.id);
                setResults([]);
                setError(null);
              }}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-colors",
                type === m.id
                  ? "border-primary bg-primary/10"
                  : "border-border/70 bg-muted/15 hover:bg-muted/35",
              )}
            >
              <div className="flex items-center gap-2">
                <span className={type === m.id ? "text-primary" : "text-muted-foreground"}>
                  {modeIcon(m.id)}
                </span>
                <span className="text-xs font-medium">{m.label}</span>
              </div>
              {m.apiLabel && (
                <p className="text-[9px] text-muted-foreground mt-1 font-mono truncate">{m.apiLabel}</p>
              )}
            </button>
          ))}
        </div>
        {activeMode.hint && (
          <p className="text-[11px] text-muted-foreground mt-2 rounded-md border border-border/50 bg-muted/10 px-3 py-2">
            {activeMode.hint}
          </p>
        )}
      </div>

      {needsQuery && (
        <div className="space-y-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={activeMode.placeholder}
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-muted-foreground self-center mr-1">Hızlı:</span>
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setQuery(preset)}
                className="rounded-full border border-border/70 bg-muted/20 px-2.5 py-0.5 text-[10px] hover:bg-muted/50 transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
          <ListFilter size={11} />
          Filtreler ve bölge
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Field label="Ülke / bölge">
            <Select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              options={DISCOVERY_COUNTRIES.map((c) => ({ value: c.code, label: c.label }))}
            />
          </Field>
          {(platform === "youtube" || platform === "tiktok") && (
            <Field label="Dil">
              <Select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                options={DISCOVERY_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
              />
            </Field>
          )}
          <Field label="Sonuç sayısı">
            <Select
              value={resultCount}
              onChange={(e) => setResultCount(e.target.value)}
              options={DISCOVERY_RESULT_COUNTS.map((n) => ({ value: String(n), label: String(n) }))}
            />
          </Field>
          {platform === "youtube" && type === "search" && (
            <Field label="YouTube türü">
              <Select
                value={ytSearchType}
                onChange={(e) => setYtSearchType(e.target.value)}
                options={YOUTUBE_SEARCH_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </Field>
          )}
          {platform === "instagram" && type === "hashtag" && (
            <Field label="Hashtag sıralaması">
              <Select
                value={igSection}
                onChange={(e) => setIgSection(e.target.value)}
                options={INSTAGRAM_HASHTAG_SECTIONS.map((s) => ({ value: s.value, label: s.label }))}
              />
            </Field>
          )}
          {platform === "tiktok" && type === "search" && (
            <>
              <Field label="Sıralama">
                <Select
                  value={ttSortType}
                  onChange={(e) => setTtSortType(e.target.value)}
                  options={TIKTOK_SORT_TYPES.map((s) => ({ value: s.value, label: s.label }))}
                />
              </Field>
              <Field label="Yayın zamanı">
                <Select
                  value={ttPublishTime}
                  onChange={(e) => setTtPublishTime(e.target.value)}
                  options={TIKTOK_PUBLISH_TIMES.map((s) => ({ value: s.value, label: s.label }))}
                />
              </Field>
            </>
          )}
          {platform === "tiktok" && type === "user_search" && (
            <>
              <Field label="Takipçi aralığı">
                <Select
                  value={ttFollowerCount}
                  onChange={(e) => setTtFollowerCount(e.target.value)}
                  options={TIKTOK_USER_FOLLOWER_FILTERS.map((s) => ({ value: s.value, label: s.label }))}
                />
              </Field>
              <Field label="Profil türü">
                <Select
                  value={ttProfileType}
                  onChange={(e) => setTtProfileType(e.target.value)}
                  options={TIKTOK_USER_PROFILE_TYPES.map((s) => ({ value: s.value, label: s.label }))}
                />
              </Field>
              <Field label="Arama odağı">
                <Select
                  value={ttOtherPref}
                  onChange={(e) => setTtOtherPref(e.target.value)}
                  options={TIKTOK_USER_SEARCH_MODES.map((s) => ({ value: s.value, label: s.label }))}
                />
              </Field>
            </>
          )}
          {platform === "youtube" && type === "channel_videos" && (
            <Field label="Kanal listesi">
              <Select
                value={ytChannelFilter}
                onChange={(e) => setYtChannelFilter(e.target.value)}
                options={YOUTUBE_CHANNEL_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
              />
            </Field>
          )}
          <Field label="Sonuç sıralama">
            <Select
              value={resultSort}
              onChange={(e) => setResultSort(e.target.value)}
              options={RESULT_SORT_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
            />
          </Field>
          <Field label="Min. izlenme">
            <Select
              value={minViews}
              onChange={(e) => setMinViews(e.target.value)}
              options={MIN_VIEWS_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Globe2 size={10} />
            {platform === "tiktok" ? `region: ${country.toLowerCase()}` : `geo: ${country}`}
          </span>
          {platform === "youtube" && (
            <span className="inline-flex items-center gap-1">
              <Languages size={10} /> hl: {language}
            </span>
          )}
        </div>
      </div>

      <Button
        type="button"
        className="h-9 gap-2 w-full sm:w-auto"
        disabled={loading || (needsQuery && !query.trim())}
        onClick={() => void run()}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        Keşfet · {activeMode.label}
        {apiCalls != null ? ` (${apiCalls} kota)` : ""}
      </Button>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 break-words rounded-md border border-red-300/50 bg-red-50/40 dark:bg-red-950/20 px-3 py-2">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {KIND_FILTERS.map((k) => (
                <Badge
                  key={k.id}
                  variant={kindFilter === k.id ? "default" : "outline"}
                  className="cursor-pointer text-[10px]"
                  onClick={() => setKindFilter(k.id)}
                >
                  {k.label}
                  {k.id !== "all" && (
                    <span className="ml-1 opacity-70">
                      ({results.filter((r) => r.kind === k.id).length})
                    </span>
                  )}
                </Badge>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground text-right">
              <p>{filteredResults.length} sonuç · {latencyMs} ms</p>
              {endpoints.length > 0 && (
                <p className="font-mono opacity-80">{endpoints.join(" → ")}</p>
              )}
            </div>
          </div>

          <ul className="text-xs space-y-2 max-h-[min(28rem,60vh)] overflow-y-auto pr-1">
            {filteredResults.map((r, i) => (
              <li
                key={`${r.url ?? r.title}-${i}`}
                className="flex items-start gap-3 rounded-lg border border-border/50 bg-card px-3 py-2.5 shadow-sm"
              >
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.imageUrl}
                    alt=""
                    className="h-12 w-12 rounded-md object-cover shrink-0 bg-muted"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-md bg-muted/60 shrink-0 flex items-center justify-center text-muted-foreground">
                    {r.kind === "user" ? <UserRound size={16} /> : r.kind === "hashtag" ? <Hash size={16} /> : <Video size={16} />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                      {kindLabel(r.kind)}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 capitalize">
                      {r.platform}
                    </Badge>
                  </div>
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline line-clamp-2"
                    >
                      {r.title}
                    </a>
                  ) : (
                    <p className="font-medium line-clamp-2">{r.title}</p>
                  )}
                  {r.subtitle && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{r.subtitle}</p>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  {r.views != null && (
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      {r.kind === "user" ? `${fmtCompactViews(r.views)} takipçi` : fmtCompactViews(r.views)}
                    </p>
                  )}
                  {r.likes != null && r.likes > 0 && (
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      {r.kind === "user" && r.platform === "instagram"
                        ? `${fmtCompactViews(r.likes)} gönderi`
                        : `${fmtCompactViews(r.likes)} beğeni`}
                    </p>
                  )}
                  {r.url && (
                    <div className="flex justify-end gap-1">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                        title="Aç"
                      >
                        <ExternalLink size={11} />
                      </a>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                        title="Kopyala"
                        onClick={() => void navigator.clipboard.writeText(r.url!)}
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && !error && results.length === 0 && latencyMs != null && (
        <p className="text-xs text-amber-700 dark:text-amber-300 rounded-md border border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/20 px-3 py-2">
          API yanıt verdi ancak listelenecek sonuç bulunamadı. Farklı anahtar kelime veya filtre deneyin.
        </p>
      )}
    </div>
  );
}
