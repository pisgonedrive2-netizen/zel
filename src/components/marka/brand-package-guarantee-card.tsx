"use client";

import { useMemo, useState } from "react";
import { Eye, Package, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import {
  BRAND_CONTENT_PACKAGES,
  packageById,
  packageGuaranteeStatus,
  type BrandContentPackageId,
} from "@/lib/brand-package-guarantee";

export function BrandPackageGuaranteeCard({
  actualViews,
  defaultPackageId = "standard",
}: {
  actualViews: number;
  defaultPackageId?: BrandContentPackageId;
}) {
  const [pkgId, setPkgId] = useState<BrandContentPackageId>(defaultPackageId);
  const pkg = useMemo(() => packageById(pkgId), [pkgId]);
  const status = useMemo(
    () => packageGuaranteeStatus(actualViews, pkg.guaranteedViews),
    [actualViews, pkg.guaranteedViews]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package size={16} className="text-[#FF6B00]" />
              Paket & garantili izlenme
            </CardTitle>
            <CardDescription>
              Foxstream içerik paketi performans güvencesi (Temmuz 2026 fiyat listesi)
            </CardDescription>
          </div>
          <Select
            value={pkgId}
            onChange={(e) => setPkgId(e.target.value as BrandContentPackageId)}
            className="w-auto min-w-[140px] text-xs"
            options={BRAND_CONTENT_PACKAGES.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Garanti" value={fmtCompactViews(pkg.guaranteedViews)} sub={pkg.cpmHint} />
          <Stat label="Gerçekleşen" value={fmtCompactViews(actualViews)} icon={<Eye size={14} />} />
          <Stat
            label="Tamamlanma"
            value={`${status.pct}%`}
            icon={<TrendingUp size={14} />}
            tone={status.met ? "ok" : status.pct >= 70 ? "warn" : "muted"}
          />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all ${status.met ? "bg-emerald-500" : "bg-[#FF6B00]"}`}
            style={{ width: `${Math.min(100, status.pct)}%` }}
          />
        </div>
        {status.met ? (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
            <TrendingUp size={12} />
            Hedef aşıldı — bonus erişim: {fmtCompactViews(status.bonus)}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle size={12} />
            Eksik: {fmtCompactViews(status.shortfall)} — sonraki ay ücretsiz telafi kapsamında değerlendirilir
          </p>
        )}
        {pkg.priceUsd > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Paket bedeli: ${pkg.priceUsd.toLocaleString("tr-TR")}/ay · CPM {pkg.cpmHint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
  tone = "muted",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  tone?: "ok" | "warn" | "muted";
}) {
  const cls =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-300"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`flex items-center gap-1 text-lg font-bold tabular-nums ${cls}`}>
        {icon}
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
