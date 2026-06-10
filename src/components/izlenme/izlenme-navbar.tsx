"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLink as Link } from "@/components/app-link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, AlertCircle, ArrowUpRight, Briefcase, ChevronLeft, ChevronRight,
  Eye, RefreshCw, Users, Wifi, WifiOff, Loader2, BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shiftCalendarMonthYm } from "@/lib/data";
import { resolveRefreshTargetDate, type IzlenmeApiDateMode, type IzlenmeLinkScope } from "@/lib/izlenme-refresh";
import { izlenmeHref } from "@/lib/use-izlenme-view-month";
import { useStore } from "@/store/store";
import { applyLinkMetricsToStore } from "@/lib/social-api/link-store-sync";
import type { LinkRefreshResult } from "@/lib/social-api/refresh-runner";
import { worstApiChipStatus } from "@/lib/social-api/health-summary";

interface PlatformHealthSummary {
  platform: string;
  status: "ok" | "warn" | "error" | "exhausted" | "unknown";
  connectivityStatus: "ok" | "warn" | "error" | "unknown";
  safeRemaining: number;
}

interface ApiRefreshSummary {
  rapidApiEnabled: boolean;
  cronIntervalHours: number;
  totalSafeRemaining: number;
  worstStatus: "ok" | "warn" | "error" | "exhausted" | "unknown";
  platforms: PlatformHealthSummary[];
  lastSuccessAt: string | null;
}

export interface IzlenmeNavbarProps {
  viewMonth: string;
  onChangeMonth: (next: string) => void;
  linkScope: IzlenmeLinkScope;
  onLinkScopeChange: (next: IzlenmeLinkScope) => void;
  apiDateMode: IzlenmeApiDateMode;
  onApiDateModeChange: (next: IzlenmeApiDateMode) => void;
  totalBrands: number;
  totalStreamers: number;
  totalLinks: number;
  totalAllLinks?: number;
  totalViews: number;
  readOnly?: boolean;
}

const STATUS_LABEL: Record<ApiRefreshSummary["worstStatus"], string> = {
  ok: "Sağlıklı",
  warn: "Dikkat",
  error: "Hata",
  exhausted: "Kota dolu",
  unknown: "Bilinmiyor",
};

const STATUS_TONE: Record<ApiRefreshSummary["worstStatus"], string> = {
  ok: "text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-500/45 dark:bg-emerald-950/40",
  warn: "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/45 dark:bg-amber-950/40",
  error: "text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/45 dark:bg-red-950/40",
  exhausted: "text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/45 dark:bg-red-950/40",
  unknown: "text-muted-foreground border-border bg-muted/40",
};

function fmtViews(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
}

function monthTitleYm(ym: string) {
  return new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
}

