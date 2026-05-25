"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Loader2,
  PlayCircle,
  RefreshCw,
  Save,
  Settings2,
  Timer,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SocialPlatformIcon } from "@/components/social-platform-icon";
import { useAuth } from "@/store/auth";
import { useStore } from "@/store/store";
import { applyLinkMetricsToStore, type LinkMetricsStoreUpdate } from "@/lib/social-api/link-store-sync";
import type { LinkRefreshResult } from "@/lib/social-api/refresh-runner";
import {
  resolveRefreshTargetDate,
  type IzlenmeApiDateMode,
  type IzlenmeLinkScope,
} from "@/lib/izlenme-refresh";
import { deleteBrandLinkAsAdmin } from "@/lib/brand-link-delete";
import { isPostOrLinkGoneError } from "@/lib/social-api/link-gone";

interface PlatformStatus {
  platform: "youtube" | "tiktok" | "instagram";
  label: string;
  monthlyLimit: number;
  monthlyBudget: number;
  requestsUsed: number;
  safeRemaining: number;
  trackedLinkCount: number;
  batchSizePerRun: number;
  estimatedIntervalHours: number | null;
  estimatedIntervalLabel: string;
  lastRequestAt: string | null;
  rateLimit: string;
  apiHost: string;
  minSuggestedHours?: number;
  intervalTooAggressive?: boolean;
  health: {
    status: "ok" | "warn" | "error" | "exhausted" | "unknown";
    connectivityStatus: "ok" | "warn" | "error" | "unknown";
    lastPingAt: string | null;
    linksWithError: number;
    staleTrackedLinks: number;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    successCount24h: number;
    errorCount24h: number;
    staleHours: number | null;
  } | null;
}

export interface AutoRefreshStatusPanelProps {
  /** API sayfasında katalog zaten üstte gösteriliyorsa tekrarı gizle. */
  hideCapabilities?: boolean;
  viewMonth?: string;
  linkScope?: IzlenmeLinkScope;
  apiDateMode?: IzlenmeApiDateMode;
}

interface RecentRun {
  id: string;
  platform: string;
  triggered_by: string;
  triggered_by_user: string | null;
  started_at: string;
  finished_at: string | null;
  links_attempted: number;
  links_succeeded: number;
  links_failed: number;
  quota_used: number;
  error_summary: string;
}

interface RefreshSettings {
  cronIntervalHours: number;
  notifyEnabled: boolean;
  notifyCooldownHours: number;
}

interface StatusResponse {
  ok: boolean;
  rapidApiEnabled: boolean;
  cronIntervalHours: number;
  settings?: RefreshSettings;
  platforms: PlatformStatus[];
  recentRuns: RecentRun[];
  error?: string;
}

import { fmtDateShort } from "@/lib/fmt-date";
import { PlatformApiCapabilitiesGrid } from "@/components/platform-api-capabilities-card";
import { PLATFORM_FEATURES } from "@/lib/social-api/platform-capabilities";

function fmtDate(iso?: string | null): string {
  return fmtDateShort(iso);
}

interface PingResult {
  ok: boolean;
  status: number;
  message: string;
  latencyMs: number;
  platform: string;
}

const SUPPORTED_PLATFORMS = ["youtube", "instagram", "tiktok"];

