"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList, Plus, Loader2, RefreshCcw, CalendarDays, Trash2, CheckCircle2, Clock,
  ChevronLeft, ChevronRight, Timer, ListTodo, AlertTriangle, Pencil, CalendarRange, Wallet,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, FormActions } from "@/components/ui/field";
import {
  fetchStaff, fetchTracking, saveTask, saveShift, deleteTracking,
} from "@/lib/brand-personnel-api";
import {
  TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, STAFF_CURRENCY_SYMBOL,
  shiftHours, formatHours, hourlyRate,
  type BrandStaff, type BrandStaffShift, type BrandStaffTask,
  type StaffCurrency, type TaskPriority, type TaskStatus,
} from "@/types/brand-personnel";

const COLUMNS: { id: TaskStatus; label: string; accent: string }[] = [
  { id: "todo", label: "Yapılacak", accent: "border-t-zinc-400" },
  { id: "in_progress", label: "Devam ediyor", accent: "border-t-blue-500" },
  { id: "done", label: "Tamamlandı", accent: "border-t-green-500" },
];
const PRIORITY_CLS: Record<TaskPriority, string> = {
  low: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400",
  medium: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-300",
  high: "border-red-300 bg-red-50 text-red-700 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-300",
};
const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

// ── Tarih yardımcıları (yerel) ──────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = r.getDay(); // 0=Paz
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(r, diff);
}
const dayNum = (d: Date) => d.getDate();

const emptyTask = {
  id: "", title: "", description: "", staffId: "", status: "todo" as TaskStatus, priority: "medium" as TaskPriority, dueDate: "",
};
const emptyShift = { id: "", staffId: "", shiftDate: "", startTime: "09:00", endTime: "18:00", note: "" };

