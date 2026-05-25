"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SocialPlatformIcon } from "@/components/social-platform-icon";
import {
  FEATURE_CATEGORY_LABELS,
  PLATFORM_FEATURES,
  featuresByCategory,
  type FeatureCategory,
  type PlatformFeature,
} from "@/lib/social-api/platform-capabilities";
import type { SocialPlatform } from "@/lib/social-api/config";

type ProbeState = {
  status: "idle" | "running" | "ok" | "error";
  latencyMs?: number;
  preview?: string;
  message?: string;
};

export interface PlatformApiCapabilitiesCardProps {
  platform: SocialPlatform;
  label: string;
  apiHost: string;
  monthlyLimit: number;
  requestsUsed: number;
  rateLimit?: string;
  compact?: boolean;
  onQuotaUsed?: () => void;
}

export function PlatformApiCapabilitiesCard({
  platform,
  label,
  apiHost,
  monthlyLimit,
  requestsUsed,
  rateLimit,
  compact = false,
  onQuotaUsed,
}: PlatformApiCapabilitiesCardProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [probes, setProbes] = useState<Record<string, ProbeState>>({});
  const [pinging, setPinging] = useState(false);
  const [lastPing, setLastPing] = useState<ProbeState | null>(null);

  const byCategory = useMemo(() => featuresByCategory(platform), [platform]);
  const features = PLATFORM_FEATURES[platform];
  const cronCount = features.filter((f) => f.usedInCron).length;
  const proCount = features.filter((f) => f.isPro).length;
  const usagePct = monthlyLimit > 0 ? (requestsUsed / monthlyLimit) * 100 : 0;

  const runProbe = useCallback(
    async (featureId: string) => {
      setProbes((p) => ({ ...p, [featureId]: { status: "running" } }));
      try {
        const res = await fetch("/api/admin/api-feature-probe", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, featureId }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          latencyMs?: number;
          preview?: string;
          message?: string;
          error?: string;
        };
        setProbes((p) => ({
          ...p,
          [featureId]: {
            status: json.ok ? "ok" : "error",
            latencyMs: json.latencyMs,
            preview: json.preview,
            message: json.error ?? json.message,
          },
        }));
        if (json.ok || json.latencyMs) onQuotaUsed?.();
      } catch (e) {
        setProbes((p) => ({
          ...p,
          [featureId]: {
            status: "error",
            message: e instanceof Error ? e.message : "Ağ hatası",
          },
        }));
      }
    },
    [platform, onQuotaUsed]
  );

  const runPing = useCallback(async () => {
    setPinging(true);
    setLastPing(null);
    try {
      const res = await fetch(`/api/admin/api-ping?platform=${platform}`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        latencyMs?: number;
        message?: string;
        error?: string;
      };
      setLastPing({
        status: json.ok ? "ok" : "error",
        latencyMs: json.latencyMs,
        message: json.error ?? json.message,
      });
      onQuotaUsed?.();
    } catch (e) {
      setLastPing({
        status: "error",
        message: e instanceof Error ? e.message : "Ağ hatası",
      });
    } finally {
      setPinging(false);
    }
  }, [platform, onQuotaUsed]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-3 py-3 border-b border-border/60 bg-muted/20">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <SocialPlatformIcon platform={platform} size={26} />
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{label}</p>
              <p className="text-[10px] text-muted-foreground font-mono truncate">{apiHost}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] tabular-nums shrink-0">
            {requestsUsed}/{monthlyLimit}
          </Badge>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
          <div
            className={`h-full transition-all ${
              usagePct > 85 ? "bg-red-500" : usagePct > 65 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(100, usagePct)}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge variant="secondary" className="text-[9px] gap-0.5">
            <Layers size={9} /> {features.length} özellik
          </Badge>
          <Badge variant="outline" className="text-[9px]">
            {cronCount} cron
          </Badge>
          {proCount > 0 && (
            <Badge variant="outline" className="text-[9px] gap-0.5 border-violet-300 text-violet-700 dark:border-violet-500/45 dark:text-violet-300">
              <Sparkles size={9} /> {proCount} gelişmiş
            </Badge>
          )}
          {rateLimit && (
            <Badge variant="outline" className="text-[9px] opacity-80">
              {rateLimit}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px] gap-1"
            disabled={pinging}
            onClick={() => void runPing()}
          >
            {pinging ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
            Hızlı ping
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] gap-1"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {expanded ? "Özellikleri gizle" : "Tüm özellikler"}
          </Button>
        </div>
        {lastPing && (
          <p
            className={`mt-2 text-[10px] flex items-center gap-1 ${
              lastPing.status === "ok"
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-red-700 dark:text-red-300"
            }`}
          >
            {lastPing.status === "ok" ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
            Ping {lastPing.latencyMs != null ? `${lastPing.latencyMs}ms` : ""}
            {lastPing.message && lastPing.status !== "ok" && ` · ${lastPing.message.slice(0, 60)}`}
          </p>
        )}
      </div>

      {expanded && (
        <div className="px-3 py-2 space-y-3 max-h-[520px] overflow-y-auto">
          {Array.from(byCategory.entries()).map(([cat, list]) => (
            <FeatureCategoryBlock
              key={cat}
              category={cat}
              features={list}
              probes={probes}
              onProbe={(id) => void runProbe(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FeatureCategoryBlock({
  category,
  features,
  probes,
  onProbe,
}: {
  category: FeatureCategory;
  features: PlatformFeature[];
  probes: Record<string, ProbeState>;
  onProbe: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {FEATURE_CATEGORY_LABELS[category]}
      </p>
      <ul className="space-y-1">
        {features.map((f) => {
          const st = probes[f.id] ?? { status: "idle" as const };
          return (
            <li
              key={f.id}
              className="rounded-md border border-border/70 bg-background/80 px-2 py-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs font-medium">{f.label}</span>
                    {f.usedInCron && (
                      <Badge variant="secondary" className="text-[8px] px-1 py-0 h-4">
                        cron
                      </Badge>
                    )}
                    {f.isPro && (
                      <Badge
                        variant="outline"
                        className="text-[8px] px-1 py-0 h-4 border-violet-300/60 text-violet-600 dark:text-violet-300"
                      >
                        pro
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                    {f.description}
                  </p>
                  <code className="text-[9px] text-muted-foreground/80 font-mono">{f.endpoint}</code>
                  {st.status === "ok" && st.preview && (
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-0.5 truncate">
                      {st.preview}
                    </p>
                  )}
                  {st.status === "error" && st.message && (
                    <p className="text-[10px] text-red-700 dark:text-red-300 mt-0.5 line-clamp-2">
                      {st.message}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px] shrink-0"
                  disabled={st.status === "running"}
                  title="Canlı test (1 kota)"
                  onClick={() => onProbe(f.id)}
                >
                  {st.status === "running" ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : st.status === "ok" ? (
                    <CheckCircle2 size={10} className="text-emerald-600" />
                  ) : st.status === "error" ? (
                    <AlertTriangle size={10} className="text-red-600" />
                  ) : (
                    <Activity size={10} />
                  )}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PlatformApiCapabilitiesGrid({
  platforms,
  onQuotaUsed,
}: {
  platforms: Array<{
    platform: SocialPlatform;
    label: string;
    apiHost: string;
    monthlyLimit: number;
    requestsUsed: number;
    rateLimit?: string;
  }>;
  onQuotaUsed?: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {platforms.map((p) => (
        <PlatformApiCapabilitiesCard
          key={p.platform}
          platform={p.platform}
          label={p.label}
          apiHost={p.apiHost}
          monthlyLimit={p.monthlyLimit}
          requestsUsed={p.requestsUsed}
          rateLimit={p.rateLimit}
          onQuotaUsed={onQuotaUsed}
        />
      ))}
    </div>
  );
}
