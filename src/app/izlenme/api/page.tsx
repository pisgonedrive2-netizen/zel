"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, ExternalLink, Instagram,
  Heart, Link2, Loader2, MessageCircle, Music2, RefreshCw, Share2, Sparkles, Trash2, Youtube,
} from "lucide-react";
import { PlatformApiCapabilitiesGrid } from "@/components/platform-api-capabilities-card";
import { SOCIAL_PLANS } from "@/lib/social-api/config";
import { useStore } from "@/store/store";
import { useIsReadOnly, useAuth } from "@/store/auth";
import { AutoRefreshStatusPanel } from "@/components/auto-refresh-status-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IzlenmeNavbar } from "@/components/izlenme/izlenme-navbar";
import { totalLinkViewsForMonth } from "@/lib/brand-month-metrics";
import { applyLinkMetricsToStore } from "@/lib/social-api/link-store-sync";
import { deleteBrandLinkAsAdmin } from "@/lib/brand-link-delete";
import { isPostOrLinkGoneError } from "@/lib/social-api/link-gone";
import { useIzlenmeViewMonth } from "@/lib/use-izlenme-view-month";

const fmtViews = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
};

interface RefreshStatusPayload {
  ok: boolean;
  rapidApiEnabled?: boolean;
  platforms?: Array<{
    platform: "youtube" | "instagram" | "tiktok";
    label: string;
    requestsUsed: number;
    monthlyLimit: number;
    rateLimit: string;
    apiHost: string;
    health?: {
      status: string;
      connectivityStatus: string;
      lastPingAt: string | null;
      linksWithError: number;
    };
  }>;
}

