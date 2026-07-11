"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  Plus,
  Maximize2,
  RefreshCw,
  Copy,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import Modal from "@/components/ui/modal";
import {
  formatDateLong,
  weekRangeLabel,
  PLAN_ACTIVITIES,
} from "@/components/weekly-plan-ui";
import { PlanContentChip } from "@/components/streamer/week-content-summary";
import { resolvePlanContentType } from "@/lib/plan-content-types";
import {
  weekDayIsosFromStart,
  todayDateLocal,
  formatDateLongTr,
  shiftWeekStartIso,
  weekStartFromDateIso,
} from "@/lib/data";
import { buildWeeklyPlansRepeat } from "@/lib/weekly-plan-repeat";
import { planDayPayrollHints } from "@/lib/plan-day-hints";
import { useStore, WEEKDAYS_LONG, type WeeklyPlan, type Employee } from "@/store/store";
import type { SalaryExtra } from "@/store/store";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<WeeklyPlan["status"], string> = {
  planned:
    "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/50 dark:border-blue-500/40 dark:text-blue-100",
  in_progress:
    "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/45 dark:border-amber-500/40 dark:text-amber-100",
  completed:
    "bg-green-50 border-green-200 text-green-900 dark:bg-green-950/45 dark:border-green-500/40 dark:text-green-100",
  cancelled: "bg-muted border-border text-muted-foreground line-through",
};

const HINT_TONE: Record<string, string> = {
  payroll:
    "bg-blue-100/80 text-blue-900 border-blue-200/60 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-500/30",
  rent: "bg-violet-100/80 text-violet-900 border-violet-200/60 dark:bg-violet-950/50 dark:text-violet-200",
  extra:
    "bg-emerald-100/80 text-emerald-900 border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-200",
};

