"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  health: {
    status: "ok" | "warn" | "error" | "exhausted" | "unknown";
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    successCount24h: number;
    errorCount24h: number;
    staleHours: number | null;
  } | null;
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

interface StatusResponse {
  ok: boolean;
  rapidApiEnabled: boolean;
  cronIntervalHours: number;
  platforms: PlatformStatus[];
  recentRuns: RecentRun[];
  error?: string;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function platformIcon(platform: string): string {
  if (platform === "youtube") return "🎬";
  if (platform === "instagram") return "📷";
  if (platform === "tiktok") return "🎵";
  return "📊";
}

interface PingResult {
  ok: boolean;
  status: number;
  message: string;
  latencyMs: number;
  platform: string;
}

export function AutoRefreshStatusPanel() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pingingPlatform, setPingingPlatform] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/refresh-status", { credentials: "include" });
      const json = (await res.json()) as StatusResponse;
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
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
      // Test bir quota tüketti, status'u yeniden yükle
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
              YouTube · Instagram · TikTok izlenmelerini RapidAPI ile{" "}
              <span className="font-medium text-foreground">günde {Math.round(24 / data.cronIntervalHours)} kez</span>{" "}
              kontrol eder · Basic plan kotalarına göre adaptif batch.
            </CardDescription>
          </div>
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
      </CardHeader>
      <CardContent className="space-y-3">
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
            const isPinging = pingingPlatform === p.platform;
            const accent = exhausted
              ? "border-red-300 bg-red-50/30 dark:border-red-500/45 dark:bg-red-950/30"
              : hStatus === "error"
                ? "border-red-300 bg-red-50/30 dark:border-red-500/45 dark:bg-red-950/30"
                : hStatus === "warn" || usagePct > 70
                  ? "border-amber-300 bg-amber-50/30 dark:border-amber-500/45 dark:bg-amber-950/30"
                  : "border-border bg-card";
            return (
              <div key={p.platform} className={`rounded-lg border px-3 py-3 ${accent}`}>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <p className="font-semibold text-sm flex items-center gap-1.5 min-w-0">
                    <span className="text-base">{platformIcon(p.platform)}</span>
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
                  <Row label="Sağlık">
                    <HealthLabel status={hStatus} />
                  </Row>
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
                  <Row label="Bu ay kullanılan">
                    {p.requestsUsed}/{p.monthlyBudget} güvenli
                  </Row>
                  <Row label="Rate limit">{p.rateLimit}</Row>
                </dl>
                {p.health?.lastError && hStatus !== "ok" && (
                  <div className="mt-2 rounded border border-red-200 bg-red-50/50 px-2 py-1 text-[10px] text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200">
                    <span className="font-medium">Son hata: </span>
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
                    <span className="font-medium">{platformIcon(r.platform)} {r.platform}</span>
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

        <p className="text-[10px] text-muted-foreground border-t border-border/40 pt-2 leading-relaxed">
          <PlayCircle size={10} className="inline mr-0.5" />
          Cron her gün 03:00 UTC'de çalışır. Her platform için kalan kota, kalan güne bölünerek adaptif batch
          hesaplanır; aylık güvenli sınıra (%85) ulaşılırsa otomatik yenileme ay sonuna kadar durur, manuel
          tek-link refresh hâlâ izinli kalır.
        </p>
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
