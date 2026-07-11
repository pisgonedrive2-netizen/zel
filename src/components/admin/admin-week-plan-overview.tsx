"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clapperboard,
  Tag,
  Users,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  WEEKDAYS_LONG,
  type Employee,
  type WeeklyPlan,
} from "@/store/store";
import { weekDayIsosFromStart, shiftWeekStartIso } from "@/lib/data";
import { weekRangeLabel } from "@/components/weekly-plan-ui";
import {
  resolvePlanContentType,
  summarizeWeekPlans,
} from "@/lib/plan-content-types";
import { cn } from "@/lib/utils";

function formatDayShort(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

/**
 * Yönetici: bu hafta aktif yayıncılarda kaç markaya ne zaman çekim.
 */
export function AdminWeekPlanOverview({
  weekStart,
  onWeekChange,
  plans,
  employees,
  compact = false,
  href = "/takvim",
}: {
  weekStart: string;
  onWeekChange?: (nextWeekStart: string) => void;
  plans: WeeklyPlan[];
  employees: Employee[];
  compact?: boolean;
  href?: string;
}) {
  const weekDays = useMemo(() => weekDayIsosFromStart(weekStart), [weekStart]);
  const activeEmps = useMemo(
    () =>
      employees.filter(
        (e) =>
          e.status === "active" &&
          (e.kind === "streamer" || e.kind === "moderator")
      ),
    [employees]
  );
  const activeIds = useMemo(
    () => new Set(activeEmps.map((e) => e.id)),
    [activeEmps]
  );

  const weekPlans = useMemo(
    () =>
      plans.filter(
        (p) =>
          activeIds.has(p.employeeId) &&
          p.status !== "cancelled" &&
          weekDays.includes(p.date)
      ),
    [plans, activeIds, weekDays]
  );

  const summary = useMemo(
    () => summarizeWeekPlans(weekPlans, weekDays),
    [weekPlans, weekDays]
  );

  const byStreamer = useMemo(() => {
    return activeEmps
      .map((emp) => {
        const empPlans = weekPlans.filter((p) => p.employeeId === emp.id);
        const s = summarizeWeekPlans(empPlans, weekDays);
        return { emp, plans: empPlans, summary: s };
      })
      .filter((r) => r.summary.shootCount > 0 || r.plans.length > 0);
  }, [activeEmps, weekPlans, weekDays]);

  const rangeLabel = weekRangeLabel(weekStart);

  const shiftWeek = (delta: number) => {
    if (!onWeekChange) return;
    onWeekChange(shiftWeekStartIso(weekStart, delta));
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-border/80",
        compact ? "mb-4" : "mb-5"
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#FF6B00]/10 via-transparent to-sky-500/10"
      />
      <CardContent className={cn("relative z-10 space-y-4", compact ? "p-4" : "p-5 sm:p-6")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#FF6B00]">
              Bu hafta · çekim komuta
            </p>
            <h2
              className={cn(
                "mt-1 font-semibold tracking-tight text-foreground",
                compact ? "text-base" : "text-xl"
              )}
            >
              {summary.shootCount === 0
                ? "Bu hafta henüz çekim planı yok"
                : `${summary.shootCount} içerik · ${summary.brandCount} marka · ${summary.activeDays} gün`}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeEmps.length === 1
                ? `${activeEmps[0].name} · ${rangeLabel}`
                : `${activeEmps.length} aktif yayıncı · ${rangeLabel}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onWeekChange && (
              <div className="inline-flex items-center rounded-xl border border-border/80 bg-background/80 p-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => shiftWeek(-1)}
                  aria-label="Önceki hafta"
                >
                  <ChevronLeft size={14} />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => shiftWeek(1)}
                  aria-label="Sonraki hafta"
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            )}
            <Link
              href={href}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              Takvimi aç <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatChip icon={Clapperboard} label="İçerik" value={summary.shootCount} />
          <StatChip icon={Tag} label="Marka" value={summary.brandCount} />
          <StatChip icon={CalendarDays} label="Gün" value={summary.activeDays} />
          <StatChip icon={Users} label="Yayıncı" value={activeEmps.length} />
        </div>

        {/* 7 günlük şerit — marka + tip */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {summary.byDay.map((day, i) => {
            const isActive = day.shootCount > 0;
            const isToday =
              day.date === new Date().toISOString().slice(0, 10);
            return (
              <div
                key={day.date}
                className={cn(
                  "rounded-xl border px-1.5 py-2.5 text-center transition-colors sm:px-2",
                  isActive
                    ? "border-[#FF6B00]/40 bg-[#FF6B00]/10"
                    : "border-border/60 bg-muted/15",
                  isToday && "ring-1 ring-[#FF6B00]/50"
                )}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {WEEKDAYS_LONG[i].slice(0, 3)}
                </p>
                <p className="text-[10px] tabular-nums text-muted-foreground/80">
                  {formatDayShort(day.date)}
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm font-bold tabular-nums",
                    isActive ? "text-foreground" : "text-muted-foreground/35"
                  )}
                >
                  {isActive ? day.shootCount : "·"}
                </p>
                {isActive && (
                  <p
                    className="mt-1 line-clamp-2 text-[8px] leading-tight text-muted-foreground sm:text-[9px]"
                    title={day.brands.join(", ")}
                  >
                    {day.brands.slice(0, 2).join(" · ") || day.types.slice(0, 2).join(" · ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {!compact && summary.byBrand.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Marka dağılımı
            </p>
            <div className="flex flex-wrap gap-1.5">
              {summary.byBrand.map((b) => (
                <Badge
                  key={b.name}
                  variant="outline"
                  className="gap-1 border-[#FF6B00]/25 bg-[#FF6B00]/5 text-[11px]"
                >
                  {b.name}
                  <span className="tabular-nums text-muted-foreground">×{b.count}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {!compact && byStreamer.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Yayıncı bazlı
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {byStreamer.map(({ emp, summary: s, plans: empPlans }) => (
                <div
                  key={emp.id}
                  className="rounded-xl border border-border/70 bg-background/70 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{emp.name}</p>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {s.shootCount} içerik · {s.brandCount} marka
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {empPlans
                      .filter((p) => resolvePlanContentType(p.activity).countsAsShoot)
                      .slice(0, 6)
                      .map((p) => {
                        const def = resolvePlanContentType(p.activity);
                        const dayIdx = weekDays.indexOf(p.date);
                        return (
                          <li
                            key={p.id}
                            className="flex items-center justify-between gap-2 text-[11px]"
                          >
                            <span className="truncate text-muted-foreground">
                              {dayIdx >= 0 ? WEEKDAYS_LONG[dayIdx].slice(0, 3) : p.date}
                              {p.startTime ? ` · ${p.startTime}` : ""}
                              {" · "}
                              <span className="font-medium text-foreground">
                                {p.brandName?.trim() || "Markasız"}
                              </span>
                            </span>
                            <Badge variant="secondary" className="shrink-0 text-[9px]">
                              {def.shortLabel}
                            </Badge>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clapperboard;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px]">
      <Icon size={12} className="text-[#FF6B00]" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </span>
  );
}
