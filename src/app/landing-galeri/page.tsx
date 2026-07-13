"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Clapperboard,
  AlertTriangle,
} from "lucide-react";
import { useAuth, landingFor } from "@/store/auth";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  buildItemFromParsed,
  galleryViewsLabel,
  type LandingGalleryItem,
  type LandingGalleryPlatform,
} from "@/lib/landing-gallery";
import { cn } from "@/lib/utils";

type GalleryRow = LandingGalleryItem & {
  viewsLabel?: string;
  liveViews?: number | null;
};

type RankedClip = GalleryRow & {
  linkId: string;
  handle: string | null;
  lastSnapshotDate: string | null;
  staleDays: number | null;
  kind: "short" | "reel" | "video" | "post";
};

type PlatformFilter = "all" | LandingGalleryPlatform;
type KindFilter = "all" | "short" | "reel" | "video" | "post";

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  other: "Diğer",
};

const KIND_LABEL: Record<string, string> = {
  short: "Short / Shorts",
  reel: "Reel",
  video: "Video",
  post: "Post",
};

export default function LandingGaleriAdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const allowed = user?.role === "admin";

  const [items, setItems] = useState<GalleryRow[]>([]);
  const [ranked, setRanked] = useState<RankedClip[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    byPlatform: Record<string, number>;
    staleOver7d: number;
    minViews: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [minViews, setMinViews] = useState(100_000);
  const [search, setSearch] = useState("");

  const [urlDraft, setUrlDraft] = useState("");
  const [brandDraft, setBrandDraft] = useState("Padişahbet");
  const [viewsDraft, setViewsDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    if (user && !allowed) router.replace(landingFor(user.role, user));
  }, [user, allowed, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/landing-gallery?minViews=${minViews}&limit=150`);
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        items?: GalleryRow[];
        ranked?: RankedClip[];
        stats?: {
          total: number;
          byPlatform: Record<string, number>;
          staleOver7d: number;
          minViews: number;
        };
      };
      if (!res.ok || !data.ok) {
        setFlash(data.error ?? "Yüklenemedi");
        return;
      }
      setItems(data.items ?? []);
      setRanked(data.ranked ?? []);
      setStats(data.stats ?? null);
      setFlash(null);
    } catch {
      setFlash("Ağ hatası");
    } finally {
      setBusy(false);
    }
  }, [minViews]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const filteredRanked = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ranked.filter((r) => {
      if (platformFilter !== "all" && r.platform !== platformFilter) return false;
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        r.brand.toLowerCase().includes(q) ||
        (r.handle ?? "").toLowerCase().includes(q) ||
        (r.title ?? "").toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q) ||
        r.externalId.toLowerCase().includes(q)
      );
    });
  }, [ranked, platformFilter, kindFilter, search]);

  const putAction = async (action: "save" | "syncViews" | "sortByViews") => {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/landing-gallery", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, action }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; items?: GalleryRow[] };
      if (!res.ok || !data.ok) {
        setFlash(data.error ?? "İşlem başarısız");
        return;
      }
      setItems(data.items ?? []);
      setFlash(
        action === "save"
          ? "Landing galeri kaydedildi."
          : action === "syncViews"
            ? "İzlenmeler brand_links’ten güncellendi ve kaydedildi."
            : "İzlenmeye göre sıralandı ve kaydedildi."
      );
      if (action !== "save") void load();
    } catch {
      setFlash("Ağ hatası");
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= items.length) return;
    setItems((prev) => {
      const copy = [...prev];
      const tmp = copy[index]!;
      copy[index] = copy[next]!;
      copy[next] = tmp;
      return copy;
    });
  };

  const removeAt = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = (item: LandingGalleryItem) => {
    setItems((prev) => {
      if (prev.some((p) => p.id === item.id)) {
        setFlash("Bu içerik zaten listede.");
        return prev;
      }
      if (prev.length >= 12) {
        setFlash("En fazla 12 içerik.");
        return prev;
      }
      setFlash(null);
      return [...prev, { ...item, viewsLabel: galleryViewsLabel(item.views) }];
    });
  };

  const addFromUrl = () => {
    const views = Number(String(viewsDraft).replace(/\./g, "").replace(/,/g, "")) || 0;
    const built = buildItemFromParsed({
      url: urlDraft,
      brand: brandDraft,
      views,
      title: titleDraft || undefined,
    });
    if (!built) {
      setFlash("URL tanınamadı. YouTube Shorts / TikTok / Instagram Reel linki yapıştır.");
      return;
    }
    addItem(built);
    setUrlDraft("");
    setViewsDraft("");
    setTitleDraft("");
  };

  const addTopN = (n: number) => {
    const pool = filteredRanked.filter((r) => !items.some((it) => it.id === r.id));
    const pick = pool.slice(0, n);
    if (pick.length === 0) {
      setFlash("Eklenecek yeni içerik yok (filtreye uyanlar zaten listede).");
      return;
    }
    setItems((prev) => {
      const next = [...prev];
      for (const p of pick) {
        if (next.length >= 12) break;
        if (!next.some((x) => x.id === p.id)) next.push(p);
      }
      return next;
    });
    setFlash(`Filtredeki en yüksek ${pick.length} içerik listeye eklendi — Kaydet’e bas.`);
  };

  if (!allowed) return null;

  return (
    <PageShell>
      <PageHeader
        title="Landing galeri"
        description="Shorts, Reels, TikTok, YouTube — en çok izlenenleri gör, sırala, galeriye al. İzlenmeler brand_links snapshot’larından kontrol edilir."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={busy}>
              <RefreshCw className={cn("mr-2 h-4 w-4", busy && "animate-spin")} />
              Yenile
            </Button>
            <Button variant="outline" onClick={() => void putAction("syncViews")} disabled={busy}>
              İzlenme senkron
            </Button>
            <Button variant="outline" onClick={() => void putAction("sortByViews")} disabled={busy}>
              <ArrowUpDown className="mr-2 h-4 w-4" />
              İzlenmeye sırala
            </Button>
            <Button onClick={() => void putAction("save")} disabled={busy}>
              <Save className="mr-2 h-4 w-4" />
              Kaydet
            </Button>
          </div>
        }
      />

      {flash && (
        <p className="mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">{flash}</p>
      )}

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Card>
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">Sıralı havuz</p>
              <p className="text-xl font-semibold tabular-nums">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">YouTube</p>
              <p className="text-xl font-semibold tabular-nums">{stats.byPlatform.youtube ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">TikTok</p>
              <p className="text-xl font-semibold tabular-nums">{stats.byPlatform.tiktok ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">Instagram</p>
              <p className="text-xl font-semibold tabular-nums">{stats.byPlatform.instagram ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> 7g+ eski snapshot
              </p>
              <p className="text-xl font-semibold tabular-nums">{stats.staleOver7d}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        {/* Aktif galeri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clapperboard className="h-4 w-4" />
              Landing’de görünen ({items.length}/12)
            </CardTitle>
            <CardDescription>
              Üst = soldaki ilk kart. Kaydetmeden canlıya yansımaz. “İzlenme senkron” DB’deki son
              snapshot’ı yazar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">Liste boş — sağdan en yüksekleri ekle.</p>
            )}
            {items.map((it, i) => (
              <div
                key={it.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground">#{i + 1}</span>
                  <div
                    className="h-14 w-10 shrink-0 overflow-hidden rounded bg-muted"
                    style={{ background: `${it.color}33` }}
                  >
                    {it.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {PLATFORM_LABEL[it.platform] ?? it.platform}
                      </Badge>
                      <span className="truncate text-sm font-semibold">{it.brand}</span>
                      <span className="text-xs tabular-nums font-semibold text-foreground">
                        {it.viewsLabel ?? galleryViewsLabel(it.views)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{it.title || it.url}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => window.open(it.url, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeAt(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground">URL ile ekle</p>
              <Input
                placeholder="YouTube Shorts / TikTok / Instagram Reel URL"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Marka" value={brandDraft} onChange={(e) => setBrandDraft(e.target.value)} />
                <Input
                  placeholder="İzlenme"
                  value={viewsDraft}
                  onChange={(e) => setViewsDraft(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <Input placeholder="Başlık (opsiyonel)" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} />
              <Button type="button" variant="secondary" className="w-full" onClick={addFromUrl}>
                <Plus className="mr-2 h-4 w-4" />
                Listeye ekle
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sıralı keşif */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">En çok izlenenler (sıralı)</CardTitle>
            <CardDescription>
              YouTube Shorts, TikTok, Instagram Reel — brand_links izlenme ↓. Filtreleyip ekle; eski
              snapshot’lar turuncu uyarı alır.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "Tümü"],
                  ["youtube", "YouTube"],
                  ["tiktok", "TikTok"],
                  ["instagram", "Instagram"],
                ] as const
              ).map(([k, label]) => (
                <Button
                  key={k}
                  type="button"
                  size="sm"
                  variant={platformFilter === k ? "default" : "outline"}
                  onClick={() => setPlatformFilter(k)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "Tüm türler"],
                  ["short", "Shorts / TikTok"],
                  ["reel", "IG Reel"],
                  ["video", "YT Video"],
                ] as const
              ).map(([k, label]) => (
                <Button
                  key={k}
                  type="button"
                  size="sm"
                  variant={kindFilter === k ? "secondary" : "ghost"}
                  onClick={() => setKindFilter(k)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-[140px]"
                type="number"
                min={0}
                step={100000}
                value={minViews}
                onChange={(e) => setMinViews(Number(e.target.value) || 0)}
                onBlur={() => void load()}
              />
              <span className="text-xs text-muted-foreground">min izlenme</span>
              <Input
                className="min-w-[160px] flex-1"
                placeholder="Ara: marka, handle, id…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => addTopN(4)} disabled={busy}>
                Top 4 ekle
              </Button>
            </div>

            <div className="max-h-[620px] space-y-1.5 overflow-y-auto pr-1">
              {filteredRanked.length === 0 && (
                <p className="text-sm text-muted-foreground">Filtreye uyan içerik yok.</p>
              )}
              {filteredRanked.map((s, idx) => {
                const already = items.some((it) => it.id === s.id);
                const stale = (s.staleDays ?? 0) >= 7;
                return (
                  <button
                    key={s.linkId}
                    type="button"
                    disabled={already || busy}
                    onClick={() => addItem(s)}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition hover:bg-muted/50 disabled:opacity-45",
                      stale ? "border-amber-500/40 bg-amber-500/5" : "border-border"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="mb-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground">#{idx + 1}</span>
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {PLATFORM_LABEL[s.platform]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {KIND_LABEL[s.kind] ?? s.kind}
                        </Badge>
                        {stale && (
                          <Badge variant="outline" className="border-amber-500/50 text-[10px] text-amber-700 dark:text-amber-300">
                            {s.staleDays}g eski
                          </Badge>
                        )}
                        {already && (
                          <Badge className="text-[10px]" variant="secondary">
                            Galeride
                          </Badge>
                        )}
                      </span>
                      <span className="block truncate font-medium">
                        {s.brand}
                        {s.handle ? ` · @${s.handle.replace(/^@/, "")}` : ""}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.title || s.externalId}
                        {s.lastSnapshotDate ? ` · snap ${s.lastSnapshotDate}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-base font-semibold tabular-nums">
                        {s.viewsLabel ?? galleryViewsLabel(s.views)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">tıkla = ekle</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
