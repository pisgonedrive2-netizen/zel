"use client";

import { AlertTriangle, Shield, ShieldCheck, TrendingUp } from "lucide-react";
import { complianceCompletionPct } from "@/lib/marka-igaming-api";
import type { BrandComplianceCheck, BrandRiskFlag } from "@/types/brand-igaming";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  complianceChecks: BrandComplianceCheck[];
  riskFlags?: BrandRiskFlag[];
  /** Deposit/withdrawal spike tespiti (operasyon metriklerinden). */
  depositSpike?: boolean;
  withdrawalSpike?: boolean;
  compact?: boolean;
};

const SEVERITY_STYLE: Record<BrandRiskFlag["severity"], string> = {
  high: "border-red-300/60 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200",
  medium:
    "border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200",
  low: "border-border bg-muted text-muted-foreground",
};

const FLAG_LABELS: Record<BrandRiskFlag["flagType"], string> = {
  deposit_spike: "Yatırım artışı",
  withdrawal_spike: "Çekim artışı",
  duplicate_device: "Çift cihaz",
  incentive_abuse: "Teşvik kötüye kullanım",
  other: "Diğer risk",
};

export function BrandRiskSummary({
  complianceChecks,
  riskFlags = [],
  depositSpike,
  withdrawalSpike,
  compact,
}: Props) {
  const completionPct = complianceCompletionPct(complianceChecks);
  const pendingCompliance = complianceChecks.filter((c) => c.status === "pending").length;
  const failedCompliance = complianceChecks.filter((c) => c.status === "failed").length;

  const heuristicFlags: { label: string; severity: BrandRiskFlag["severity"] }[] = [];
  if (depositSpike) heuristicFlags.push({ label: "Şüpheli yatırım artışı", severity: "medium" });
  if (withdrawalSpike) heuristicFlags.push({ label: "Şüpheli çekim artışı", severity: "medium" });

  const activeFlags = [
    ...riskFlags.filter((f) => !f.resolvedAt),
    ...heuristicFlags.map((h, i) => ({
      id: `heuristic-${i}`,
      brandId: "",
      flagType: "other" as const,
      severity: h.severity,
      detectedAt: "",
      notes: h.label,
    })),
  ];

  return (
    <Card
      className={cn(
        failedCompliance > 0 && "border-red-200/70 dark:border-red-500/40",
        compact && "shadow-none"
      )}
    >
      <CardHeader className={cn("pb-2", compact && "py-3")}>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield size={16} className="text-slate-700 dark:text-slate-300" />
          Risk & uyumluluk
        </CardTitle>
        <CardDescription>Fraud bayrakları ve checklist durumu</CardDescription>
      </CardHeader>
      <CardContent className={cn("space-y-4", compact && "pt-0")}>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <ShieldCheck size={11} />
              Uyumluluk
            </p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">%{completionPct}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {pendingCompliance} bekleyen · {failedCompliance} başarısız
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  completionPct >= 80
                    ? "bg-emerald-500"
                    : completionPct >= 50
                      ? "bg-amber-500"
                      : "bg-red-500"
                )}
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <AlertTriangle size={11} />
              Aktif risk
            </p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">{activeFlags.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {activeFlags.length === 0 ? "Bayrak yok" : "İnceleme önerilir"}
            </p>
          </div>
        </div>

        {activeFlags.length > 0 && (
          <ul className="space-y-1.5">
            {activeFlags.slice(0, compact ? 3 : 6).map((flag) => (
              <li
                key={flag.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-xs"
              >
                <span className="flex items-center gap-1.5 text-foreground">
                  <TrendingUp size={12} className="text-muted-foreground" />
                  {flag.notes || FLAG_LABELS[flag.flagType]}
                </span>
                <Badge variant="outline" className={cn("text-[10px]", SEVERITY_STYLE[flag.severity])}>
                  {flag.severity === "high" ? "Yüksek" : flag.severity === "medium" ? "Orta" : "Düşük"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
