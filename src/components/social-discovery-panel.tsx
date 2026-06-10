"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Globe2, Languages, Loader2, MapPin, Search, Sparkles, SlidersHorizontal, Hash, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Select } from "@/components/ui/field";
import type { SocialPlatform } from "@/lib/social-api/config";
import {
  DISCOVERY_COUNTRIES,
  DISCOVERY_LANGUAGES,
  DISCOVERY_RESULT_COUNTS,
  YOUTUBE_SEARCH_TYPES,
} from "@/lib/social-discovery-options";
import { fmtCompactViews } from "@/lib/brand-month-metrics";

type DiscoveryType = "trending" | "search" | "hashtag" | "user_search";

export interface DiscoveryResultItem {
  title: string;
  subtitle?: string;
  views?: number | null;
  url?: string;
  platform: SocialPlatform;
}

const PLATFORM_OPTIONS: { id: SocialPlatform; label: string }[] = [
  { id: "youtube", label: "YouTube" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
];

function discoveryTypesFor(platform: SocialPlatform): DiscoveryType[] {
  if (platform === "youtube") return ["trending", "search"];
  if (platform === "instagram") return ["hashtag"];
  return ["search", "hashtag", "user_search"];
}

function typeLabel(t: DiscoveryType): string {
  if (t === "trending") return "Trend";
  if (t === "search") return "Arama";
  if (t === "hashtag") return "Hashtag";
  return "Kullanıcı ara";
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[,\s]/g, ""));
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return null;
}

function parseDiscoveryResults(platform: SocialPlatform, data: unknown): DiscoveryResultItem[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;
  const arrays: unknown[][] = [];

  const collect = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    for (const v of Object.values(o)) {
      if (Array.isArray(v) && v.length > 0) arrays.push(v);
    }
  };
  collect(root);
  if (root.data) collect(root.data);

  const list = arrays.sort((a, b) => b.length - a.length)[0] ?? [];
  const out: DiscoveryResultItem[] = [];

  for (const item of list.slice(0, 30)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title =
      (typeof row.title === "string" && row.title) ||
      (typeof row.name === "string" && row.name) ||
      (typeof row.cha_name === "string" && `#${row.cha_name}`) ||
      (typeof row.username === "string" && `@${row.username}`) ||
      (typeof row.uniqueId === "string" && `@${row.uniqueId}`) ||
      (typeof row.nickname === "string" && row.nickname);
    if (!title) continue;

    const views =
      toNumber(row.viewCount ?? row.views ?? row.view_count ?? row.play_count ?? row.playCount) ??
      null;
    const subtitle =
      (typeof row.author === "string" && row.author) ||
      (typeof row.channelTitle === "string" && row.channelTitle) ||
      undefined;
    const url =
      (typeof row.url === "string" && row.url) ||
      (typeof row.link === "string" && row.link) ||
      undefined;

    out.push({
      title: title.slice(0, 120),
      subtitle: subtitle?.slice(0, 80),
      views,
      url,
      platform,
    });
    if (out.length >= 20) break;
  }
  return out;
}

export interface SocialDiscoveryPanelProps {
  onQuotaUsed?: () => void;
  /** Kompakt mod — filtreler daraltılmış */
  compact?: boolean;
  /** Başlık gizle */
  hideIntro?: boolean;
}

