"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Archive, CheckCircle2, ChevronRight, Grid3x3, LayoutList, Search, Sparkles, X } from "lucide-react";
import type { Brand, BrandLink, LinkSnapshot } from "@/store/store";
import type { ProfilePostItem } from "@/lib/social-api/streamer-profile-posts";
import {
  UNKNOWN_HANDLE,
  filterAccounts,
  groupAccounts,
  linkInTab,
  sortAccounts,
  type AccountGroup,
  type HesapTab,
  type PlatformFamily,
  type SortKey,
} from "@/lib/hesap-gruplari";
import { HESAP_TAG_LABEL, isApiFetchedAccount, isYeniHesaplarBrandId } from "@/lib/yeni-hesaplar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HesapVideoPanel, type AccountSelection } from "@/components/izlenme/hesap-video-panel";
import {
  FAMILY_COLOR,
  FAMILY_LABEL,
  VideoPlayerModal,
  VideoThumb,
  fmtCompact,
  type PlayableMedia,
} from "@/components/izlenme/link-thumb";
import { cn } from "@/lib/utils";

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  padding: "8px 10px",
  color: "var(--card-foreground)",
};

const TABS: { key: HesapTab; label: string; description: string; Icon: typeof Archive }[] = [
  {
    key: "eski",
    label: "Eski linkler",
    description: "Yeni hesaplardan önce eklediğimiz bütün linkler (açık, kapalı ve hata verenler dahil).",
    Icon: Archive,
  },
  {
    key: "aktif",
    label: "Aktif takip",
    description: "Şu an sayısını çekebildiğimiz bütün linkler (eski ve yeni).",
    Icon: CheckCircle2,
  },
  {
    key: "yeni",
    label: "Yeni hesaplar",
    description: "Bugün eklenen, daha önce hiç takip etmediğimiz hesaplar.",
    Icon: Sparkles,
  },
];

const FAMILIES: PlatformFamily[] = ["youtube", "instagram", "tiktok", "kick", "diger"];
const SORTS: { key: SortKey; label: string }[] = [
  { key: "views", label: "İzlenme" },
  { key: "videos", label: "Video sayısı" },
  { key: "recent", label: "Son ölçüm" },
  { key: "name", label: "İsim" },
];
const MAX_COMPARE = 4;
const VIDEO_PAGE = 60;

function displayHandle(g: AccountGroup) {
  return g.handle === UNKNOWN_HANDLE ? "Hesabı belirsiz linkler" : `@${g.handle}`;
}

function primaryMetricLabel(g: AccountGroup) {
  if (g.videos.length > 0) return "Toplam izlenme";
  if (g.family === "instagram") return "Takipçi";
  if (g.family === "youtube") return "Kanal izlenmesi";
  return "Toplam izlenme";
}

function relTime(iso: string | null) {
  if (!iso) return "Hiç ölçülmedi";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "1 saatten az önce";
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  return `${d} gün önce`;
}

