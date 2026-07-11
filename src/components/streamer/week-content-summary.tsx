"use client";

import { useMemo } from "react";
import {
  Clapperboard,
  Film,
  Sparkles,
  CalendarDays,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { WEEKDAYS_LONG, type WeeklyPlan } from "@/store/store";
import { weekDayIsosFromStart } from "@/lib/data";
import {
  resolvePlanContentType,
  summarizeWeekPlans,
} from "@/lib/plan-content-types";
import { cn } from "@/lib/utils";

export function WeekContentSummary({
  weekStart,
  plans,
}: {
  weekStart: string;
  plans: WeeklyPlan[];
}) {
  const weekDays = useMemo(() => weekDayIsosFromStart(weekStart), [weekStart]);
  const summary = useMemo(
    () => summarizeWeekPlans(plans, weekDays),
    [plans, weekDays]
  );

  const maxType = Math.max(1, ...summary.byType.map((t) => t.count));
  const brandLabel =
    summary.brandCount === 0
      ? "Marka seçilmedi"
      : `${summary.brandCount} marka`;

  return (
    <Card className="relative overflow-hidden border-border/80">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#FF6B00]/8 via-transparent to-violet-500/10"
      />
      <CardContent className="relative z-10 space-y-5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#FF6B00]">
              Haftalık çekim özeti
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              {summary.shootCount === 0
                ? "Bu hafta henüz çekim planı yok"
                : `${summary.shootCount} içerik · ${brandLabel} · ${summary.activeDays} gün`}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Reels, vlog, adult ve canlı — gün gün hangi markaya ne çekileceği
            </p>
          </div>
          {summary.shootCount > 0 && (
            <div className="flex flex-wrap gap-2">
              <StatPill
                icon={Clapperboard}
                label="İçerik"
                value={String(summary.shootCount)}
              />
              <StatPill
                icon={Tag}
                label="Marka"
                value={String(summary.brandCount)}
              />
              <StatPill
                icon={CalendarDays}
                label="Gün"
                value={String(summary.activeDays)}
              />
            </div>
          )}
        </div>

        {/* Gün şeridi */}
        <div className="grid grid-cols-7 gap-1.5">
          {summary.byDay.map((day, i) => {
            const isActive = day.shootCount > 0;
            return (
              <div
                key={day.date}
                className={cn(
                  "rounded-xl border px-1.5 py-2 text-center transition-colors",
                  isActive
                    ? "border-[#FF6B00]/35 bg-[#FF6B00]/8 shadow-[0_0_20px_-12px_rgba(255,107,0,0.7)]"
                    : "border-border/60 bg-muted/20"
                )}
                title={
                  isActive
                    ? `${day.brands.join(", ") || "Marka yok"} · ${day.types.join(", ")}`
                    : undefined
                }
              >
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {WEEKDAYS_LONG[i].slice(0, 3)}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-sm font-bold tabular-nums",
                    isActive ? "text-foreground" : "text-muted-foreground/40"
                  )}
                >
                  {isActive ? day.shootCount : "·"}
                </p>
                {isActive && (
                  <p className="mt-0.5 truncate text-[8px] leading-tight text-muted-foreground">
                    {day.types.slice(0, 2).join(" · ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {summary.shootCount > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Tip dağılımı */}
            <div className="rounded-xl border border-border/70 bg-background/70 p-3.5 backdrop-blur-sm">
              <div className="mb-2.5 flex items-center gap-1.5">
                <Film size={13} className="text-muted-foreground" />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  İçerik tipleri
                </p>
              </div>
              <div className="space-y-2">
                {summary.byType.map(({ def, count }) => (
                  <div key={def.kind} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                          def.chipClass
                        )}
                      >
                        {def.shortLabel}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-foreground">
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#FF6B00] to-violet-500"
                        style={{ width: `${(count / maxType) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Marka dağılımı */}
            <div className="rounded-xl border border-border/70 bg-background/70 p-3.5 backdrop-blur-sm">
              <div className="mb-2.5 flex items-center gap-1.5">
                <Sparkles size={13} className="text-muted-foreground" />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Marka başına
                </p>
              </div>
              {summary.byBrand.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Planlara marka ekleyince burada görünür.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {summary.byBrand.map((b) => (
                    <div
                      key={b.name}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"
                    >
                      <span className="text-xs font-medium text-foreground">
                        {b.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="h-4 min-w-4 justify-center px-1 text-[9px] tabular-nums"
                      >
                        {b.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {summary.shootCount === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-center text-xs text-muted-foreground">
            Günlere Reels / Vlog / Adult ekleyerek haftalık üretimi buradan takip et.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur-sm">
      <Icon size={13} className="text-[#FF6B00]" />
      <div className="leading-none">
        <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-bold tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  );
}

/** Takvim gün kartında tip + marka satırı */
export function PlanContentChip({
  activity,
  brandName,
  compact,
}: {
  activity: string;
  brandName?: string;
  compact?: boolean;
}) {
  const def = resolvePlanContentType(activity);
  return (
    <div className={cn("min-w-0", compact && "space-y-0.5")}>
      <span
        className={cn(
          "inline-flex max-w-full truncate rounded border px-1 py-px text-[9px] font-semibold leading-tight",
          def.chipClass
        )}
      >
        {def.shortLabel}
      </span>
      {brandName ? (
        <p className="truncate text-[9px] font-medium opacity-80">{brandName}</p>
      ) : (
        <p className="truncate text-[9px] italic opacity-50">Marka yok</p>
      )}
    </div>
  );
}