export function IzlenmeNavbar({
  viewMonth,
  onChangeMonth,
  linkScope,
  onLinkScopeChange,
  apiDateMode,
  onApiDateModeChange,
  totalBrands,
  totalStreamers,
  totalLinks,
  totalAllLinks,
  totalViews,
  readOnly,
}: IzlenmeNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { updateBrandLink, upsertLinkSnapshot } = useStore();
  const [api, setApi] = useState<ApiRefreshSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshLabel, setRefreshLabel] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const loadApi = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/refresh-status", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const platformsRaw = (data.platforms ?? []) as Array<{
        platform: string;
        safeRemaining: number;
        batchSizePerRun?: number;
        health?: {
          status?: string;
          connectivityStatus?: string;
          linksWithError?: number;
          lastSuccessAt?: string | null;
        };
      }>;
      const summary: ApiRefreshSummary = {
        rapidApiEnabled: !!data.rapidApiEnabled,
        cronIntervalHours: Number(data.cronIntervalHours ?? 0),
        totalSafeRemaining: platformsRaw.reduce((s, p) => s + (p.safeRemaining ?? 0), 0),
        worstStatus: "ok",
        platforms: platformsRaw.map((p) => ({
          platform: p.platform,
          status: (p.health?.status as PlatformHealthSummary["status"]) ?? "unknown",
          connectivityStatus:
            (p.health?.connectivityStatus as PlatformHealthSummary["connectivityStatus"]) ?? "unknown",
          safeRemaining: p.safeRemaining ?? 0,
        })),
        lastSuccessAt:
          platformsRaw
            .map((p) => p.health?.lastSuccessAt ?? null)
            .filter((v): v is string => !!v)
            .sort((a, b) => b.localeCompare(a))[0] ?? null,
      };
      summary.worstStatus = worstApiChipStatus(
        platformsRaw.map((p) => ({
          platform: p.platform,
          label: p.platform,
          batchSizePerRun: p.batchSizePerRun ?? 1,
          health: p.health
            ? {
                status: (p.health.status as PlatformHealthSummary["status"]) ?? "unknown",
                connectivityStatus: p.health.connectivityStatus as PlatformHealthSummary["connectivityStatus"],
                linksWithError: p.health.linksWithError,
              }
            : null,
        }))
      );
      setApi(summary);
      setLastFetch(Date.now());
    } catch {
      /* sessiz */
    }
  }, []);

  useEffect(() => {
    void loadApi();
    const t = setInterval(() => void loadApi(), 60_000);
    return () => clearInterval(t);
  }, [loadApi]);

  const onRefreshAll = useCallback(async () => {
    if (readOnly || refreshing) return;
    setRefreshing(true);
    setRefreshLabel("Başlatılıyor…");

    const jobId = `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const targetDate = resolveRefreshTargetDate(viewMonth, apiDateMode);

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/refresh-progress?jobId=${jobId}`, {
          credentials: "include",
        });
        const json = (await res.json()) as {
          ok?: boolean;
          found?: boolean;
          job?: {
            status: string;
            current?: { index: number; total: number; handle?: string };
          };
        };
        if (json.ok && json.found && json.job?.current) {
          const { index, total, handle } = json.job.current;
          setRefreshLabel(`${index}/${total}${handle ? ` · ${handle}` : ""}`);
        }
        if (json.job?.status && json.job.status !== "running") {
          clearInterval(poll);
        }
      } catch {
        /* sessiz */
      }
    }, 1500);

    try {
      const res = await fetch("/api/admin/refresh-all-links", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          targetDate,
          linkScope,
          monthYm: viewMonth,
          trigger: "izlenme-navbar",
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        summary?: {
          succeeded: number;
          failed: number;
          results: LinkRefreshResult[];
        };
      };
      clearInterval(poll);
      if (json.ok && json.summary) {
        for (const r of json.summary.results) {
          if (r.linkUpdate) {
            applyLinkMetricsToStore(r.linkId, r.linkUpdate, {
              updateBrandLink,
              upsertLinkSnapshot,
            });
          }
        }
        setRefreshLabel(
          `${json.summary.succeeded} güncellendi` +
            (json.summary.failed > 0 ? ` · ${json.summary.failed} hata` : "")
        );
      } else {
        setRefreshLabel(json.error ?? "Yenileme başarısız");
      }
      await loadApi();
    } catch (e) {
      clearInterval(poll);
      setRefreshLabel(e instanceof Error ? e.message : "Ağ hatası");
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshLabel(null), 8000);
    }
  }, [
    apiDateMode,
    linkScope,
    loadApi,
    readOnly,
    refreshing,
    updateBrandLink,
    upsertLinkSnapshot,
    viewMonth,
  ]);

  const navVm = (delta: number) => onChangeMonth(shiftCalendarMonthYm(viewMonth, delta));

  const apiChip = useMemo(() => {
    if (!api) {
      return (
        <Badge variant="outline" className="gap-1.5 text-[10px]">
          <Loader2 size={10} className="animate-spin" /> API…
        </Badge>
      );
    }
    if (!api.rapidApiEnabled) {
      return (
        <Badge variant="outline" className="gap-1.5 text-[10px] text-muted-foreground">
          <WifiOff size={10} /> API kapalı
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className={`gap-1.5 text-[10px] ${STATUS_TONE[api.worstStatus]}`}>
        <Wifi size={10} /> {STATUS_LABEL[api.worstStatus]}
        <span className="opacity-70">· kalan {api.totalSafeRemaining.toLocaleString("tr-TR")}</span>
      </Badge>
    );
  }, [api]);

  const navLinkClass = (href: string) => {
    const base = href.split("?")[0];
    const active =
      base === "/izlenme"
        ? pathname === "/izlenme"
        : pathname === base || pathname.startsWith(`${base}/`);
    return active
      ? "px-2.5 py-1.5 rounded-md text-xs font-semibold bg-foreground text-background"
      : "px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors";
  };

  return (
    <div className="sticky top-0 z-20 -mx-2 px-2 py-2.5 mb-6 bg-background/95 backdrop-blur-md border border-border/60 rounded-xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={izlenmeHref("/izlenme", viewMonth, { linkScope, apiDateMode })}
            className={navLinkClass("/izlenme")}
          >
            <Eye size={11} className="inline mr-1" /> Genel
          </Link>
          <Link
            href={izlenmeHref("/izlenme/markalar", viewMonth, { linkScope, apiDateMode })}
            className={navLinkClass("/izlenme/markalar")}
          >
            <Briefcase size={11} className="inline mr-1" /> Markalar
          </Link>
          <Link
            href={izlenmeHref("/izlenme/operatorler", viewMonth, { linkScope, apiDateMode })}
            className={navLinkClass("/izlenme/operatorler")}
          >
            <Users size={11} className="inline mr-1" /> Operatörler
          </Link>
          <Link
            href={izlenmeHref("/izlenme/grafikler", viewMonth, { linkScope, apiDateMode })}
            className={navLinkClass("/izlenme/grafikler")}
          >
            <BarChart3 size={11} className="inline mr-1" /> Grafikler
          </Link>
          <Link
            href={izlenmeHref("/izlenme/api", viewMonth, { linkScope, apiDateMode })}
            className={navLinkClass("/izlenme/api")}
          >
            <RefreshCw size={11} className="inline mr-1" /> API
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" type="button" title="Önceki ay" onClick={() => navVm(-1)}>
            <ChevronLeft size={16} />
          </Button>
          <div className="min-w-[140px] rounded-md border border-border bg-card px-3 py-1.5 text-center text-xs font-medium capitalize">
            {monthTitleYm(viewMonth)}
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" type="button" title="Sonraki ay" onClick={() => navVm(1)}>
            <ChevronRight size={16} />
          </Button>
          <div className="hidden md:block" title={api?.lastSuccessAt ? `Son başarılı: ${new Date(api.lastSuccessAt).toLocaleString("tr-TR")}` : undefined}>
            {apiChip}
          </div>
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onRefreshAll()}
              disabled={refreshing}
              title="Tüm linkleri yenile ve metrikleri güncelle"
              className="gap-1 h-8"
            >
              {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {refreshing ? "Yenileniyor…" : "Yenile"}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="inline-flex items-center rounded-full border border-border bg-muted/30 p-0.5">
          <button
            type="button"
            onClick={() => onLinkScopeChange("month")}
            className={
              linkScope === "month"
                ? "rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background"
                : "rounded-full px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            }
          >
            Bu ayın linkleri
          </button>
          <button
            type="button"
            onClick={() => onLinkScopeChange("all")}
            className={
              linkScope === "all"
                ? "rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background"
                : "rounded-full px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            }
          >
            Tüm linkler
          </button>
        </span>
        <span className="inline-flex items-center rounded-full border border-border bg-muted/30 p-0.5">
          <button
            type="button"
            onClick={() => onApiDateModeChange("view-month")}
            className={
              apiDateMode === "view-month"
                ? "rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background"
                : "rounded-full px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            }
            title="API verisi seçili ayın son gününe (veya bu ay ise bugüne) yazılır"
          >
            Ay tarihi
          </button>
          <button
            type="button"
            onClick={() => onApiDateModeChange("today")}
            className={
              apiDateMode === "today"
                ? "rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background"
                : "rounded-full px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            }
            title="API verisi her zaman bugünün tarihine yazılır"
          >
            Bugün
          </button>
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 border border-border text-muted-foreground">
          <Briefcase size={10} /> {totalBrands} marka
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 border border-border text-muted-foreground">
          <Users size={10} /> {totalStreamers} yayıncı
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 border border-border text-muted-foreground">
          <Activity size={10} /> {totalLinks} link
          {linkScope === "month" && totalAllLinks != null && totalAllLinks !== totalLinks && (
            <span className="opacity-60">/ {totalAllLinks}</span>
          )}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 border border-border text-muted-foreground">
          <Eye size={10} /> {fmtViews(totalViews)} izlenme · {monthTitleYm(viewMonth)}
        </span>
        {refreshLabel && (
          <span className="text-emerald-700 dark:text-emerald-300">{refreshLabel}</span>
        )}
        {api?.worstStatus === "error" || api?.worstStatus === "exhausted" ? (
          <button
            type="button"
            onClick={() => router.push(izlenmeHref("/izlenme/api", viewMonth))}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:border-red-500/40 dark:text-red-300"
          >
            <AlertCircle size={10} />
            {api.worstStatus === "exhausted" ? "Kota dolu" : "API erişim sorunu"} · detay
          </button>
        ) : api?.worstStatus === "warn" ? (
          <button
            type="button"
            onClick={() => router.push(izlenmeHref("/izlenme/api", viewMonth))}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:border-amber-500/40 dark:text-amber-200"
          >
            <AlertCircle size={10} /> Link yenileme uyarısı
          </button>
        ) : null}
        {lastFetch > 0 && (
          <span className="text-muted-foreground/70 ml-auto">
            <ArrowUpRight size={9} className="inline" /> {new Date(lastFetch).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}