export function HesapGrafikleri({
  links,
  brands,
  snapshots,
  viewMonth,
  todayYm,
}: {
  links: BrandLink[];
  brands: Brand[];
  snapshots: LinkSnapshot[];
  viewMonth: string;
  todayYm: string;
}) {
  const [tab, setTab] = useState<HesapTab>("eski");
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<PlatformFamily | "all">("all");
  const [sort, setSort] = useState<SortKey>("views");
  const [view, setView] = useState<"accounts" | "videos">("accounts");
  const [compare, setCompare] = useState<string[]>([]);
  const [selected, setSelected] = useState<AccountSelection | null>(null);
  const [playing, setPlaying] = useState<PlayableMedia | null>(null);
  const [videoLimit, setVideoLimit] = useState(VIDEO_PAGE);

  const brandNames = useMemo(
    () => Object.fromEntries(brands.map((b) => [b.id, b.shortName || b.name])),
    [brands]
  );

  const groupsByTab = useMemo(() => {
    const out = {} as Record<HesapTab, AccountGroup[]>;
    for (const t of TABS) out[t.key] = groupAccounts(links, t.key, viewMonth, snapshots, todayYm);
    return out;
  }, [links, snapshots, todayYm, viewMonth]);

  const linkCounts = useMemo(() => {
    const out = {} as Record<HesapTab, number>;
    for (const t of TABS) out[t.key] = links.filter((l) => linkInTab(l, t.key)).length;
    return out;
  }, [links]);

  const tabGroups = groupsByTab[tab];
  const familyCounts = useMemo(() => {
    const out: Partial<Record<PlatformFamily, number>> = {};
    for (const g of tabGroups) out[g.family] = (out[g.family] ?? 0) + 1;
    return out;
  }, [tabGroups]);

  const filtered = useMemo(
    () => sortAccounts(filterAccounts(tabGroups, query, family), sort),
    [family, query, sort, tabGroups]
  );

  const allVideos = useMemo(
    () => filtered.flatMap((g) => g.videos).sort((a, b) => b.views - a.views),
    [filtered]
  );

  useEffect(() => {
    setVideoLimit(VIDEO_PAGE);
  }, [tab, query, family, sort]);

  const compared = useMemo(
    () =>
      compare
        .map((key) => tabGroups.find((g) => g.key === key))
        .filter((g): g is AccountGroup => Boolean(g)),
    [compare, tabGroups]
  );

  const totals = useMemo(() => {
    const tabLinks = links.filter((l) => linkInTab(l, tab));
    const videoLinks = filtered.reduce((s, g) => s + g.videos.length, 0);
    const videoViews = filtered.reduce((s, g) => s + g.videoViews, 0);
    const apiOk = tabLinks.filter((l) => isApiFetchedAccount(l)).length;
    const errors = tabLinks.filter(
      (l) => l.lastCheckError?.trim() || (l.lastRefreshStatus && l.lastRefreshStatus !== "ok")
    ).length;
    const passive = tabLinks.filter((l) => l.status !== "active").length;
    return { accounts: filtered.length, videoLinks, videoViews, apiOk, errors, passive, linkTotal: tabLinks.length };
  }, [filtered, links, tab]);

  const pendingNew = useMemo(
    () =>
      links.filter(
        (l) => isYeniHesaplarBrandId(l.brandId) && l.status === "active" && l.url?.trim() && !isApiFetchedAccount(l)
      ),
    [links]
  );

  function toggleCompare(key: string) {
    setCompare((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : prev.length >= MAX_COMPARE ? prev : [...prev, key]
    );
  }

  function openGroup(g: AccountGroup) {
    setSelected({
      platform: g.platform,
      handle: g.handle,
      views: g.views,
      channelViews: g.profileMetric,
      links: g.videos.length,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {TABS.map(({ key, label, description, Icon }) => {
          const active = tab === key;
          const groups = groupsByTab[key];
          const views = groups.reduce((s, g) => s + g.views, 0);
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                setCompare([]);
              }}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                  : "border-border/70 bg-card hover:border-foreground/30"
              )}
            >
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Icon size={15} className={active ? "text-primary" : "text-muted-foreground"} />
                {label}
              </div>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {groups.length}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  hesap · {linkCounts[key]} link · {fmtCompact(views)}
                </span>
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{description}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Hesap" value={String(totals.accounts)} />
        <Kpi label="Video" value={totals.videoLinks.toLocaleString("tr-TR")} />
        <Kpi label="Videoların toplam izlenmesi" value={fmtCompact(totals.videoViews)} />
        <Kpi
          label="Sayısı çekilen link"
          value={`${totals.apiOk} / ${totals.linkTotal}`}
          hint={totals.linkTotal ? `%${Math.round((totals.apiOk / totals.linkTotal) * 100)}` : undefined}
        />
        <Kpi label="Hata veren link" value={String(totals.errors)} tone={totals.errors > 0 ? "warn" : undefined} />
        <Kpi label="Kapalı link" value={String(totals.passive)} />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-2.5 lg:flex-row lg:items-center">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hesap adı veya link ara"
            className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-7 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Temizle"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Chip active={family === "all"} onClick={() => setFamily("all")}>
            Tümü ({tabGroups.length})
          </Chip>
          {FAMILIES.filter((f) => familyCounts[f]).map((f) => (
            <Chip key={f} active={family === f} onClick={() => setFamily(f)} color={FAMILY_COLOR[f]}>
              {FAMILY_LABEL[f]} ({familyCounts[f]})
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="Sırala"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                Sırala: {s.label}
              </option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => setView("accounts")}
              className={cn(
                "inline-flex h-8 items-center gap-1 px-2 text-xs",
                view === "accounts" ? "bg-foreground text-background" : "text-muted-foreground"
              )}
            >
              <LayoutList size={13} /> Hesaplar
            </button>
            <button
              type="button"
              onClick={() => setView("videos")}
              className={cn(
                "inline-flex h-8 items-center gap-1 px-2 text-xs",
                view === "videos" ? "bg-foreground text-background" : "text-muted-foreground"
              )}
            >
              <Grid3x3 size={13} /> Videolar
            </button>
          </div>
        </div>
      </div>

      {tab === "yeni" && pendingNew.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <span>
            <strong>{pendingNew.length} yeni hesabın</strong> sayısı henüz çekilemedi:{" "}
            {pendingNew.map((l) => `@${l.handle}`).join(", ")}
          </span>
          <Link href="/izlenme/yeni-hesaplar" className="inline-flex items-center gap-0.5 font-medium text-primary">
            Şimdi ölç <ChevronRight size={13} />
          </Link>
        </div>
      )}

      {compared.length > 0 ? (
        <ComparePanel
          groups={compared}
          brandNames={brandNames}
          onRemove={toggleCompare}
          onClear={() => setCompare([])}
          onOpen={openGroup}
          onPlay={setPlaying}
        />
      ) : (
        filtered.length > 0 && (
          <Card className="border-border/60">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">En çok izlenen hesaplar</CardTitle>
              <CardDescription className="text-xs">
                Bir hesaba tıkla, bütün videoları açılsın. Kartlardan en fazla {MAX_COMPARE} hesabı seçip yan yana
                karşılaştırabilirsin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccountChart groups={filtered.filter((g) => g.handle !== UNKNOWN_HANDLE)} onOpen={openGroup} />
            </CardContent>
          </Card>
        )
      )}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Bu filtrede hesap yok.
        </p>
      ) : view === "accounts" ? (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((g) => (
            <AccountCard
              key={g.key}
              group={g}
              brandNames={brandNames}
              comparing={compare.includes(g.key)}
              compareFull={compare.length >= MAX_COMPARE}
              loadRemote={tab === "yeni"}
              onCompare={() => toggleCompare(g.key)}
              onOpen={() => openGroup(g)}
              onPlay={setPlaying}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {allVideos.length.toLocaleString("tr-TR")} video · izlenmeye göre sıralı
          </p>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
            {allVideos.slice(0, videoLimit).map((v) => (
              <div key={v.link.id} className="min-w-0 space-y-1">
                <VideoThumb
                  media={{
                    url: v.link.url,
                    views: v.views,
                    family: v.family,
                    title: v.link.notes && v.link.notes !== "Yeni hesap" ? v.link.notes : undefined,
                  }}
                  badge={v.link.status !== "active" ? "Pasif" : undefined}
                  onPlay={setPlaying}
                />
                <p className="truncate text-[10px] text-muted-foreground">
                  {v.handle === UNKNOWN_HANDLE ? "—" : `@${v.handle}`} ·{" "}
                  {v.brandIds.filter((id) => !isYeniHesaplarBrandId(id)).map((id) => brandNames[id] ?? id).join(", ")}
                </p>
              </div>
            ))}
          </div>
          {allVideos.length > videoLimit && (
            <button
              type="button"
              onClick={() => setVideoLimit((n) => n + VIDEO_PAGE)}
              className="w-full rounded-md border border-border py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Daha fazla göster ({(allVideos.length - videoLimit).toLocaleString("tr-TR")} kaldı)
            </button>
          )}
        </div>
      )}

      {selected && (
        <HesapVideoPanel
          selection={selected}
          links={links}
          brandNames={brandNames}
          onClose={() => setSelected(null)}
        />
      )}
      {playing && <VideoPlayerModal media={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-3 py-2",
        tone === "warn" ? "border-amber-500/40" : "border-border/70"
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">
        {value}
        {hint && <span className="ml-1 text-xs font-normal text-muted-foreground">{hint}</span>}
      </p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs",
        active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

function AccountChart({ groups, onOpen }: { groups: AccountGroup[]; onOpen: (g: AccountGroup) => void }) {
  const shown = groups.slice(0, 12).map((g) => ({ ...g, name: displayHandle(g) }));
  if (shown.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, shown.length * 32)}>
      <BarChart data={shown} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={(props: { x?: number; y?: number; payload?: { value?: string } }) => {
            const row = shown.find((r) => r.name === props.payload?.value);
            return (
              <text
                x={props.x}
                y={props.y}
                dy={4}
                textAnchor="end"
                fill="var(--foreground)"
                fontSize={11}
                style={{ cursor: "pointer" }}
                onClick={() => row && onOpen(row)}
              >
                {props.payload?.value}
              </text>
            );
          }}
        />
        <RTooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value: number, _n, item) => {
            const row = item?.payload as AccountGroup | undefined;
            return [fmtCompact(Number(value)), row ? primaryMetricLabel(row) : "İzlenme"];
          }}
          labelFormatter={(_l, payload) => {
            const row = payload?.[0]?.payload as AccountGroup | undefined;
            if (!row) return "";
            return `${FAMILY_LABEL[row.family]} · ${row.videos.length} video · tıkla`;
          }}
        />
        <Bar
          dataKey="views"
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
          cursor="pointer"
          onClick={(state) => {
            const row = (state as { payload?: AccountGroup }).payload;
            if (row) onOpen(row);
          }}
        >
          {shown.map((g) => (
            <Cell key={g.key} fill={FAMILY_COLOR[g.family]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function useRemoteVideos(group: AccountGroup, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<ProfilePostItem[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  useEffect(() => {
    if (!enabled || items || state !== "idle" || !ref.current || group.handle === UNKNOWN_HANDLE) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      setState("loading");
      const params = new URLSearchParams({ platform: group.platform, handle: group.handle });
      void fetch(`/api/admin/account-videos?${params}`, { credentials: "include" })
        .then(async (res) => {
          const json = (await res.json()) as { ok?: boolean; items?: ProfilePostItem[] };
          if (res.ok && json.ok) {
            setItems(json.items ?? []);
            setState("idle");
          } else setState("error");
        })
        .catch(() => setState("error"));
    });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, group.handle, group.platform, items, state]);
  return { ref, items, state };
}

function AccountCard({
  group,
  brandNames,
  comparing,
  compareFull,
  loadRemote,
  onCompare,
  onOpen,
  onPlay,
}: {
  group: AccountGroup;
  brandNames: Record<string, string>;
  comparing: boolean;
  compareFull: boolean;
  loadRemote: boolean;
  onCompare: () => void;
  onOpen: () => void;
  onPlay: (m: PlayableMedia) => void;
}) {
  const needsRemote = loadRemote && group.videos.length === 0;
  const remote = useRemoteVideos(group, needsRemote);
  const strip: PlayableMedia[] =
    group.videos.length > 0
      ? group.videos.slice(0, 6).map((v) => ({ url: v.link.url, views: v.views, family: group.family }))
      : (remote.items ?? []).slice(0, 6).map((it) => ({
          url: it.url,
          views: it.views ?? null,
          family: group.family,
          title: it.title,
          thumbnailUrl: it.thumbnailUrl,
        }));
  const color = FAMILY_COLOR[group.family];
  const avg = group.videos.length > 0 ? group.videoViews / group.videos.length : 0;
  const brandsLabel = group.brandIds
    .filter((id) => !isYeniHesaplarBrandId(id))
    .map((id) => brandNames[id] ?? id);

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-card p-3 transition-shadow",
        comparing ? "border-primary ring-1 ring-primary/40" : "border-border/70 hover:shadow-sm"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
            <span className="truncate text-sm font-semibold hover:underline">{displayHandle(group)}</span>
            {group.isNew && (
              <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-semibold text-primary">YENİ</span>
            )}
            {group.tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "rounded px-1 py-0.5 text-[9px] font-semibold",
                  tag === "naz"
                    ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
                    : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                )}
              >
                {HESAP_TAG_LABEL[tag]}
              </span>
            ))}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {FAMILY_LABEL[group.family]}
            {brandsLabel.length > 0 &&
              ` · ${brandsLabel.slice(0, 3).join(", ")}${brandsLabel.length > 3 ? ` +${brandsLabel.length - 3}` : ""}`}
          </p>
        </button>
        <label
          className={cn(
            "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-1.5 py-1 text-[11px]",
            comparing ? "border-primary text-primary" : "border-border text-muted-foreground",
            !comparing && compareFull && "cursor-not-allowed opacity-50"
          )}
        >
          <input
            type="checkbox"
            checked={comparing}
            disabled={!comparing && compareFull}
            onChange={onCompare}
            className="h-3 w-3"
          />
          Karşılaştır
        </label>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <CardStat label={primaryMetricLabel(group)} value={fmtCompact(group.views)} />
        <CardStat label="Video" value={String(group.videos.length || (remote.items?.length ?? 0))} />
        <CardStat label={group.videos.length > 0 ? "Video başına" : "Son ölçüm"} value={group.videos.length > 0 ? fmtCompact(avg) : relTime(group.lastCheckedAt)} />
      </div>

      <div ref={remote.ref} className="mt-2.5 grid grid-cols-6 gap-1">
        {strip.map((m) => (
          <VideoThumb key={m.url} media={m} onPlay={onPlay} compact />
        ))}
        {strip.length === 0 && (
          <p className="col-span-6 rounded-md border border-dashed border-border px-2 py-4 text-center text-[11px] text-muted-foreground">
            {remote.state === "loading"
              ? "Hesabın son videoları yükleniyor…"
              : remote.state === "error"
                ? "Videolar şu an getirilemedi."
                : "Bu hesabın kayıtlı videosu yok. “Bütün videolar” ile kanalı aç."}
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {group.errorLinks > 0 ? (
            <span className="text-amber-600">{group.errorLinks} linkte hata</span>
          ) : (
            "Hepsi ölçülüyor"
          )}
          {group.videos.length > 0 && ` · son ölçüm ${relTime(group.lastCheckedAt)}`}
        </span>
        <button type="button" onClick={onOpen} className="inline-flex items-center font-medium text-primary">
          Bütün videolar <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-1 py-1">
      <p className="truncate text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ComparePanel({
  groups,
  brandNames,
  onRemove,
  onClear,
  onOpen,
  onPlay,
}: {
  groups: AccountGroup[];
  brandNames: Record<string, string>;
  onRemove: (key: string) => void;
  onClear: () => void;
  onOpen: (g: AccountGroup) => void;
  onPlay: (m: PlayableMedia) => void;
}) {
  const max = Math.max(1, ...groups.map((g) => g.views));
  const rows: { label: string; get: (g: AccountGroup) => string; best?: (g: AccountGroup) => number }[] = [
    { label: "Platform", get: (g) => FAMILY_LABEL[g.family] },
    { label: "Toplam", get: (g) => `${fmtCompact(g.views)} ${primaryMetricLabel(g).toLowerCase()}`, best: (g) => g.views },
    { label: "Video linki", get: (g) => String(g.videos.length), best: (g) => g.videos.length },
    {
      label: "Video başına",
      get: (g) => (g.videos.length ? fmtCompact(g.videoViews / g.videos.length) : "—"),
      best: (g) => (g.videos.length ? g.videoViews / g.videos.length : 0),
    },
    { label: "En iyi video", get: (g) => (g.videos[0] ? fmtCompact(g.videos[0].views) : "—"), best: (g) => g.videos[0]?.views ?? 0 },
    { label: "Kanal / takipçi", get: (g) => (g.profileMetric ? fmtCompact(g.profileMetric) : "—") },
    { label: "Ölçülen link", get: (g) => `${g.apiOkLinks}/${g.videos.length + g.profiles.length}` },
    { label: "Hata veren link", get: (g) => String(g.errorLinks) },
    { label: "Son ölçüm", get: (g) => relTime(g.lastCheckedAt) },
    {
      label: "Markalar",
      get: (g) =>
        g.brandIds
          .filter((id) => !isYeniHesaplarBrandId(id))
          .map((id) => brandNames[id] ?? id)
          .join(", ") || "—",
    },
  ];

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm">Karşılaştırma ({groups.length})</CardTitle>
          <CardDescription className="text-xs">Her satırda en iyi değer yeşil.</CardDescription>
        </div>
        <button type="button" onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">
          Temizle
        </button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr>
              <th className="w-36" />
              {groups.map((g) => (
                <th key={g.key} className="px-2 pb-2 text-left align-top font-normal">
                  <div className="flex items-start justify-between gap-1">
                    <button type="button" onClick={() => onOpen(g)} className="truncate text-sm font-semibold hover:underline">
                      {displayHandle(g)}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(g.key)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Çıkar"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(g.views / max) * 100}%`, background: FAMILY_COLOR[g.family] }}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {g.videos.slice(0, 3).map((v) => (
                      <VideoThumb
                        key={v.link.id}
                        media={{ url: v.link.url, views: v.views, family: g.family }}
                        onPlay={onPlay}
                        compact
                      />
                    ))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const bestVal = row.best && groups.length > 1 ? Math.max(...groups.map(row.best)) : null;
              return (
                <tr key={row.label} className="border-t border-border/60">
                  <td className="py-1.5 pr-2 text-muted-foreground">{row.label}</td>
                  {groups.map((g) => {
                    const isBest = bestVal != null && bestVal > 0 && row.best?.(g) === bestVal;
                    return (
                      <td
                        key={g.key}
                        className={cn(
                          "px-2 py-1.5 tabular-nums",
                          isBest && "font-semibold text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {row.get(g)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
