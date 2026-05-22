"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, ExternalLink, Instagram,
  Link2, Loader2, Music2, Radar, RefreshCw, Wifi, WifiOff, Youtube, Zap,
} from "lucide-react";
import { useStore } from "@/store/store";
import { useIsReadOnly, useAuth } from "@/store/auth";
import { AutoRefreshStatusPanel } from "@/components/auto-refresh-status-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IzlenmeNavbar } from "@/components/izlenme/izlenme-navbar";
import { totalLinkViewsForMonth } from "@/lib/brand-month-metrics";
import { applyLinkMetricsToStore } from "@/lib/social-api/link-store-sync";
import { useIzlenmeViewMonth } from "@/lib/use-izlenme-view-month";

const fmtViews = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
};

type PingState = { status: "idle" | "running" | "ok" | "error"; latencyMs?: number; message?: string };

export default function IzlenmeApiPage() {
  const readOnly = useIsReadOnly();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "auditor";
  const { brands, brandLinks, linkSnapshots, pushNotification, updateBrandLink, upsertLinkSnapshot } = useStore();
  const { viewMonth, setViewMonth, todayYm } = useIzlenmeViewMonth();
  const [pings, setPings] = useState<Record<string, PingState>>({
    instagram: { status: "idle" },
    youtube: { status: "idle" },
    tiktok: { status: "idle" },
  });
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});

  const totalBrands = brands.filter((b) => b.status === "active").length;
  const totalStreamers = new Set(brandLinks.map((l) => l.ownerId).filter(Boolean)).size;
  const totalLinks = brandLinks.filter((l) => l.status === "active").length;
  const totalViews = useMemo(
    () => totalLinkViewsForMonth(brandLinks, viewMonth, linkSnapshots, todayYm),
    [brandLinks, linkSnapshots, viewMonth, todayYm]
  );

  async function runPing(platform: "instagram" | "youtube" | "tiktok") {
    setPings((p) => ({ ...p, [platform]: { status: "running" } }));
    try {
      const res = await fetch(`/api/admin/api-ping?platform=${platform}`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      setPings((p) => ({
        ...p,
        [platform]: {
          status: json.ok ? "ok" : "error",
          latencyMs: json.latencyMs,
          message: json.message ?? (json.ok ? "Probe başarılı" : "Probe başarısız"),
        },
      }));
      if (!json.ok) {
        pushNotification({
          type: "api_refresh_alert",
          title: `${platform} API ping başarısız`,
          message: json.message ?? `${platform} probe başarısız (HTTP ${json.status ?? "?"})`,
          forRole: "admin",
        });
      }
    } catch (e: unknown) {
      setPings((p) => ({
        ...p,
        [platform]: { status: "error", message: e instanceof Error ? e.message : "Ağ hatası" },
      }));
    }
  }

  async function refreshSingle(linkId: string) {
    setRefreshing((s) => ({ ...s, [linkId]: true }));
    try {
      const res = await fetch(`/api/admin/refresh-link/${linkId}`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      const update = json?.result?.linkUpdate;
      if (json?.result?.ok && update) {
        applyLinkMetricsToStore(linkId, update, { updateBrandLink, upsertLinkSnapshot });
      }
    } finally {
      setRefreshing((s) => ({ ...s, [linkId]: false }));
    }
  }

  const apiSummary = useMemo(() => {
    const apiLinks = brandLinks.filter((l) => {
      if (l.status !== "active") return false;
      const p = l.platform.toLowerCase();
      return p.includes("youtube") || p.includes("instagram") || p.includes("tiktok");
    });
    const now = Date.now();
    const stale = apiLinks.filter((l) => {
      if (!l.lastCheckedAt) return true;
      return now - new Date(l.lastCheckedAt).getTime() > 24 * 3_600_000;
    });
    const errors = apiLinks.filter((l) => !!l.lastCheckError);
    const autoTrack = apiLinks.filter((l) => l.autoTrack !== false);
    const platforms = ["Instagram", "YouTube", "TikTok"].map((label) => {
      const key = label.toLowerCase();
      const links = apiLinks.filter((l) => l.platform.toLowerCase().includes(key));
      const platformErrors = links.filter((l) => !!l.lastCheckError).length;
      const platformStale = links.filter((l) => {
        if (!l.lastCheckedAt) return true;
        return now - new Date(l.lastCheckedAt).getTime() > 24 * 3_600_000;
      }).length;
      return {
        label,
        links: links.length,
        autoTrack: links.filter((l) => l.autoTrack !== false).length,
        errors: platformErrors,
        stale: platformStale,
        views: links.reduce((s, l) => s + (l.lastViews ?? 0), 0),
      };
    });
    const lastChecked = apiLinks
      .map((l) => l.lastCheckedAt)
      .filter((v): v is string => !!v)
      .sort((a, b) => b.localeCompare(a))[0];
    // Bekleyen + hatalı linkler — tek tablo
    const seen = new Set<string>();
    const staleAndErrorLinks = [...errors, ...stale].filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
    return {
      apiLinks,
      autoTrack,
      stale,
      errors,
      platforms,
      lastChecked,
      staleAndErrorLinks,
    };
  }, [brandLinks]);

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1400px]">
      <IzlenmeNavbar
        viewMonth={viewMonth}
        onChangeMonth={setViewMonth}
        totalBrands={totalBrands}
        totalStreamers={totalStreamers}
        totalLinks={totalLinks}
        totalViews={totalViews}
        readOnly={readOnly}
      />

      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="gap-1 py-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Link2 size={12} /> API kapsamı
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className="text-2xl font-bold tabular-nums">{apiSummary.apiLinks.length}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {apiSummary.autoTrack.length} otomatik takipte · toplam {fmtViews(totalViews)}
            </p>
          </CardContent>
        </Card>

        <Card className="gap-1 py-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Clock size={12} /> Bekleyen yenileme
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className={`text-2xl font-bold tabular-nums ${apiSummary.stale.length > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
              {apiSummary.stale.length}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              24 saatten eski veya hiç kontrol edilmemiş
            </p>
          </CardContent>
        </Card>

        <Card className="gap-1 py-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle size={12} /> Son hata
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className={`text-2xl font-bold tabular-nums ${apiSummary.errors.length > 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
              {apiSummary.errors.length}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {apiSummary.errors.length > 0 ? "Panelden tek tek veya toplu yenileyin" : "Aktif hata görünmüyor"}
            </p>
          </CardContent>
        </Card>

        <Card className="gap-1 py-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <RefreshCw size={12} /> Son kontrol
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className="text-base font-bold tabular-nums">
              {apiSummary.lastChecked
                ? new Date(apiSummary.lastChecked).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Linklerde kayıtlı en son API kontrolü
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity size={15} /> Platform metrikleri
          </CardTitle>
          <CardDescription className="text-xs">
            Link sayısı, otomatik takip, bekleyen yenileme, hata ve canlı izlenme dağılımı.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {apiSummary.platforms.map((p) => (
            <div key={p.label} className="rounded-lg border border-border bg-card px-3 py-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-semibold">{p.label}</p>
                <Badge variant="outline" className="text-[10px] tabular-nums">
                  {p.links} link
                </Badge>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Otomatik takip</span>
                  <span className="font-medium">{p.autoTrack}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Bekleyen</span>
                  <span className={p.stale > 0 ? "text-amber-700 dark:text-amber-300 font-medium" : "text-emerald-700 dark:text-emerald-300 font-medium"}>
                    {p.stale}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Hata</span>
                  <span className={p.errors > 0 ? "text-red-700 dark:text-red-300 font-medium" : "text-emerald-700 dark:text-emerald-300 font-medium"}>
                    {p.errors}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Canlı izlenme</span>
                  <span className="font-medium tabular-nums">{fmtViews(p.views)}</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Platform ping testleri — ikonlu */}
      {isAdmin && !readOnly && (
        <Card className="mb-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Radar size={15} /> Canlı API ping
            </CardTitle>
            <CardDescription className="text-xs">
              Her platforma probe (canlı HTTP isteği) gönderir, gecikme ve durum bilgisini gösterir. Her test kotadan 1 düşer.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {([
              { key: "instagram", label: "Instagram", Icon: Instagram, color: "text-pink-600 dark:text-pink-300", bg: "bg-pink-50 dark:bg-pink-950/30" },
              { key: "youtube", label: "YouTube", Icon: Youtube, color: "text-red-600 dark:text-red-300", bg: "bg-red-50 dark:bg-red-950/30" },
              { key: "tiktok", label: "TikTok", Icon: Music2, color: "text-foreground", bg: "bg-muted/40" },
            ] as const).map(({ key, label, Icon, color, bg }) => {
              const st = pings[key];
              return (
                <div key={key} className={`rounded-lg border border-border ${bg} px-3 py-3 flex flex-col gap-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className={color} />
                      <span className="text-sm font-semibold">{label}</span>
                    </div>
                    {st.status === "ok" && (
                      <Badge variant="outline" className="text-[10px] gap-1 border-emerald-300 text-emerald-700 dark:border-emerald-500/45 dark:text-emerald-300">
                        <Wifi size={10} /> {st.latencyMs ? `${st.latencyMs}ms` : "ok"}
                      </Badge>
                    )}
                    {st.status === "error" && (
                      <Badge variant="outline" className="text-[10px] gap-1 border-red-300 text-red-700 dark:border-red-500/45 dark:text-red-300">
                        <WifiOff size={10} /> hata
                      </Badge>
                    )}
                    {st.status === "running" && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Loader2 size={10} className="animate-spin" /> probe...
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground min-h-[28px]">
                    {st.status === "idle"
                      ? "Henüz test edilmedi."
                      : st.status === "running"
                      ? "Canlı probe gönderiliyor..."
                      : st.message ?? (st.status === "ok" ? "Probe başarılı" : "Probe başarısız")}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 self-start"
                    disabled={st.status === "running"}
                    onClick={() => runPing(key)}
                  >
                    <Zap size={12} /> Ping gönder
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Bekleyen yenileme linkleri */}
      <Card className="mb-5">
        <CardHeader className="pb-2 flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock size={15} /> Bekleyen yenileme linkleri
              <Badge variant="outline" className="text-[10px] tabular-nums">
                {apiSummary.stale.length + apiSummary.errors.length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              24 saatten eski snapshot veya hata almış linkler — tek tıkla yenileyebilirsiniz.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {apiSummary.staleAndErrorLinks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-4 text-center">
              Bekleyen yenileme yok — tüm linkler güncel.
            </p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto -mx-1 px-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background z-10 border-b border-border">
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1.5 pr-2 font-medium">Marka</th>
                    <th className="py-1.5 pr-2 font-medium">Platform</th>
                    <th className="py-1.5 pr-2 font-medium">Son kontrol</th>
                    <th className="py-1.5 pr-2 font-medium">İzlenme</th>
                    <th className="py-1.5 pr-2 font-medium">Durum</th>
                    <th className="py-1.5 pr-2" />
                  </tr>
                </thead>
                <tbody>
                  {apiSummary.staleAndErrorLinks.map((l) => {
                    const brand = brands.find((b) => b.id === l.brandId);
                    const P = l.platform.toLowerCase().includes("instagram")
                      ? Instagram
                      : l.platform.toLowerCase().includes("youtube")
                      ? Youtube
                      : Music2;
                    const ageDays = l.lastCheckedAt
                      ? Math.floor((Date.now() - new Date(l.lastCheckedAt).getTime()) / 86_400_000)
                      : null;
                    return (
                      <tr key={l.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="py-1.5 pr-2 font-medium truncate max-w-[140px]">
                          {brand ? (
                            <Link href={`/izlenme/marka/${brand.id}`} className="hover:underline">
                              {brand.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          <div className="flex items-center gap-1.5">
                            <P size={12} className="text-muted-foreground" />
                            <span className="truncate max-w-[120px]">{l.handle ?? l.platform}</span>
                            {l.url && (
                              <a href={l.url} target="_blank" rel="noopener" className="text-blue-600 hover:text-blue-700">
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 pr-2 text-muted-foreground tabular-nums">
                          {l.lastCheckedAt
                            ? `${ageDays}g önce`
                            : <span className="text-amber-700 dark:text-amber-300">Hiç</span>}
                        </td>
                        <td className="py-1.5 pr-2 tabular-nums">{fmtViews(l.lastViews ?? 0)}</td>
                        <td className="py-1.5 pr-2">
                          {l.lastCheckError ? (
                            <Badge variant="outline" className="text-[9px] gap-1 border-red-300 text-red-700 dark:border-red-500/45 dark:text-red-300">
                              <AlertTriangle size={9} /> Hata
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] gap-1 border-amber-300 text-amber-700 dark:border-amber-500/45 dark:text-amber-300">
                              <Clock size={9} /> Bekliyor
                            </Badge>
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          {isAdmin && !readOnly && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Bu linki şimdi yenile"
                              disabled={refreshing[l.id]}
                              onClick={() => refreshSingle(l.id)}
                            >
                              {refreshing[l.id] ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <RefreshCw size={12} />
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1">
          <CheckCircle2 size={11} /> Detaylı snapshot paneli aşağıda
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1">
          <RefreshCw size={11} /> Otomatik yenileme, kota ve link logları korunuyor
        </span>
      </div>

      <AutoRefreshStatusPanel />
    </div>
  );
}