export function SocialDiscoveryPanel({
  onQuotaUsed,
  compact = false,
  hideIntro = false,
}: SocialDiscoveryPanelProps) {
  const [platform, setPlatform] = useState<SocialPlatform>("youtube");
  const [type, setType] = useState<DiscoveryType>("trending");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("TR");
  const [language, setLanguage] = useState("tr");
  const [resultCount, setResultCount] = useState(String(DISCOVERY_RESULT_COUNTS[1]));
  const [ytSearchType, setYtSearchType] = useState("video");
  const [filtersOpen, setFiltersOpen] = useState(!compact);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DiscoveryResultItem[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const types = useMemo(() => discoveryTypesFor(platform), [platform]);
  const needsQuery = type === "search" || type === "hashtag" || type === "user_search";

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setLatencyMs(null);
    const t0 = Date.now();
    try {
      const params = new URLSearchParams({
        platform,
        type,
        gl: country,
        hl: language,
        country_code: country,
        count: resultCount,
      });
      if (query.trim()) params.set("q", query.trim());
      if (platform === "youtube" && type === "search") {
        params.set("search_type", ytSearchType);
      }
      const res = await fetch(`/api/admin/social-discovery?${params}`, { credentials: "include" });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        data?: unknown;
        quotaExhausted?: boolean;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setResults(parseDiscoveryResults(platform, json.data));
      setLatencyMs(Date.now() - t0);
      onQuotaUsed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "?");
    } finally {
      setLoading(false);
    }
  }, [platform, type, query, country, language, resultCount, ytSearchType, onQuotaUsed]);

  return (
    <div className="space-y-4">
      {!hideIntro && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Ülke, dil ve bölgeye göre trend, arama ve hashtag keşfi. Her sorgu 1 API kotası tüketir.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {PLATFORM_OPTIONS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={platform === p.id ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => {
              setPlatform(p.id);
              setType(discoveryTypesFor(p.id)[0]);
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {types.map((t) => (
          <Badge
            key={t}
            variant={type === t ? "default" : "outline"}
            className="cursor-pointer text-[10px] gap-0.5"
            onClick={() => setType(t)}
          >
            {t === "hashtag" ? <Hash size={9} /> : t === "trending" ? <TrendingUp size={9} /> : <Search size={9} />}
            {typeLabel(t)}
          </Badge>
        ))}
      </div>

      {needsQuery && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            type === "hashtag"
              ? "Hashtag veya challenge (ör. reels, fyp)"
              : type === "user_search"
                ? "TikTok kullanıcı adı"
                : "Anahtar kelime ara…"
          }
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
      )}

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 text-xs gap-1 px-2 -ml-2"
        onClick={() => setFiltersOpen((o) => !o)}
      >
        <SlidersHorizontal size={12} />
        {filtersOpen ? "Filtreleri gizle" : "Ülke, dil ve gelişmiş filtreler"}
      </Button>

      {filtersOpen && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <Field label="Ülke / bölge">
            <Select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              options={DISCOVERY_COUNTRIES.map((c) => ({ value: c.code, label: c.label }))}
            />
          </Field>
          <Field label="Dil">
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              options={DISCOVERY_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            />
          </Field>
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
          <div className="col-span-full flex flex-wrap gap-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Globe2 size={10} /> geo: {country}
            </span>
            <span className="inline-flex items-center gap-1">
              <Languages size={10} /> hl: {language}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={10} /> Lokasyon filtresi API planına bağlı
            </span>
          </div>
        </div>
      )}

      <Button
        type="button"
        size="sm"
        className="h-8 gap-1.5"
        disabled={loading || (needsQuery && !query.trim())}
        onClick={() => void run()}
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
        Keşfet (1 kota)
      </Button>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 break-words rounded-md border border-red-300/50 bg-red-50/40 dark:bg-red-950/20 px-3 py-2">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{results.length} sonuç</span>
            {latencyMs != null && <span>{latencyMs} ms</span>}
          </div>
          <ul className="text-xs space-y-1.5 rounded-lg border border-border/60 bg-card/50 p-2 max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-border/40 bg-background/60 px-2 py-1.5"
              >
                <Sparkles size={11} className="shrink-0 text-amber-500 mt-0.5" />
                <div className="min-w-0 flex-1">
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
                    <p className="text-[10px] text-muted-foreground truncate">{r.subtitle}</p>
                  )}
                </div>
                {r.views != null && (
                  <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                    {fmtCompactViews(r.views)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