function formatCountdown(ms: number): string {
  if (ms <= 0) return "şimdi";
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}sa ${String(m).padStart(2, "0")}dk ${String(s).padStart(2, "0")}sn`;
  if (m > 0) return `${m}dk ${String(s).padStart(2, "0")}sn`;
  return `${s}sn`;
}

function staleHours(iso?: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

export function AutoRefreshStatusPanel({
  hideCapabilities = false,
  viewMonth: viewMonthProp,
  linkScope: linkScopeProp = "all",
  apiDateMode: apiDateModeProp = "view-month",
}: AutoRefreshStatusPanelProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "auditor";
  const canEditSettings = user?.role === "admin";
  const canDeleteLinks = user?.role === "admin";
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [staleOpen, setStaleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pingingPlatform, setPingingPlatform] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [draftSettings, setDraftSettings] = useState<RefreshSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [refreshingLink, setRefreshingLink] = useState<string | null>(null);
  const [deletingLink, setDeletingLink] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  // Toplu yenileme canlı ilerleme — polling ile güncellenir
  const [bulkProgress, setBulkProgress] = useState<{
    current?: { linkId: string; platform: string; handle: string; index: number; total: number };
    status: "running" | "completed" | "error";
  } | null>(null);
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [targetMonth, setTargetMonth] = useState<string>(""); // YYYY-MM, boş = bugün
  const { updateBrandLink, upsertLinkSnapshot, brandLinks, brands, pushNotification } = useStore();

  // ── Stale links (API destekli, aktif, en son kontrol edilmeyen önce) ──────
  const staleLinks = useMemo(() => {
    return brandLinks
      .filter((l) => {
        if (l.status !== "active") return false;
        const plat = l.platform.toLowerCase();
        return SUPPORTED_PLATFORMS.some((p) => plat.includes(p));
      })
      .map((l) => ({
        link: l,
        brand: brands.find((b) => b.id === l.brandId),
        hours: staleHours(l.lastCheckedAt),
      }))
      .sort((a, b) => {
        if (a.hours === null && b.hours === null) return 0;
        if (a.hours === null) return -1;
        if (b.hours === null) return 1;
        return b.hours - a.hours;
      });
  }, [brandLinks, brands]);

  const goneStaleLinks = useMemo(
    () => staleLinks.filter(({ link }) => isPostOrLinkGoneError(link.lastCheckError)),
    [staleLinks]
  );

  const handleDeleteLink = useCallback(
    async (linkId: string, brandName?: string) => {
      const link = brandLinks.find((l) => l.id === linkId);
      if (!link) return;
      setDeletingLink(linkId);
      try {
        await deleteBrandLinkAsAdmin(link, {
          brandName,
          deletedByUserId: user?.id,
        });
      } finally {
        setDeletingLink(null);
      }
    },
    [brandLinks, user?.id]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/refresh-status", { credentials: "include" });
      const json = (await res.json()) as StatusResponse;
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
      if (json.settings) setDraftSettings(json.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "?");
    } finally {
      setLoading(false);
    }
  }, []);

  const testPlatform = useCallback(async (platform: string) => {
    setPingingPlatform(platform);
    setPingResult(null);
    try {
      const res = await fetch(`/api/admin/api-ping?platform=${platform}`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as PingResult & { error?: string };
      setPingResult({
        ok: json.ok,
        status: json.status ?? 0,
        message: json.error ?? json.message ?? "?",
        latencyMs: json.latencyMs ?? 0,
        platform,
      });
      if (json.ok) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            platforms: prev.platforms.map((p) =>
              p.platform === platform
                ? {
                    ...p,
                    health: {
                      ...p.health!,
                      status: "ok" as const,
                      connectivityStatus: "ok" as const,
                      lastPingAt: new Date().toISOString(),
                      lastSuccessAt: new Date().toISOString(),
                      lastErrorAt: p.health?.lastErrorAt ?? null,
                      successCount24h: (p.health?.successCount24h ?? 0) + 1,
                      errorCount24h: p.health?.errorCount24h ?? 0,
                      staleHours: 0,
                    },
                  }
                : p
            ),
          };
        });
      }
      await load();
    } catch (err) {
      setPingResult({
        ok: false,
        status: 0,
        message: err instanceof Error ? err.message : "?",
        latencyMs: 0,
        platform,
      });
    } finally {
      setPingingPlatform(null);
    }
  }, [load]);

  const saveSettings = useCallback(async () => {
    if (!draftSettings || !canEditSettings) return;
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await fetch("/api/admin/api-refresh-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftSettings),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; settings?: RefreshSettings };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSettingsMsg("Ayarlar kaydedildi.");
      if (json.settings) setDraftSettings(json.settings);
      await load();
    } catch (err) {
      setSettingsMsg(err instanceof Error ? err.message : "Kayıt hatası");
    } finally {
      setSavingSettings(false);
    }
  }, [draftSettings, canEditSettings, load]);

  /**
   * Toplu yenileme — `mode`'a göre tüm aktif / sadece yenilenmemiş / seçili linkleri yeniler.
   * Sunucu yanıtı tek HTTP'de döner ama UI parallel olarak `jobId` üzerinden
   * `refresh-progress` endpoint'ini poll ederek hangi linkin işlendiğini gösterir.
   */
  const refreshAllLinks = useCallback(async (opts?: {
    mode?: "all" | "failed-only" | "selected";
    linkIds?: string[];
    targetMonth?: string;
    linkScope?: IzlenmeLinkScope;
    apiDateMode?: IzlenmeApiDateMode;
  }) => {
    if (!isAdmin) return;
    const mode = opts?.mode ?? "all";
    setBulkRunning(true);
    setBulkMsg(null);
    setBulkProgress({ status: "running" });

    const jobId = `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const useMonth = opts?.targetMonth ?? targetMonth ?? viewMonthProp ?? "";
    const scope = opts?.linkScope ?? linkScopeProp;
    const dateMode = opts?.apiDateMode ?? apiDateModeProp;
    const targetDate = useMonth
      ? resolveRefreshTargetDate(useMonth, dateMode)
      : viewMonthProp
        ? resolveRefreshTargetDate(viewMonthProp, dateMode)
        : undefined;

    // Polling: jobId ile sunucu durumunu çek
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/refresh-progress?jobId=${jobId}`, {
          credentials: "include",
        });
        const json = (await res.json()) as {
          ok: boolean;
          found?: boolean;
          job?: {
            status: "running" | "completed" | "error";
            current?: { linkId: string; platform: string; handle: string; index: number; total: number };
          };
        };
        if (json.ok && json.found && json.job) {
          setBulkProgress({ current: json.job.current, status: json.job.status });
          if (json.job.status !== "running") {
            clearInterval(pollInterval);
          }
        }
      } catch {
        // Sessiz — sonraki tick'te yeniden dener
      }
    }, 1500);

    try {
      const res = await fetch("/api/admin/refresh-all-links", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          failedOnly: mode === "failed-only" ? true : undefined,
          linkIds: mode === "selected" ? opts?.linkIds : undefined,
          targetDate,
          linkScope: scope,
          monthYm: useMonth || viewMonthProp,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        summary?: {
          attempted: number;
          succeeded: number;
          failed: number;
          skippedQuota: number;
          results: LinkRefreshResult[];
        };
      };
      if (!res.ok || !json.ok || !json.summary) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const { summary } = json;
      for (const r of summary.results) {
        if (r.linkUpdate) {
          applyLinkMetricsToStore(r.linkId, r.linkUpdate, {
            updateBrandLink,
            upsertLinkSnapshot,
          });
        }
      }
      const modeLabel =
        mode === "failed-only"
          ? "Yenilenmemiş"
          : mode === "selected"
            ? "Seçili"
            : "Tüm";
      const finalMsg =
        `${modeLabel} linkler: ${summary.succeeded} güncellendi` +
        (summary.failed > 0 ? ` · ${summary.failed} hata` : "") +
        (summary.skippedQuota > 0 ? ` · ${summary.skippedQuota} kota` : "") +
        (targetDate ? ` · snapshot tarihi ${targetDate}` : "");
      setBulkMsg(finalMsg);
      // Yöneticiye bildirim — başarı veya kısmi başarı
      pushNotification({
        type: summary.failed > 0 ? "api_refresh_alert" : "general",
        title:
          summary.failed > 0
            ? "Toplu link yenileme · kısmi başarı"
            : "Toplu link yenileme tamamlandı",
        message: finalMsg,
        forRole: "admin",
        href: "/izlenme",
      });
      setBulkProgress({ status: "completed" });
      await load();
    } catch (err) {
      setBulkMsg(err instanceof Error ? err.message : "Toplu yenileme hatası");
      setBulkProgress({ status: "error" });
    } finally {
      clearInterval(pollInterval);
      setBulkRunning(false);
    }
  }, [isAdmin, load, updateBrandLink, upsertLinkSnapshot, pushNotification, targetMonth]);

  // ── Geri sayım: son cron çalışması + ayarlı aralık ────────────────────────
  useEffect(() => {
    if (!data) return;
    const lastRun = data.recentRuns
      .filter((r) => r.triggered_by === "cron")
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0];
    if (!lastRun) { setCountdown(null); return; }
    const nextAt = new Date(lastRun.started_at).getTime() + data.cronIntervalHours * 3_600_000;
    const tick = () => setCountdown(formatCountdown(nextAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data]);

  // ── Tek link yenile ───────────────────────────────────────────────────────
  const refreshSingleLinkById = useCallback(async (linkId: string) => {
    if (!isAdmin) return;
    setRefreshingLink(linkId);
    try {
      const res = await fetch(`/api/admin/refresh-link/${linkId}`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { ok?: boolean; result?: { ok?: boolean; linkUpdate?: LinkMetricsStoreUpdate; error?: string } };
      const result = json.result;
      if (result?.linkUpdate) {
        applyLinkMetricsToStore(linkId, result.linkUpdate, { updateBrandLink, upsertLinkSnapshot });
      }
    } catch { /* silent */ } finally {
      setRefreshingLink(null);
    }
  }, [isAdmin, updateBrandLink, upsertLinkSnapshot]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Otomatik yenileme durumu yükleniyor…
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-red-300 bg-red-50/40 dark:border-red-500/45 dark:bg-red-950/30">
        <CardContent className="py-3 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <AlertTriangle size={14} /> Durum bilgisi alınamadı: {error ?? "bilinmeyen"}
        </CardContent>
      </Card>
    );
  }

  if (!data.rapidApiEnabled) {
    return (
      <Card className="border-amber-300 bg-amber-50/40 dark:border-amber-500/45 dark:bg-amber-950/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot size={15} className="text-amber-700 dark:text-amber-300" />
            Otomatik link yenileme — devre dışı
          </CardTitle>
          <CardDescription className="text-xs">
            Devreye almak için <code className="rounded bg-muted px-1 py-0.5 text-[10px]">RAPIDAPI_KEY</code> environment
            variable'ını ekleyin ve uygulamayı yeniden deploy edin. Vercel Cron günde 1 kez{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">/api/cron/refresh-links</code> endpoint'ini çağırır.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot size={15} className="text-emerald-700 dark:text-emerald-300" />
              Otomatik link yenileme
            </CardTitle>
            <CardDescription className="text-xs">
              YouTube · Instagram · TikTok — yükseltilmiş plan (YT/IG ~5000, TikTok ~5000/ay, %85 güvenli kota).
              {PLATFORM_FEATURES.youtube.length + PLATFORM_FEATURES.instagram.length + PLATFORM_FEATURES.tiktok.length}{" "}
              API özelliği · kontrol{" "}
              <span className="font-medium text-foreground">her {data.cronIntervalHours} saatte bir</span>.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {isAdmin && (
              <>
                {/* Hedef ay seçici — geçmiş ayı yenilemek için */}
                <input
                  type="month"
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="h-7 px-2 rounded-md border border-border bg-card text-[11px]"
                  title="Snapshot tarihi — boşsa bugün, seçilirse o ayın son günü"
                  max={new Date().toISOString().slice(0, 7)}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  disabled={bulkRunning || loading}
                  onClick={() => void refreshAllLinks({ mode: "all" })}
                  title="Tüm aktif YouTube, Instagram ve TikTok linklerini API ile kontrol eder"
                >
                  {bulkRunning ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <PlayCircle size={12} />
                  )}
                  Tüm linkleri kontrol et
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  disabled={bulkRunning || loading}
                  onClick={() => void refreshAllLinks({ mode: "failed-only" })}
                  title="Sadece son denemede hatalı veya 24 saatten uzun süredir kontrol edilmemiş linkleri yeniden dener"
                >
                  <RefreshCw size={12} />
                  Sadece başarısızları
                </Button>
                {countdown && !bulkRunning && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
                    <Timer size={10} />
                    {countdown}
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSettingsOpen((v) => !v)}
                  className="h-7 gap-1.5 text-xs"
                >
                  <Settings2 size={12} /> Ayarlar
                </Button>
              </>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void load()}
              className="h-7 gap-1.5 text-xs"
              disabled={loading}
            >
              <Activity size={12} /> Yenile
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Canlı toplu yenileme paneli */}
        {bulkRunning && (
          <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/40 dark:border-emerald-500/45 dark:bg-emerald-950/25 px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">
              <Loader2 size={13} className="animate-spin" />
              {bulkProgress?.current ? (
                <>
                  <span>
                    {bulkProgress.current.index} / {bulkProgress.current.total}
                  </span>
                  <span className="opacity-70">·</span>
                  <span className="capitalize">{bulkProgress.current.platform}</span>
                  <span className="opacity-70">·</span>
                  <span className="font-normal opacity-90 truncate max-w-[280px]">
                    {bulkProgress.current.handle}
                  </span>
                </>
              ) : (
                <span>Linkler yenileniyor — bağlantı kuruluyor…</span>
              )}
            </div>
            {bulkProgress?.current && (
              <div className="mt-1.5 h-1 w-full rounded-full bg-emerald-200/60 dark:bg-emerald-900/40 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      (bulkProgress.current.index / Math.max(1, bulkProgress.current.total)) * 100
                    )}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}
        {bulkMsg && !bulkRunning && (
          <p className="text-xs rounded-md border border-border bg-muted/40 px-3 py-2 text-foreground">
            {bulkMsg}
          </p>
        )}
        {settingsOpen && draftSettings && isAdmin && (
          <div className="rounded-lg border border-violet-200/60 bg-violet-50/30 dark:border-violet-500/40 dark:bg-violet-950/25 p-3 space-y-3">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <Settings2 size={13} /> Otomatik yenileme ayarları
            </p>
            {!canEditSettings && (
              <p className="text-[11px] text-amber-800 dark:text-amber-200 rounded-md border border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/30 px-2 py-1.5">
                Denetçi hesabı ayarları görüntüleyebilir; kaydetmek için yönetici girişi gerekir.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="cron-interval-select" className="text-[11px] text-muted-foreground">Kontrol aralığı (saat)</label>
                {(() => {
                  const minH = Math.max(
                    6,
                    ...(data?.platforms ?? []).map((p) => p.minSuggestedHours ?? 24)
                  );
                  return (
                    <>
                      <select
                        id="cron-interval-select"
                        className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        value={draftSettings.cronIntervalHours}
                        onChange={(e) =>
                          setDraftSettings((s) =>
                            s ? { ...s, cronIntervalHours: Number(e.target.value) } : s
                          )
                        }
                      >
                        {[6, 12, 24, 48, 72].map((h) => (
                          <option key={h} value={h} disabled={h < minH}>
                            {h} saatte bir{h < minH ? " (çok sık)" : ""}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Kotaya göre en az {minH} saat önerilir (link sayısına bağlı).
                      </p>
                    </>
                  );
                })()}
              </div>
              <div>
                <label htmlFor="notify-cooldown-select" className="text-[11px] text-muted-foreground">Bildirim bekleme (saat)</label>
                <select
                  id="notify-cooldown-select"
                  className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  value={draftSettings.notifyCooldownHours}
                  onChange={(e) =>
                    setDraftSettings((s) =>
                      s ? { ...s, notifyCooldownHours: Number(e.target.value) } : s
                    )
                  }
                >
                  {[4, 8, 12, 24, 48].map((h) => (
                    <option key={h} value={h}>{h} saat</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={draftSettings.notifyEnabled}
                onChange={(e) =>
                  setDraftSettings((s) => (s ? { ...s, notifyEnabled: e.target.checked } : s))
                }
                className="rounded border-input"
              />
              <Bell size={12} /> Kota / hata / ödeme uyarıları
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={savingSettings || !canEditSettings}
                onClick={() => void saveSettings()}
              >
                {savingSettings ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                Kaydet
              </Button>
              {settingsMsg && <span className="text-[11px] text-muted-foreground">{settingsMsg}</span>}
            </div>
          </div>
        )}

        {pingResult && (
          <div
            className={`rounded-md border px-3 py-2 text-xs ${
              pingResult.ok
                ? "border-emerald-300 bg-emerald-50/40 text-emerald-800 dark:border-emerald-500/45 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "border-red-300 bg-red-50/40 text-red-800 dark:border-red-500/45 dark:bg-red-950/30 dark:text-red-200"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {pingResult.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              <span className="font-medium">{pingResult.platform} ping</span>
              <span className="opacity-75">·</span>
              <span>HTTP {pingResult.status}</span>
              <span className="opacity-75">·</span>
              <span className="tabular-nums">{pingResult.latencyMs} ms</span>
            </div>
            {!pingResult.ok && pingResult.message && (
              <p className="mt-1 text-[11px] opacity-90 break-words">{pingResult.message}</p>
            )}
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-3">
          {data.platforms.map((p) => {
            const usagePct = p.monthlyLimit > 0 ? (p.requestsUsed / p.monthlyLimit) * 100 : 0;
            const exhausted = p.batchSizePerRun === 0;
            const hStatus = p.health?.status ?? "unknown";
            const conn = p.health?.connectivityStatus ?? "unknown";
            const isPinging = pingingPlatform === p.platform;
            const accent = exhausted
              ? "border-red-300 bg-red-50/30 dark:border-red-500/45 dark:bg-red-950/30"
              : conn === "error"
                ? "border-red-300 bg-red-50/30 dark:border-red-500/45 dark:bg-red-950/30"
                : hStatus === "warn" || usagePct > 70
                  ? "border-amber-300 bg-amber-50/30 dark:border-amber-500/45 dark:bg-amber-950/30"
                  : "border-border bg-card";
            return (
              <div key={p.platform} className={`rounded-lg border px-3 py-3 ${accent}`}>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <p className="font-semibold text-sm flex items-center gap-1.5 min-w-0">
                    <SocialPlatformIcon platform={p.platform} size={22} />
                    <span className="truncate">{p.label}</span>
                    <HealthDot status={hStatus} />
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] tabular-nums shrink-0 ${
                      exhausted
                        ? "border-red-300 text-red-700 dark:border-red-500/45 dark:text-red-300"
                        : ""
                    }`}
                  >
                    {p.requestsUsed} / {p.monthlyLimit}
                  </Badge>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                  <div
                    className={`h-full ${
                      exhausted ? "bg-red-500" : usagePct > 70 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, usagePct)}%` }}
                  />
                </div>
                <dl className="text-xs space-y-1">
                  <Row label="API bağlantısı">
                    <ConnectivityLabel status={p.health?.connectivityStatus ?? "unknown"} />
                    {p.health?.lastPingAt && (
                      <span className="text-muted-foreground ml-1 text-[10px]">
                        · {fmtDate(p.health.lastPingAt)}
                      </span>
                    )}
                  </Row>
                  <Row label="Genel durum">
                    <HealthLabel status={hStatus} />
                  </Row>
                  {(p.health?.linksWithError ?? 0) > 0 && (
                    <Row label="Link hatası">
                      <span className="text-red-700 dark:text-red-300 font-medium">
                        {p.health?.linksWithError} link
                      </span>
                    </Row>
                  )}
                  <Row label="Son 24sa">
                    <span className="text-emerald-700 dark:text-emerald-300">
                      {p.health?.successCount24h ?? 0}✓
                    </span>
                    <span className="mx-0.5">/</span>
                    <span className={p.health && p.health.errorCount24h > 0 ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}>
                      {p.health?.errorCount24h ?? 0}✗
                    </span>
                  </Row>
                  <Row label="Takip edilen">{p.trackedLinkCount} link</Row>
                  <Row label="Çalıştırma başına">
                    {p.batchSizePerRun} link
                    {p.batchSizePerRun === 0 && (
                      <span className="ml-1 text-red-700 dark:text-red-300">(kota tükendi)</span>
                    )}
                  </Row>
                  <Row label="Tahmini yenileme">
                    <span className={exhausted ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300 font-medium"}>
                      {p.estimatedIntervalLabel}
                    </span>
                  </Row>
                  <Row label="Aylık kota">
                    <span className="tabular-nums">{p.requestsUsed}/{p.monthlyLimit}</span>
                    <span className="text-muted-foreground text-[10px] ml-1">
                      (güvenli {p.monthlyBudget})
                    </span>
                  </Row>
                  <Row label="Rate limit">{p.rateLimit}</Row>
                  {p.minSuggestedHours != null && (
                    <Row label="Önerilen min.">
                      <span className={p.intervalTooAggressive ? "text-amber-700 dark:text-amber-300 font-medium" : ""}>
                        {p.minSuggestedHours} saat
                      </span>
                    </Row>
                  )}
                </dl>
                {p.health?.lastError && hStatus !== "ok" && (
                  <div className="mt-2 rounded border border-amber-200 bg-amber-50/50 px-2 py-1 text-[10px] text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
                    <span className="font-medium">Link / yenileme: </span>
                    <span className="break-words">{p.health.lastError.slice(0, 140)}</span>
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void testPlatform(p.platform)}
                  disabled={isPinging || exhausted}
                  className="mt-2 h-7 w-full gap-1.5 text-[11px]"
                  title={exhausted ? "Kota tükendi — manuel test bile yapılamıyor" : "API'ye gerçek bir test isteği gönderir (1 kota tüketir)"}
                >
                  {isPinging ? <Loader2 size={11} className="animate-spin" /> : <Activity size={11} />}
                  {isPinging ? "Test ediliyor…" : "Bağlantıyı test et"}
                </Button>
              </div>
            );
          })}
        </div>

        {isAdmin && !hideCapabilities && (
          <div className="pt-2 border-t border-border/60">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Activity size={12} /> Platform API özellikleri — canlı test
            </p>
            <PlatformApiCapabilitiesGrid
              platforms={data.platforms.map((p) => ({
                platform: p.platform,
                label: p.label,
                apiHost: p.apiHost,
                monthlyLimit: p.monthlyLimit,
                requestsUsed: p.requestsUsed,
                rateLimit: p.rateLimit,
              }))}
              onQuotaUsed={() => void load()}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? "Detayları gizle" : "Son cron çalıştırmaları"}
        </button>

        {expanded && (
          <div className="space-y-1 border-t border-border pt-3">
            {data.recentRuns.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Henüz cron çalıştırması yok.</p>
            ) : (
              data.recentRuns.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-2 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {r.links_failed > 0 ? (
                      <AlertTriangle size={11} className="text-amber-600 dark:text-amber-400" />
                    ) : (
                      <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400" />
                    )}
                    <SocialPlatformIcon platform={r.platform} size={14} />
                    <span className="font-medium">{r.platform}</span>
                    <Badge variant="outline" className="text-[9px]">
                      {r.triggered_by === "manual" ? "manuel" : "cron"}
                    </Badge>
                    <span className="text-muted-foreground">
                      <Clock size={10} className="inline mr-0.5" />
                      {fmtDate(r.started_at)}
                    </span>
                  </div>
                  <div className="text-muted-foreground tabular-nums shrink-0">
                    {r.links_succeeded}✓ / {r.links_failed}✗
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Güncellenmeyen linkler paneli ──────────────────────────────── */}
        {staleLinks.length > 0 && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setStaleOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-accent/20 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <WifiOff size={13} className="text-amber-500 shrink-0" />
                <span className="text-xs font-medium">Güncellenmeyen linkler</span>
                <Badge variant="outline" className="text-[9px] tabular-nums">
                  {staleLinks.filter((s) => s.hours === null || s.hours > 24).length} bekliyor
                </Badge>
                {countdown && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
                    <Timer size={10} /> sonraki: {countdown}
                  </span>
                )}
              </div>
              {staleOpen ? <ChevronUp size={13} /> : <ChevronRight size={13} />}
            </button>

            {staleOpen && (isAdmin || canDeleteLinks) && (
              <div className="border-t border-border/40 px-3 py-2 flex flex-wrap items-center gap-2 bg-muted/20">
                <span className="text-[11px] text-muted-foreground">Toplu işlem:</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px] gap-1"
                  disabled={bulkRunning}
                  onClick={() => {
                    const ids = staleLinks
                      .filter((s) => s.hours === null || s.hours > 24)
                      .map((s) => s.link.id);
                    if (ids.length === 0) return;
                    void refreshAllLinks({ mode: "selected", linkIds: ids });
                  }}
                >
                  {bulkRunning ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                  Bekleyenlerin hepsini yenile
                  <span className="opacity-70">({staleLinks.filter((s) => s.hours === null || s.hours > 24).length})</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setShowStaleOnly((v) => !v)}
                  className={
                    "h-6 px-2 text-[10px] rounded-md border transition-colors " +
                    (showStaleOnly
                      ? "bg-amber-500/20 border-amber-400/50 text-amber-700 dark:text-amber-300"
                      : "bg-card border-border/60 text-muted-foreground hover:bg-accent/30")
                  }
                  title="24 saatten uzun süredir kontrol edilmemiş linkleri göster"
                >
                  Sadece bekleyenler
                </button>
                {canDeleteLinks && goneStaleLinks.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] gap-1 border-red-300/60 text-red-700 dark:text-red-300"
                    disabled={bulkRunning || deletingLink != null}
                    onClick={() => {
                      void (async () => {
                        if (
                          !confirm(
                            `${goneStaleLinks.length} link gönderisi mevcut değil görünüyor. Hepsi silinsin mi? Yayıncı panellerinden de kaldırılır.`
                          )
                        ) {
                          return;
                        }
                        for (const { link, brand } of goneStaleLinks) {
                          if (!brandLinks.some((l) => l.id === link.id)) continue;
                          setDeletingLink(link.id);
                          await deleteBrandLinkAsAdmin(link, {
                            brandName: brand?.name,
                            deletedByUserId: user?.id,
                            skipConfirm: true,
                          });
                          setDeletingLink(null);
                        }
                      })();
                    }}
                  >
                    <Trash2 size={10} />
                    Gönderisi olmayanları sil ({goneStaleLinks.length})
                  </Button>
                )}
              </div>
            )}

            {staleOpen && (
              <div className="border-t border-border divide-y divide-border/50 max-h-[360px] overflow-y-auto">
                {staleLinks
                  .filter(({ hours }) => !showStaleOnly || hours === null || hours > 24)
                  .map(({ link, brand, hours }) => {
                  const isRefreshing = refreshingLink === link.id;
                  const isDeleting = deletingLink === link.id;
                  const postGone = isPostOrLinkGoneError(link.lastCheckError);
                  const neverChecked = hours === null;
                  const veryStale = hours !== null && hours > 48;
                  const slightlyStale = hours !== null && hours > 24;
                  return (
                    <div
                      key={link.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-accent/10 transition-colors"
                    >
                      <SocialPlatformIcon platform={link.platform.toLowerCase() as "youtube" | "instagram" | "tiktok"} size={18} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-medium truncate max-w-[120px]">
                            {link.handle || link.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                          </span>
                          {brand && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                              · {brand.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {neverChecked ? (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                              <WifiOff size={9} /> Hiç kontrol edilmedi
                            </span>
                          ) : veryStale ? (
                            <span className="text-[10px] text-red-600 dark:text-red-400 flex items-center gap-0.5">
                              <Clock size={9} /> {Math.floor(hours!)}sa önce
                            </span>
                          ) : slightlyStale ? (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                              <Clock size={9} /> {Math.floor(hours!)}sa önce
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                              <Wifi size={9} /> {Math.floor(hours!)}sa önce
                            </span>
                          )}
                          {postGone && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 border-red-300 text-red-700 dark:text-red-300">
                              Gönderi yok
                            </Badge>
                          )}
                          {link.lastCheckError && !postGone && (
                            <span className="text-[10px] text-red-600 dark:text-red-400 truncate max-w-[160px]" title={link.lastCheckError}>
                              · hata: {link.lastCheckError.slice(0, 40)}…
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {link.url && (
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            title="Linki aç"
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                        {(isAdmin || canDeleteLinks) && (
                          <>
                            {isAdmin && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] gap-1"
                              disabled={isRefreshing || isDeleting || bulkRunning}
                              onClick={() => void refreshSingleLinkById(link.id)}
                              title="Bu linki şimdi kontrol et"
                            >
                              {isRefreshing ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <RefreshCw size={10} />
                              )}
                              Yenile
                            </Button>
                            )}
                            {canDeleteLinks && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] gap-1 border-red-300/50 text-red-700 dark:text-red-300"
                              disabled={isRefreshing || isDeleting || bulkRunning}
                              onClick={() => void handleDeleteLink(link.id, brand?.name)}
                              title={
                                postGone
                                  ? "Gönderi mevcut değil — linki sil (yayıncı panelinden de kaldırılır)"
                                  : "Linki sil (yayıncı panelinden de kaldırılır)"
                              }
                            >
                              {isDeleting ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <Trash2 size={10} />
                              )}
                              Sil
                            </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                  })}
              </div>
            )}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-2 leading-relaxed space-y-1">
          <p>
            <PlayCircle size={10} className="inline mr-0.5" />
            <strong>Tüm linkleri kontrol et</strong> · yüklü tüm aktif YouTube / Instagram / TikTok linklerini tek
            seferde API&apos;den çeker; izlenme, beğeni, yorum ve paylaşım Supabase&apos;deki{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[9px]">link_snapshots</code> tablosuna yazılır.
          </p>
          <p>
            <RefreshCw size={10} className="inline mr-0.5" />
            <strong>Sadece başarısızları</strong> · son denemede hatalı veya 24 saatten uzun süredir kontrol
            edilmemiş linkleri yeniden dener. Hata olmadan biten linklere dokunmaz.
          </p>
          <p>
            <Clock size={10} className="inline mr-0.5" />
            <strong>Hedef ay</strong> · geçmiş bir ay seçildiğinde snapshot o ayın son gününe yazılır — geçmiş
            verileri geriye dönük doldurmak için kullanılır. Boşsa bugünün tarihiyle yazılır.
          </p>
          <p>
            <Bot size={10} className="inline mr-0.5" />
            Cron her gün <strong>03:00 UTC</strong>&apos;de otomatik batch çalıştırır (yalnızca{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[9px]">auto_track</code> aktif olan linkler).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

const HEALTH_COLORS: Record<string, { dot: string; label: string; text: string }> = {
  ok:        { dot: "bg-emerald-500",   label: "çalışıyor",  text: "text-emerald-700 dark:text-emerald-300" },
  warn:      { dot: "bg-amber-500",     label: "uyarı",      text: "text-amber-700 dark:text-amber-300" },
  error:     { dot: "bg-red-500",       label: "hata",       text: "text-red-700 dark:text-red-300" },
  exhausted: { dot: "bg-red-500",       label: "kota tükendi", text: "text-red-700 dark:text-red-300" },
  unknown:   { dot: "bg-muted-foreground/40", label: "veri yok", text: "text-muted-foreground" },
};

function HealthDot({ status }: { status: string }) {
  const c = HEALTH_COLORS[status] ?? HEALTH_COLORS.unknown;
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${c.dot} ${status === "ok" ? "animate-pulse" : ""}`}
      title={c.label}
    />
  );
}

function HealthLabel({ status }: { status: string }) {
  const c = HEALTH_COLORS[status] ?? HEALTH_COLORS.unknown;
  return <span className={`font-medium ${c.text}`}>{c.label}</span>;
}

const CONNECTIVITY_COLORS: Record<string, { label: string; text: string }> = {
  ok: { label: "erişilebilir", text: "text-emerald-700 dark:text-emerald-300" },
  warn: { label: "belirsiz", text: "text-amber-700 dark:text-amber-300" },
  error: { label: "erişilemiyor", text: "text-red-700 dark:text-red-300" },
  unknown: { label: "test yok", text: "text-muted-foreground" },
};

function ConnectivityLabel({ status }: { status: string }) {
  const c = CONNECTIVITY_COLORS[status] ?? CONNECTIVITY_COLORS.unknown;
  return <span className={`font-medium ${c.text}`}>{c.label}</span>;
}