export default function IzlenmeApiPage() {
  const readOnly = useIsReadOnly();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "auditor";
  const canDeleteLinks = user?.role === "admin";
  const { brands, brandLinks, linkSnapshots, pushNotification, updateBrandLink, upsertLinkSnapshot } = useStore();
  const {
    viewMonth,
    setViewMonth,
    todayYm,
    linkScope,
    setLinkScope,
    apiDateMode,
    setApiDateMode,
    filterLinks,
  } = useIzlenmeViewMonth();
  const scopedLinks = useMemo(
    () => filterLinks(brandLinks, linkSnapshots),
    [brandLinks, linkSnapshots, filterLinks]
  );
  const allActiveLinkCount = useMemo(
    () => brandLinks.filter((l) => l.status === "active").length,
    [brandLinks]
  );
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [apiStatus, setApiStatus] = useState<RefreshStatusPayload | null>(null);

  const loadApiStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/refresh-status", { credentials: "include" });
      const json = (await res.json()) as RefreshStatusPayload;
      if (json.ok) setApiStatus(json);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (isAdmin && !readOnly) void loadApiStatus();
  }, [isAdmin, readOnly, loadApiStatus]);

  const totalBrands = brands.filter((b) => b.status === "active").length;
  const totalStreamers = new Set(brandLinks.map((l) => l.ownerId).filter(Boolean)).size;
  const totalLinks = scopedLinks.length;
  const totalViews = useMemo(
    () => totalLinkViewsForMonth(scopedLinks, viewMonth, linkSnapshots, todayYm),
    [scopedLinks, linkSnapshots, viewMonth, todayYm]
  );

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

  const apiConnectivity = useMemo(() => {
    const plats = apiStatus?.platforms ?? [];
    const allOk = plats.length > 0 && plats.every((p) => p.health?.connectivityStatus === "ok");
    const anyDown = plats.some((p) => p.health?.connectivityStatus === "error");
    const linkErrors = plats.reduce((s, p) => s + (p.health?.linksWithError ?? 0), 0);
    return { allOk, anyDown, linkErrors, plats };
  }, [apiStatus]);

  const apiSummary = useMemo(() => {
    const apiLinks = scopedLinks.filter((l) => {
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
      const sum = (field: "lastLikes" | "lastComments" | "lastShares") =>
        links.reduce((s, l) => s + (l[field] ?? 0), 0);
      return {
        label,
        links: links.length,
        autoTrack: links.filter((l) => l.autoTrack !== false).length,
        errors: platformErrors,
        stale: platformStale,
        views: links.reduce((s, l) => s + (l.lastViews ?? 0), 0),
        likes: sum("lastLikes"),
        comments: sum("lastComments"),
        shares: sum("lastShares"),
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
    const goneLinks = staleAndErrorLinks.filter((l) => isPostOrLinkGoneError(l.lastCheckError));
    return {
      apiLinks,
      autoTrack,
      stale,
      errors,
      platforms,
      lastChecked,
      staleAndErrorLinks,
      goneLinks,
    };
  }, [scopedLinks]);

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1400px]">
      <IzlenmeNavbar
        viewMonth={viewMonth}
        onChangeMonth={setViewMonth}
        linkScope={linkScope}
        onLinkScopeChange={setLinkScope}
        apiDateMode={apiDateMode}
        onApiDateModeChange={setApiDateMode}
        totalBrands={totalBrands}
        totalStreamers={totalStreamers}
        totalLinks={totalLinks}
        totalAllLinks={allActiveLinkCount}
        totalViews={totalViews}
        readOnly={readOnly}
      />

      {isAdmin && !readOnly && apiStatus && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-xs ${
            !apiStatus.rapidApiEnabled
              ? "border-muted bg-muted/30 text-muted-foreground"
              : apiConnectivity.anyDown
                ? "border-red-300 bg-red-50/40 text-red-900 dark:border-red-500/45 dark:bg-red-950/30 dark:text-red-100"
                : apiConnectivity.linkErrors > 0
                  ? "border-amber-300 bg-amber-50/40 text-amber-900 dark:border-amber-500/45 dark:bg-amber-950/30 dark:text-amber-100"
                  : "border-emerald-300 bg-emerald-50/40 text-emerald-900 dark:border-emerald-500/45 dark:bg-emerald-950/30 dark:text-emerald-100"
          }`}
        >
          {!apiStatus.rapidApiEnabled ? (
            <p><strong>RapidAPI kapalı.</strong> Ortam değişkeninde <code className="text-[10px]">RAPIDAPI_KEY</code> tanımlı değil.</p>
          ) : apiConnectivity.anyDown ? (
            <p>
              <strong>API erişim sorunu.</strong> En az bir platformda bağlantı testi başarısız veya hiç yapılmamış.
              Ping başarılıysa aşağıdaki platform kartlarından <strong>Bağlantıyı test et</strong> ile kaydı güncelleyin.
            </p>
          ) : apiConnectivity.linkErrors > 0 ? (
            <p>
              <strong>RapidAPI erişilebilir</strong> ({apiConnectivity.linkErrors} link son yenilemede hata).
              Bu link hataları API&apos;nin kapalı olduğu anlamına gelmez — bekleyen linkleri tek tek veya toplu yenileyin.
            </p>
          ) : (
            <p><strong>Tüm platformlarda API bağlantısı sağlıklı.</strong> Otomatik yenileme ve manuel ping kayıtları güncel.</p>
          )}
        </div>
      )}

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
              <AlertTriangle size={12} /> Link hatası
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-0">
            <p className={`text-2xl font-bold tabular-nums ${apiSummary.errors.length > 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
              {apiSummary.errors.length}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {apiSummary.errors.length > 0
                ? "API ayakta olabilir — link yenilemesi başarısız"
                : "Son yenilemede link hatası yok"}
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
                <div className="flex justify-between gap-2 pt-1 border-t border-border/50">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Heart size={10} /> Beğeni
                  </span>
                  <span className="font-medium tabular-nums text-[11px]">{fmtViews(p.likes)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <MessageCircle size={10} /> Yorum
                  </span>
                  <span className="font-medium tabular-nums text-[11px]">{fmtViews(p.comments)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Share2 size={10} /> Paylaşım
                  </span>
                  <span className="font-medium tabular-nums text-[11px]">{fmtViews(p.shares)}</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {isAdmin && !readOnly && (
        <Card className="mb-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles size={15} className="text-violet-600 dark:text-violet-300" />
              API özellik kataloğu
            </CardTitle>
            <CardDescription className="text-xs">
              Yükseltilmiş planlarla kullanılabilir tüm endpoint&apos;ler. Her özelliği canlı test edebilirsiniz (1 kota / test).
              Otomatik yenileme yalnızca <strong>cron</strong> etiketli temel özellikleri kullanır.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlatformApiCapabilitiesGrid
              platforms={(["youtube", "instagram", "tiktok"] as const).map((platform) => {
                const plan = SOCIAL_PLANS[platform];
                const fromApi = apiStatus?.platforms?.find((p) => p.platform === platform);
                return {
                  platform,
                  label: plan.label,
                  apiHost: plan.apiHost,
                  monthlyLimit: fromApi?.monthlyLimit ?? plan.monthlyLimit,
                  requestsUsed: fromApi?.requestsUsed ?? 0,
                  rateLimit: plan.rateLimit,
                };
              })}
              onQuotaUsed={() => void loadApiStatus()}
            />
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
              24 saatten eski snapshot veya hata almış linkler — yenileyebilir veya gönderi yoksa silebilirsiniz
              (yayıncı panelinden de kaldırılır).
            </CardDescription>
          </div>
          {canDeleteLinks && !readOnly && apiSummary.goneLinks.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs border-red-300/60 text-red-700 dark:text-red-300"
              onClick={() => {
                void (async () => {
                  if (
                    !confirm(
                      `${apiSummary.goneLinks.length} linkin gönderisi mevcut değil. Hepsi silinsin mi?`
                    )
                  ) {
                    return;
                  }
                  for (const l of apiSummary.goneLinks) {
                    if (!brandLinks.some((x) => x.id === l.id)) continue;
                    const brand = brands.find((b) => b.id === l.brandId);
                    setDeleting((s) => ({ ...s, [l.id]: true }));
                    await deleteBrandLinkAsAdmin(l, {
                      brandName: brand?.name,
                      deletedByUserId: user?.id,
                      skipConfirm: true,
                    });
                    setDeleting((s) => ({ ...s, [l.id]: false }));
                  }
                })();
              }}
            >
              <Trash2 size={12} />
              Gönderisi olmayanları sil ({apiSummary.goneLinks.length})
            </Button>
          )}
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
                    const postGone = isPostOrLinkGoneError(l.lastCheckError);
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
                          {postGone ? (
                            <Badge variant="outline" className="text-[9px] gap-1 border-red-300 text-red-700 dark:border-red-500/45 dark:text-red-300">
                              <AlertTriangle size={9} /> Gönderi yok
                            </Badge>
                          ) : l.lastCheckError ? (
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
                          {(isAdmin || canDeleteLinks) && !readOnly && (
                            <div className="flex items-center gap-0.5">
                              {isAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                title="Bu linki şimdi yenile"
                                disabled={refreshing[l.id] || deleting[l.id]}
                                onClick={() => refreshSingle(l.id)}
                              >
                                {refreshing[l.id] ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <RefreshCw size={12} />
                                )}
                              </Button>
                              )}
                              {canDeleteLinks && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 dark:text-red-400"
                                title={
                                  postGone
                                    ? "Gönderi yok — linki sil (yayıncıdan da kaldırılır)"
                                    : "Linki sil (yayıncıdan da kaldırılır)"
                                }
                                disabled={refreshing[l.id] || deleting[l.id]}
                                onClick={() => {
                                  void (async () => {
                                    setDeleting((s) => ({ ...s, [l.id]: true }));
                                    await deleteBrandLinkAsAdmin(l, {
                                      brandName: brand?.name,
                                      deletedByUserId: user?.id,
                                    });
                                    setDeleting((s) => ({ ...s, [l.id]: false }));
                                  })();
                                }}
                              >
                                {deleting[l.id] ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Trash2 size={12} />
                                )}
                              </Button>
                              )}
                            </div>
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

      <AutoRefreshStatusPanel
        hideCapabilities
        viewMonth={viewMonth}
        linkScope={linkScope}
        apiDateMode={apiDateMode}
      />
    </div>
  );
}