export default function MarkaTakipPage() {
  const { user, brandId, brand, canViewBrand, isAdminView } = useMarkaPortal();
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);
  const [tasks, setTasks] = useState<BrandStaffTask[]>([]);
  const [shifts, setShifts] = useState<BrandStaffShift[]>([]);
  const [staff, setStaff] = useState<BrandStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState(emptyShift);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const [tracking, st] = await Promise.all([fetchTracking(brandId), fetchStaff(brandId)]);
      setTasks(tracking.tasks);
      setShifts(tracking.shifts);
      setStaff(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  const staffName = useCallback((sid?: string) => staff.find((s) => s.id === sid)?.name ?? "Atanmamış", [staff]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekDayKeys = useMemo(() => weekDays.map(ymd), [weekDays]);
  const weekRange = useMemo(() => ({ start: weekDayKeys[0], end: weekDayKeys[6] }), [weekDayKeys]);
  const isThisWeek = ymd(startOfWeek(new Date())) === weekDayKeys[0];

  // staffId → (ymd → shifts)
  const shiftsByStaffDay = useMemo(() => {
    const map = new Map<string, Map<string, BrandStaffShift[]>>();
    for (const s of shifts) {
      if (s.shiftDate < weekRange.start || s.shiftDate > weekRange.end) continue;
      let byDay = map.get(s.staffId);
      if (!byDay) {
        byDay = new Map();
        map.set(s.staffId, byDay);
      }
      const arr = byDay.get(s.shiftDate);
      if (arr) arr.push(s);
      else byDay.set(s.shiftDate, [s]);
    }
    return map;
  }, [shifts, weekRange]);

  // Vardiyası olan ama listede olmayan personeli de göstermek için birleşik satırlar
  const gridStaff = useMemo(() => {
    const rows = [...staff];
    const known = new Set(staff.map((s) => s.id));
    for (const sid of shiftsByStaffDay.keys()) {
      if (!known.has(sid)) {
        rows.push({
          id: sid, brandId: brandId ?? "", name: staffName(sid), role: "", status: "active",
          monthlyCost: 0, currency: "USD", avatar: "", notes: "", createdAt: "", updatedAt: "",
        } as BrandStaff);
      }
    }
    return rows;
  }, [staff, shiftsByStaffDay, brandId, staffName]);

  const weeklyHoursByStaff = useMemo(() => {
    const map = new Map<string, number>();
    for (const [sid, byDay] of shiftsByStaffDay) {
      let total = 0;
      for (const arr of byDay.values()) for (const s of arr) total += shiftHours(s.startTime, s.endTime);
      map.set(sid, total);
    }
    return map;
  }, [shiftsByStaffDay]);

  const weekTotals = useMemo(() => {
    let totalHours = 0;
    const costByCur: Record<string, number> = {};
    for (const s of gridStaff) {
      const h = weeklyHoursByStaff.get(s.id) ?? 0;
      totalHours += h;
      const rate = hourlyRate(s.monthlyCost);
      if (rate > 0 && h > 0) costByCur[s.currency] = (costByCur[s.currency] ?? 0) + rate * h;
    }
    return { totalHours, costByCur };
  }, [gridStaff, weeklyHoursByStaff]);

  const todayKey = ymd(new Date());
  const taskStats = useMemo(() => {
    const open = tasks.filter((t) => t.status === "todo" || t.status === "in_progress").length;
    const overdue = tasks.filter(
      (t) => t.status !== "done" && t.status !== "cancelled" && t.dueDate && t.dueDate < todayKey
    ).length;
    return { open, overdue };
  }, [tasks, todayKey]);

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, BrandStaffTask[]> = { todo: [], in_progress: [], done: [], cancelled: [] };
    const rank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
    for (const t of tasks) map[t.status]?.push(t);
    for (const k of Object.keys(map) as TaskStatus[]) {
      map[k].sort((a, b) => rank[a.priority] - rank[b.priority]);
    }
    return map;
  }, [tasks]);

  // ── Görev işlemleri ─────────────────────────────────────────────────────
  const openNewTask = () => {
    setTaskForm(emptyTask);
    setTaskOpen(true);
  };
  const openEditTask = (t: BrandStaffTask) => {
    setTaskForm({
      id: t.id, title: t.title, description: t.description, staffId: t.staffId ?? "",
      status: t.status, priority: t.priority, dueDate: t.dueDate ?? "",
    });
    setTaskOpen(true);
  };
  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !taskForm.title.trim()) return;
    setBusy(true);
    try {
      await saveTask({
        id: taskForm.id || undefined,
        brandId,
        title: taskForm.title.trim(),
        description: taskForm.description,
        staffId: taskForm.staffId || undefined,
        status: taskForm.status,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || undefined,
      });
      setTaskOpen(false);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };
  const advanceTask = async (t: BrandStaffTask) => {
    if (!brandId) return;
    const order: TaskStatus[] = ["todo", "in_progress", "done"];
    const next = order[(order.indexOf(t.status) + 1) % order.length];
    try {
      await saveTask({ ...t, brandId, status: next });
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Güncellenemedi");
    }
  };
  const removeTask = async (t: BrandStaffTask) => {
    if (!confirm(`"${t.title}" görevi silinsin mi?`)) return;
    try {
      await deleteTracking("task", t.id);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Silinemedi");
    }
  };

  // ── Vardiya işlemleri ───────────────────────────────────────────────────
  const openNewShift = (staffId: string, date: string) => {
    if (readOnly) return;
    setShiftForm({ ...emptyShift, staffId, shiftDate: date });
    setShiftOpen(true);
  };
  const openEditShift = (s: BrandStaffShift) => {
    setShiftForm({ id: s.id, staffId: s.staffId, shiftDate: s.shiftDate, startTime: s.startTime, endTime: s.endTime, note: s.note });
    setShiftOpen(true);
  };
  const submitShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !shiftForm.staffId || !shiftForm.shiftDate) return;
    setBusy(true);
    try {
      await saveShift({
        id: shiftForm.id || undefined,
        brandId,
        staffId: shiftForm.staffId,
        shiftDate: shiftForm.shiftDate,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        note: shiftForm.note,
      });
      setShiftOpen(false);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Vardiya kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };
  const removeShift = async (id: string) => {
    if (!confirm("Vardiya silinsin mi?")) return;
    try {
      await deleteTracking("shift", id);
      setShiftOpen(false);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Silinemedi");
    }
  };

  const shiftFormHours = shiftHours(shiftForm.startTime, shiftForm.endTime);
  const weekTitle = `${dayNum(weekDays[0])} ${weekDays[0].toLocaleDateString("tr-TR", { month: "short" })} – ${dayNum(weekDays[6])} ${weekDays[6].toLocaleDateString("tr-TR", { month: "short", year: "numeric" })}`;

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1280px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <ClipboardList size={22} /> Vardiya & Takip
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{brand?.name} haftalık vardiya planı ve ekip görevleri</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
            </Button>
            {!readOnly && (
              <Button size="sm" className="gap-1.5" onClick={openNewTask}><Plus size={14} /> Görev ekle</Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        {/* KPI'lar */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={<Timer size={18} />} label="Bu hafta vardiya saati" value={formatHours(weekTotals.totalHours)} tone="primary" />
          <Kpi icon={<ListTodo size={18} />} label="Açık görev" value={String(taskStats.open)} tone="blue" />
          <Kpi
            icon={<AlertTriangle size={18} />}
            label="Geciken görev"
            value={String(taskStats.overdue)}
            tone={taskStats.overdue > 0 ? "red" : "zinc"}
          />
          <Kpi
            icon={<Wallet size={18} />}
            label="Tahmini haftalık maliyet"
            value={
              Object.keys(weekTotals.costByCur).length === 0
                ? "—"
                : (Object.entries(weekTotals.costByCur) as [StaffCurrency, number][])
                    .map(([c, v]) => `${STAFF_CURRENCY_SYMBOL[c]}${Math.round(v).toLocaleString("tr-TR")}`)
                    .join(" + ")
            }
            tone="green"
            sub="aylık maliyetten tahmini"
          />
        </div>

        {/* Haftalık vardiya gridi */}
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <CalendarRange size={16} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Haftalık vardiya</h2>
              <span className="text-xs text-muted-foreground tabular-nums">{weekTitle}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="Önceki hafta">
                <ChevronLeft size={15} />
              </Button>
              <Button variant={isThisWeek ? "secondary" : "outline"} size="sm" className="h-8" onClick={() => setWeekStart(startOfWeek(new Date()))}>
                Bu hafta
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="Sonraki hafta">
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>
          <CardContent className="p-0">
            {loading && staff.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 size={22} className="mx-auto animate-spin opacity-50" />
                <p className="mt-2 text-sm">Yükleniyor…</p>
              </div>
            ) : gridStaff.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Henüz personel yok. Önce <strong>Personel</strong> sayfasından ekip üyesi ekleyin.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-card px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Personel
                      </th>
                      {weekDays.map((d, i) => {
                        const isToday = weekDayKeys[i] === todayKey;
                        return (
                          <th key={weekDayKeys[i]} className={`min-w-[112px] px-2 py-2.5 text-center text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                            <span className="uppercase">{DAY_LABELS[i]}</span>
                            <span className="ml-1 tabular-nums">{dayNum(d)}</span>
                          </th>
                        );
                      })}
                      <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Saat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gridStaff.map((s) => {
                      const byDay = shiftsByStaffDay.get(s.id);
                      const weekH = weeklyHoursByStaff.get(s.id) ?? 0;
                      return (
                        <tr key={s.id} className="border-t border-border/60">
                          <td className="sticky left-0 z-10 border-t border-border/60 bg-card px-3 py-2 align-top">
                            <div className="flex items-center gap-2">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                                {s.avatar || s.name.slice(0, 1).toUpperCase()}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] font-medium text-foreground">{s.name}</span>
                                {s.role && <span className="block truncate text-[11px] text-muted-foreground">{s.role}</span>}
                              </span>
                            </div>
                          </td>
                          {weekDays.map((_, i) => {
                            const key = weekDayKeys[i];
                            const cell = byDay?.get(key) ?? [];
                            const isToday = key === todayKey;
                            return (
                              <td
                                key={key}
                                onClick={() => cell.length === 0 && openNewShift(s.id, key)}
                                className={`border-t border-border/60 px-1.5 py-1.5 align-top ${isToday ? "bg-primary/5" : ""} ${!readOnly && cell.length === 0 ? "cursor-pointer hover:bg-accent/20" : ""}`}
                              >
                                <div className="flex flex-col gap-1">
                                  {cell
                                    .slice()
                                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                    .map((sh) => {
                                      const leave = sh.note.trim().toLocaleUpperCase("tr").startsWith("İZİN");
                                      return (
                                        <button
                                          key={sh.id}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (readOnly) return;
                                            openEditShift(sh);
                                          }}
                                          className={`w-full rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight transition-colors ${
                                            leave
                                              ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200"
                                              : "border-primary/30 bg-primary/10 text-foreground hover:bg-primary/20"
                                          } ${readOnly ? "cursor-default" : ""}`}
                                          title={sh.note || undefined}
                                        >
                                          <span className="block font-medium tabular-nums">{sh.startTime}–{sh.endTime}</span>
                                          <span className="block opacity-70 tabular-nums">{formatHours(shiftHours(sh.startTime, sh.endTime))}</span>
                                          {sh.note && <span className="block truncate opacity-80">{sh.note}</span>}
                                        </button>
                                      );
                                    })}
                                  {cell.length > 0 && !readOnly && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); openNewShift(s.id, key); }}
                                      className="flex items-center justify-center rounded-md border border-dashed border-border py-0.5 text-muted-foreground hover:bg-accent/20"
                                      aria-label="Vardiya ekle"
                                    >
                                      <Plus size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="border-t border-border/60 px-3 py-2 text-right align-top">
                            <span className={`text-[13px] font-semibold tabular-nums ${weekH > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                              {weekH > 0 ? formatHours(weekH) : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/30">
                      <td className="sticky left-0 z-10 bg-muted/30 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Toplam
                      </td>
                      <td colSpan={7} className="px-3 py-2.5 text-xs text-muted-foreground">
                        {!readOnly && "Boş güne tıklayarak vardiya ekleyebilirsiniz."}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[13px] font-bold tabular-nums text-foreground">
                        {formatHours(weekTotals.totalHours)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Görev panosu */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <ListTodo size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Görevler</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.id} className={`rounded-xl border border-t-4 ${col.accent} border-border bg-card`}>
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                  <Badge variant="outline" className="text-[10px] tabular-nums">{byStatus[col.id].length}</Badge>
                </div>
                <div className="space-y-2 p-3">
                  {byStatus[col.id].length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">Görev yok</p>
                  ) : (
                    byStatus[col.id].map((t) => {
                      const overdue = t.status !== "done" && !!t.dueDate && t.dueDate < todayKey;
                      return (
                        <div key={t.id} className="rounded-lg border border-border bg-background px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            {readOnly ? (
                              <span className="mt-0.5 shrink-0">
                                {t.status === "done" ? <CheckCircle2 size={15} className="text-green-600" /> : <Clock size={15} className="text-muted-foreground" />}
                              </span>
                            ) : (
                              <button onClick={() => void advanceTask(t)} className="mt-0.5 shrink-0" aria-label="İlerlet">
                                {t.status === "done" ? <CheckCircle2 size={15} className="text-green-600" /> : <Clock size={15} className="text-muted-foreground" />}
                              </button>
                            )}
                            <span className={`flex-1 text-sm font-medium ${t.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.title}</span>
                            {!readOnly && (
                              <div className="flex shrink-0 gap-0.5">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEditTask(t)} aria-label="Düzenle"><Pencil size={12} /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void removeTask(t)} aria-label="Sil"><Trash2 size={12} /></Button>
                              </div>
                            )}
                          </div>
                          {t.description && <p className="mt-1 pl-6 text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                            <Badge variant="outline" className={`text-[10px] ${PRIORITY_CLS[t.priority]}`}>{TASK_PRIORITY_LABELS[t.priority]}</Badge>
                            <span className="text-[10px] text-muted-foreground">{staffName(t.staffId)}</span>
                            {t.dueDate && (
                              <span className={`text-[10px] tabular-nums ${overdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                                · {t.dueDate}{overdue ? " ⚠" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Görev modalı */}
      <Modal open={taskOpen} onClose={() => setTaskOpen(false)} title={taskForm.id ? "Görevi düzenle" : "Yeni görev"} size="md">
        <form onSubmit={submitTask} className="space-y-4">
          <Field label="Başlık" required>
            <Input value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} required autoFocus />
          </Field>
          <Field label="Açıklama">
            <Textarea value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Atanan personel">
              <Select value={taskForm.staffId} onChange={(e) => setTaskForm((f) => ({ ...f, staffId: e.target.value }))}
                options={[{ value: "", label: "Atanmamış" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} />
            </Field>
            <Field label="Son tarih">
              <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </Field>
            <Field label="Durum">
              <Select value={taskForm.status} onChange={(e) => setTaskForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
                options={[...COLUMNS.map((c) => ({ value: c.id, label: TASK_STATUS_LABELS[c.id] })), { value: "cancelled", label: "İptal" }]} />
            </Field>
            <Field label="Öncelik">
              <Select value={taskForm.priority} onChange={(e) => setTaskForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
                options={[{ value: "low", label: "Düşük" }, { value: "medium", label: "Orta" }, { value: "high", label: "Yüksek" }]} />
            </Field>
          </div>
          <FormActions onCancel={() => setTaskOpen(false)} submitLabel={busy ? "Kaydediliyor..." : taskForm.id ? "Güncelle" : "Görev ekle"} />
        </form>
      </Modal>

      {/* Vardiya modalı */}
      <Modal open={shiftOpen} onClose={() => setShiftOpen(false)} title={shiftForm.id ? "Vardiyayı düzenle" : "Yeni vardiya"} size="md">
        <form onSubmit={submitShift} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Personel" required>
              <Select value={shiftForm.staffId} onChange={(e) => setShiftForm((f) => ({ ...f, staffId: e.target.value }))}
                options={[{ value: "", label: "Seçin…" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} />
            </Field>
            <Field label="Tarih" required>
              <Input type="date" value={shiftForm.shiftDate} onChange={(e) => setShiftForm((f) => ({ ...f, shiftDate: e.target.value }))} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Başlangıç">
              <Input type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm((f) => ({ ...f, startTime: e.target.value }))} />
            </Field>
            <Field label="Bitiş">
              <Input type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm((f) => ({ ...f, endTime: e.target.value }))} />
            </Field>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Süre: <span className="font-medium text-foreground tabular-nums">{formatHours(shiftFormHours)}</span>
            {shiftForm.endTime <= shiftForm.startTime && " · gece vardiyası (+1 gün)"}
          </p>
          <Field label="Not" hint='İzin için "İZİN:" ile başlayın (ör. İZİN: yıllık).'>
            <Input value={shiftForm.note} onChange={(e) => setShiftForm((f) => ({ ...f, note: e.target.value }))} placeholder="Ör. uzaktan, İZİN: yıllık" />
          </Field>
          <FormActions
            onCancel={() => setShiftOpen(false)}
            submitLabel={busy ? "Kaydediliyor..." : shiftForm.id ? "Güncelle" : "Vardiya ekle"}
            onDelete={shiftForm.id ? () => void removeShift(shiftForm.id) : undefined}
          />
        </form>
      </Modal>
    </MarkaPageGuard>
  );
}

function Kpi({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: "primary" | "blue" | "red" | "green" | "zinc";
}) {
  const toneCls: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    zinc: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneCls[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-bold tabular-nums">{value}</p>
          {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