function parseTime(t?: string): number {
  if (!t) return -1;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatTimeRange(p: WeeklyPlan) {
  if (!p.startTime && !p.endTime) return null;
  return `${p.startTime ?? "—"}${p.endTime ? `–${p.endTime}` : ""}`;
}

export type PlanWeekBoardProps = {
  weekStart: string;
  label: string;
  plans: WeeklyPlan[];
  employee: Employee;
  bordroYm: string;
  salaryExtras: SalaryExtra[];
  accountLabel?: (id?: string) => string;
  onAdd: () => void;
  /** Boş güne tıklayınca o gün için plan ekle. */
  onAddDay?: (iso: string) => void;
  onEdit: (p: WeeklyPlan) => void;
  onWeekChange?: (weekStart: string) => void;
};

export function PlanWeekBoard({
  weekStart,
  label,
  plans,
  employee,
  bordroYm,
  salaryExtras,
  accountLabel,
  onAdd,
  onAddDay,
  onEdit,
}: PlanWeekBoardProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const days = useMemo(() => weekDayIsosFromStart(weekStart), [weekStart]);
  const totalEvents = plans.filter((p) => p.status !== "cancelled").length;
  const shootCount = plans.filter(
    (p) => p.status !== "cancelled" && resolvePlanContentType(p.activity).countsAsShoot
  ).length;

  const dayCell = (iso: string, i: number, compact?: boolean) => {
    const dayPlans = plans
      .filter((p) => p.date === iso)
      .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    const hints = planDayPayrollHints(iso, employee, bordroYm, salaryExtras);
    const isToday = iso === todayDateLocal();
    const hiddenCount = Math.max(0, dayPlans.length - 3);

    return (
      <div
        key={iso}
        className={cn(
          "border rounded-lg p-2 min-h-[140px] flex flex-col",
          compact
            ? "min-w-[9.5rem] max-w-[11rem] w-[9.5rem] flex-none snap-start shrink-0"
            : "min-w-0 w-full",
          isToday
            ? "border-blue-300 bg-blue-50/30 dark:border-blue-500/50 dark:bg-blue-950/35"
            : "border-border"
        )}
      >
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            {WEEKDAYS_LONG[i].slice(0, 3)}{" "}
            <span className="text-foreground/60">{iso.slice(8, 10)}</span>
          </p>
          <div className="flex items-center gap-0.5">
            {dayPlans.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[9px] tabular-nums">
                {dayPlans.length}
              </Badge>
            )}
            {onAddDay && (
              <button
                type="button"
                onClick={() => onAddDay(iso)}
                className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Bu güne plan ekle"
              >
                <Plus size={10} />
              </button>
            )}
          </div>
        </div>
        {hints.length > 0 && (
          <div className="space-y-0.5 mb-1.5">
            {hints.map((h) => (
              <p
                key={h.label}
                className={cn(
                  "text-[8px] leading-tight px-1 py-0.5 rounded border truncate",
                  HINT_TONE[h.tone]
                )}
                title={h.label}
              >
                {h.label}
              </p>
            ))}
          </div>
        )}
        <div className="flex-1 space-y-1 min-h-[48px]">
          {dayPlans.length === 0 ? (
            onAddDay ? (
              <button
                type="button"
                onClick={() => onAddDay(iso)}
                className="flex w-full flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-border/70 py-4 text-[10px] text-muted-foreground/70 transition-colors hover:border-[#FF6B00]/40 hover:bg-[#FF6B00]/5 hover:text-foreground"
              >
                <Plus size={12} />
                Çekim ekle
              </button>
            ) : (
              <p className="text-[10px] text-muted-foreground/40 italic">—</p>
            )
          ) : (
            <>
              {dayPlans.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onEdit(p)}
                  className={cn(
                    "block w-full text-left px-1.5 py-1.5 rounded border text-[10px]",
                    STATUS_COLORS[p.status]
                  )}
                >
                  {formatTimeRange(p) && (
                    <p className="font-mono text-[9px] mb-0.5">{formatTimeRange(p)}</p>
                  )}
                  <PlanContentChip
                    activity={p.activity}
                    brandName={p.brandName}
                    compact
                  />
                </button>
              ))}
              {hiddenCount > 0 && (
                <p className="text-[9px] text-muted-foreground text-center">
                  +{hiddenCount} etkinlik
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="w-full min-w-0 overflow-hidden">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              {label}
              {totalEvents > 0 && (
                <Badge variant="outline" className="text-[10px] font-normal">
                  {shootCount} çekim · {totalEvents} plan
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {formatDateLong(days[0])} – {formatDateLong(days[6])}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1 h-8 text-xs"
              onClick={() => setFullscreen(true)}
            >
              <Maximize2 size={13} /> Geniş ekran
            </Button>
            <Button size="sm" onClick={onAdd} className="gap-1.5 h-8" type="button">
              <Plus size={14} /> Plan Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 snap-x snap-mandatory touch-pan-x -mx-1 px-1">
            {days.map((iso, i) => dayCell(iso, i, true))}
          </div>
          <div className="hidden lg:grid lg:grid-cols-7 gap-2 w-full min-w-0">
            {days.map((iso, i) => dayCell(iso, i, false))}
          </div>
        </CardContent>
      </Card>

      <PlanWeekFullscreen
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        weekStart={weekStart}
        label={label}
        plans={plans}
        employee={employee}
        bordroYm={bordroYm}
        salaryExtras={salaryExtras}
        accountLabel={accountLabel}
        onAdd={onAdd}
        onAddDay={onAddDay}
        onEdit={(p) => {
          setFullscreen(false);
          onEdit(p);
        }}
      />
    </>
  );
}

function PlanWeekFullscreen({
  open,
  onClose,
  weekStart,
  label,
  plans,
  employee,
  bordroYm,
  salaryExtras,
  accountLabel,
  onAdd,
  onEdit,
}: PlanWeekBoardProps & { open: boolean; onClose: () => void }) {
  const days = useMemo(() => weekDayIsosFromStart(weekStart), [weekStart]);

  const hours = useMemo(() => {
    const set = new Set<number>();
    for (let h = 8; h <= 23; h++) set.add(h);
    for (const p of plans) {
      const st = parseTime(p.startTime);
      if (st >= 0) set.add(Math.floor(st / 60));
      const en = parseTime(p.endTime);
      if (en >= 0) set.add(Math.floor(en / 60));
    }
    const arr = [...set].sort((a, b) => a - b);
    return arr.length ? arr : [10, 12, 14, 16, 18, 20, 22];
  }, [plans]);

  return (
    <Modal open={open} onClose={onClose} title={`${label} · geniş takvim`} size="full">
      <div className="space-y-3 -mx-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {weekRangeLabel(weekStart)} · saat dilimli görünüm
          </p>
          <Button type="button" size="sm" onClick={onAdd} className="gap-1.5">
            <Plus size={14} /> Bu güne plan ekle
          </Button>
        </div>
        <div className="overflow-x-auto border border-border rounded-xl">
          <div
            className="grid min-w-[720px]"
            style={{ gridTemplateColumns: `3.5rem repeat(7, minmax(5.5rem, 1fr))` }}
          >
            <div className="border-b border-border bg-muted/30 p-1" />
            {days.map((iso, i) => (
              <div
                key={iso}
                className="border-b border-l border-border bg-muted/30 p-2 text-center"
              >
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                  {WEEKDAYS_LONG[i].slice(0, 3)}
                </p>
                <p className="text-xs font-medium">{iso.slice(8, 10)}</p>
              </div>
            ))}
            {hours.map((hour) => (
              <div key={hour} className="contents">
                <div className="border-b border-border px-1 py-2 text-[10px] text-muted-foreground text-right font-mono bg-muted/20">
                  {String(hour).padStart(2, "0")}:00
                </div>
                {days.map((iso) => {
                  const slotPlans = plans.filter((p) => {
                    if (p.date !== iso) return false;
                    const st = parseTime(p.startTime);
                    if (st < 0) return hour === 10;
                    return Math.floor(st / 60) === hour;
                  });
                  const hints = planDayPayrollHints(iso, employee, bordroYm, salaryExtras);
                  return (
                    <div
                      key={`${iso}-${hour}`}
                      className="border-b border-l border-border p-0.5 min-h-[52px] align-top"
                    >
                      {hour === 10 && hints.map((h) => (
                        <p
                          key={h.label}
                          className={cn(
                            "text-[7px] mb-0.5 px-0.5 rounded truncate",
                            HINT_TONE[h.tone]
                          )}
                        >
                          {h.label}
                        </p>
                      ))}
                      {slotPlans.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onEdit(p)}
                          className={cn(
                            "w-full text-left px-1 py-0.5 mb-0.5 rounded border text-[9px]",
                            STATUS_COLORS[p.status]
                          )}
                        >
                          <p className="font-mono text-[8px]">{formatTimeRange(p)}</p>
                          <PlanContentChip
                            activity={p.activity}
                            brandName={p.brandName}
                            compact
                          />
                          {accountLabel && p.streamerAccountId && (
                            <p className="opacity-60 truncate text-[8px]">
                              {accountLabel(p.streamerAccountId)}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Saatsiz planlar 10:00 satırında gösterilir. Güne tıklayarak düzenleyebilirsiniz.
        </p>
      </div>
    </Modal>
  );
}

export type PlanHistoryPanelProps = {
  plans: WeeklyPlan[];
  weekView: string;
  thisWeek: string;
  employeeId: string;
  userId: string;
  accountLabel?: (id?: string) => string;
  onOpenWeek: (weekStart: string) => void;
  onEdit: (p: WeeklyPlan) => void;
  onRepeatDone?: (count: number) => void;
};

export function PlanHistoryPanel({
  plans,
  weekView,
  thisWeek,
  employeeId,
  userId,
  accountLabel,
  onOpenWeek,
  onEdit,
  onRepeatDone,
}: PlanHistoryPanelProps) {
  const { addWeeklyPlan } = useStore();
  const [search, setSearch] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [reloadBusy, setReloadBusy] = useState(false);
  const [repeatBusy, setRepeatBusy] = useState(false);

  const reloadPlans = useCallback(async () => {
    setReloadBusy(true);
    try {
      const res = await fetch("/api/bootstrap/plans", { credentials: "include" });
      if (!res.ok) throw new Error("Yükleme başarısız");
      const data = (await res.json()) as { weeklyPlans?: WeeklyPlan[] };
      if (data.weeklyPlans) {
        useStore.setState((s) => ({
          weeklyPlans: [
            ...s.weeklyPlans.filter((p) => p.employeeId !== employeeId),
            ...data.weeklyPlans!,
          ],
        }));
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Planlar yüklenemedi");
    } finally {
      setReloadBusy(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void reloadPlans();
  }, [reloadPlans]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans
      .filter((p) => {
        if (activityFilter && p.activity !== activityFilter) return false;
        if (!q) return true;
        return (
          p.activity.toLowerCase().includes(q) ||
          (p.brandName ?? "").toLowerCase().includes(q) ||
          (p.notes ?? "").toLowerCase().includes(q) ||
          p.date.includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  }, [plans, search, activityFilter]);

  const grouped = useMemo(() => {
    const m = new Map<string, WeeklyPlan[]>();
    for (const p of filtered) {
      const wk = weekStartFromDateIso(p.date);
      const arr = m.get(wk) ?? [];
      arr.push(p);
      m.set(wk, arr);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const repeatLastWeek = async () => {
    const prev = shiftWeekStartIso(weekView, -1);
    const drafts = buildWeeklyPlansRepeat(plans, prev, weekView, employeeId, userId);
    if (drafts.length === 0) {
      window.alert("Geçen haftada kopyalanacak plan yok.");
      return;
    }
    if (
      !window.confirm(
        `Geçen haftanın ${drafts.length} planı bu haftaya (${weekRangeLabel(weekView)}) kopyalansın mı?`
      )
    ) {
      return;
    }
    setRepeatBusy(true);
    try {
      for (const d of drafts) addWeeklyPlan(d);
      onRepeatDone?.(drafts.length);
      onOpenWeek(weekView);
    } finally {
      setRepeatBusy(false);
    }
  };

  if (plans.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar size={14} /> Tüm plan geçmişi
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {plans.length} kayıt — arama, filtre ve haftalık tekrar
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              disabled={reloadBusy}
              onClick={() => void reloadPlans()}
            >
              <RefreshCw size={12} className={reloadBusy ? "animate-spin" : ""} />
              Sunucudan yükle
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              disabled={repeatBusy}
              onClick={() => void repeatLastWeek()}
            >
              <Copy size={12} />
              Geçen haftayı tekrarla
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="Ara: aktivite, marka, tarih…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            aria-label="Aktivite filtresi"
          >
            <option value="">Tüm aktiviteler</option>
            {PLAN_ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="max-h-[min(420px,50vh)] overflow-y-auto space-y-4">
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sonuç yok</p>
        ) : (
          grouped.map(([wk, items]) => (
            <div key={wk}>
              <button
                type="button"
                className="w-full flex items-center justify-between text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground"
                onClick={() => onOpenWeek(wk)}
              >
                <span>{weekRangeLabel(wk)}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {items.length} plan
                </Badge>
              </button>
              <div className="space-y-1.5">
                {items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onOpenWeek(weekStartFromDateIso(p.date));
                      onEdit(p);
                    }}
                    className="w-full text-left rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted/50"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{formatDateLongTr(p.date)}</span>
                      {formatTimeRange(p) && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {formatTimeRange(p)}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={cn("text-[9px] h-4", STATUS_COLORS[p.status])}
                      >
                        {p.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <PlanContentChip
                        activity={p.activity}
                        brandName={p.brandName}
                        compact
                      />
                      {p.streamerAccountId && accountLabel && (
                        <span className="text-[10px] text-muted-foreground">
                          {accountLabel(p.streamerAccountId)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
