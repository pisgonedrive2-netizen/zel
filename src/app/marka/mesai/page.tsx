"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock, Loader2, RefreshCcw, LogIn, LogOut, Coffee, Play,
  Users, Timer, Pause, CalendarRange, ChevronLeft, ChevronRight, Trash2,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchStaff, fetchAttendance, attendanceAction, deleteAttendance,
} from "@/lib/brand-personnel-api";
import {
  ATTENDANCE_STATUS_LABELS, attendanceWorkedMinutes, formatHours,
  type AttendanceAction, type BrandStaff, type BrandStaffAttendance,
} from "@/types/brand-personnel";

const STATUS_CLS: Record<string, string> = {
  in: "border-green-300 bg-green-50 text-green-700 dark:border-green-500/45 dark:bg-green-950/40 dark:text-green-300",
  on_break: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-300",
  out: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400",
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtClock = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "—");
const fmtMins = (m: number) => formatHours(Math.round((m / 60) * 100) / 100);

export default function MarkaMesaiPage() {
  const { user, brandId, brand, canViewBrand, isAdminView } = useMarkaPortal();
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);
  const [staff, setStaff] = useState<BrandStaff[]>([]);
  const [records, setRecords] = useState<BrandStaffAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [day, setDay] = useState<Date>(() => new Date());
  const [nowMs, setNowMs] = useState(() => Date.now());

  const dayKey = useMemo(() => ymd(day), [day]);
  const isToday = dayKey === ymd(new Date());

  // Canlı sayaç (molada/mesaide süre güncellensin).
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const [st, recs] = await Promise.all([
        fetchStaff(brandId),
        fetchAttendance(brandId, { from: dayKey, to: dayKey }),
      ]);
      setStaff(st);
      setRecords(recs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [brandId, dayKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const recByStaff = useMemo(() => {
    const map = new Map<string, BrandStaffAttendance>();
    for (const r of records) map.set(r.staffId, r);
    return map;
  }, [records]);

  const activeStaff = useMemo(() => staff.filter((s) => s.status !== "passive"), [staff]);

  const stats = useMemo(() => {
    let working = 0, onBreak = 0, done = 0, totalMin = 0;
    for (const s of activeStaff) {
      const r = recByStaff.get(s.id);
      if (!r) continue;
      if (r.status === "in") working++;
      else if (r.status === "on_break") onBreak++;
      else if (r.status === "out" && r.checkIn) done++;
      totalMin += attendanceWorkedMinutes(r, nowMs);
    }
    return { working, onBreak, done, totalMin, headcount: activeStaff.length };
  }, [activeStaff, recByStaff, nowMs]);

  const act = async (staffId: string, action: AttendanceAction) => {
    if (!brandId || readOnly) return;
    setBusyId(staffId + action);
    try {
      const saved = await attendanceAction({ brandId, staffId, action, workDate: dayKey });
      setRecords((prev) => {
        const others = prev.filter((r) => r.staffId !== staffId);
        return [...others, saved];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem başarısız");
    } finally {
      setBusyId(null);
    }
  };

  const removeRecord = async (r: BrandStaffAttendance) => {
    if (!confirm("Bu mesai kaydı silinsin mi?")) return;
    try {
      await deleteAttendance(r.id);
      setRecords((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Silinemedi");
    }
  };

  const dayTitle = day.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1200px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Clock size={22} /> Mesai & Mola
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {brand?.name} · personel giriş/çıkış ve mola takibi (puantaj)
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        {/* Gün seçici */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDay((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; })} aria-label="Önceki gün">
            <ChevronLeft size={15} />
          </Button>
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
            <CalendarRange size={14} className="text-muted-foreground" />
            <span className="font-medium capitalize">{dayTitle}</span>
            {isToday && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Bugün</Badge>}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDay((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })} aria-label="Sonraki gün" disabled={isToday}>
            <ChevronRight size={15} />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setDay(new Date())}>Bugüne dön</Button>
          )}
        </div>

        {/* KPI'lar */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={<Play size={18} />} tone="green" label="Mesaide" value={String(stats.working)} />
          <Kpi icon={<Coffee size={18} />} tone="amber" label="Molada" value={String(stats.onBreak)} />
          <Kpi icon={<Users size={18} />} tone="zinc" label="Çıkış yaptı" value={String(stats.done)} />
          <Kpi icon={<Timer size={18} />} tone="primary" label="Toplam çalışma" value={fmtMins(stats.totalMin)} sub={`${stats.headcount} aktif personel`} />
        </div>

        {/* Personel listesi — puantaj kartları */}
        {loading && staff.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><Loader2 size={22} className="mx-auto animate-spin opacity-50" /><p className="mt-2 text-sm">Yükleniyor…</p></CardContent></Card>
        ) : activeStaff.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Aktif personel yok. Önce <strong>Personel</strong> sayfasından ekip üyesi ekleyin.</CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeStaff.map((s) => {
              const r = recByStaff.get(s.id);
              const status = r?.status ?? "out";
              const worked = r ? attendanceWorkedMinutes(r, nowMs) : 0;
              return (
                <Card key={s.id} className="transition-colors hover:border-primary/40">
                  <CardContent className="space-y-3 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {s.avatar || s.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-foreground">{s.name}</p>
                        {s.role && <p className="truncate text-xs text-muted-foreground">{s.role}</p>}
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${STATUS_CLS[status]}`}>
                        {ATTENDANCE_STATUS_LABELS[status]}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-md border border-border/60 py-1.5">
                        <p className="text-[10px] text-muted-foreground">Giriş</p>
                        <p className="font-medium tabular-nums">{fmtClock(r?.checkIn)}</p>
                      </div>
                      <div className="rounded-md border border-border/60 py-1.5">
                        <p className="text-[10px] text-muted-foreground">Mola</p>
                        <p className="font-medium tabular-nums">{r ? fmtMins(r.breakMinutes) : "—"}</p>
                      </div>
                      <div className="rounded-md border border-border/60 py-1.5">
                        <p className="text-[10px] text-muted-foreground">Çıkış</p>
                        <p className="font-medium tabular-nums">{fmtClock(r?.checkOut)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                      <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
                        <Timer size={13} className="text-muted-foreground" /> {fmtMins(worked)}
                      </span>
                      {!readOnly && (
                        <div className="flex gap-1">
                          {status === "out" && !r?.checkIn && (
                            <ActBtn icon={<LogIn size={13} />} label="Giriş" tone="green" loading={busyId === s.id + "check_in"} onClick={() => void act(s.id, "check_in")} />
                          )}
                          {status === "in" && (
                            <>
                              <ActBtn icon={<Coffee size={13} />} label="Mola" tone="amber" loading={busyId === s.id + "break_start"} onClick={() => void act(s.id, "break_start")} />
                              <ActBtn icon={<LogOut size={13} />} label="Çıkış" tone="red" loading={busyId === s.id + "check_out"} onClick={() => void act(s.id, "check_out")} />
                            </>
                          )}
                          {status === "on_break" && (
                            <>
                              <ActBtn icon={<Play size={13} />} label="Devam" tone="green" loading={busyId === s.id + "break_end"} onClick={() => void act(s.id, "break_end")} />
                              <ActBtn icon={<LogOut size={13} />} label="Çıkış" tone="red" loading={busyId === s.id + "check_out"} onClick={() => void act(s.id, "check_out")} />
                            </>
                          )}
                          {status === "out" && r?.checkIn && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => void removeRecord(r)} aria-label="Kaydı sil">
                              <Trash2 size={13} />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    {status === "on_break" && (
                      <p className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                        <Pause size={11} /> Molada — {r?.breakStartedAt ? fmtClock(r.breakStartedAt) : ""} itibarıyla
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MarkaPageGuard>
  );
}

function ActBtn({
  icon, label, tone, loading, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "green" | "amber" | "red";
  loading: boolean;
  onClick: () => void;
}) {
  const cls: Record<string, string> = {
    green: "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-500/45 dark:text-green-300 dark:hover:bg-green-950/40",
    amber: "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/45 dark:text-amber-300 dark:hover:bg-amber-950/40",
    red: "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-500/45 dark:text-red-300 dark:hover:bg-red-950/40",
  };
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${cls[tone]}`}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : icon} {label}
    </button>
  );
}

function Kpi({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: "green" | "amber" | "zinc" | "primary";
}) {
  const toneCls: Record<string, string> = {
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    zinc: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneCls[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
