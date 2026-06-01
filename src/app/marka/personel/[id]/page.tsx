"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Mail, Phone, Wallet, Plus, CheckCircle2, Clock, ListTodo,
  CalendarDays, Activity, Trash2, Pencil, Timer, AlertTriangle, User as UserIcon,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, FormActions } from "@/components/ui/field";
import { fmtDateTime, fmtDateOnly } from "@/lib/fmt-date";
import {
  fetchStaffDetail, saveTask, saveShift, deleteTracking, type StaffDetail,
} from "@/lib/brand-personnel-api";
import { fetchDepartments } from "@/lib/brand-payroll-api";
import {
  STAFF_STATUS_LABELS, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, STAFF_CURRENCY_SYMBOL,
  shiftHours, formatHours,
  type BrandDepartment, type BrandStaffShift, type BrandStaffTask,
  type TaskPriority, type TaskStatus,
} from "@/types/brand-personnel";

const TASK_STATUS_CLS: Record<TaskStatus, string> = {
  todo: "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300",
  in_progress: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/45 dark:bg-blue-950/40 dark:text-blue-300",
  done: "border-green-300 bg-green-50 text-green-700 dark:border-green-500/45 dark:bg-green-950/40 dark:text-green-300",
  cancelled: "border-red-300 bg-red-50 text-red-600 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-300",
};
const PRIORITY_CLS: Record<TaskPriority, string> = {
  low: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400",
  medium: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-300",
  high: "border-red-300 bg-red-50 text-red-700 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-300",
};

type Tab = "genel" | "vardiyalar" | "gorevler" | "aktivite";
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "genel", label: "Genel bilgi", icon: <UserIcon size={14} /> },
  { id: "vardiyalar", label: "Vardiyalar", icon: <CalendarDays size={14} /> },
  { id: "gorevler", label: "Görevler", icon: <ListTodo size={14} /> },
  { id: "aktivite", label: "Aktivite", icon: <Activity size={14} /> },
];

const emptyTask = {
  id: "", title: "", description: "", status: "todo" as TaskStatus, priority: "medium" as TaskPriority, dueDate: "",
};
const emptyShift = { id: "", shiftDate: "", startTime: "09:00", endTime: "18:00", note: "" };

const todayYmd = () => new Date().toISOString().slice(0, 10);

const money = (cur: keyof typeof STAFF_CURRENCY_SYMBOL, amt?: number) =>
  amt && amt > 0 ? `${STAFF_CURRENCY_SYMBOL[cur]}${amt.toLocaleString("tr-TR")}` : "—";

export default function MarkaPersonelDetayPage() {
  const id = String(useParams<{ id: string }>().id ?? "");
  const router = useRouter();
  const { user, brandId, brand, canViewBrand, isAdminView } = useMarkaPortal();
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);

  const [detail, setDetail] = useState<StaffDetail | null>(null);
  const [departments, setDepartments] = useState<BrandDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("genel");
  const [taskOpen, setTaskOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [taskForm, setTaskForm] = useState(emptyTask);
  const [shiftForm, setShiftForm] = useState(emptyShift);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const d = await fetchStaffDetail(id);
      setDetail(d);
      if (d.staff.brandId) {
        fetchDepartments(d.staff.brandId)
          .then(setDepartments)
          .catch(() => setDepartments([]));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedShifts = useMemo(
    () => (detail ? [...detail.shifts].sort((a, b) => b.shiftDate.localeCompare(a.shiftDate)) : []),
    [detail]
  );
  const sortedTasks = useMemo(() => {
    const order: TaskStatus[] = ["in_progress", "todo", "done", "cancelled"];
    return detail
      ? [...detail.tasks].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))
      : [];
  }, [detail]);

  const stats = useMemo(() => {
    if (!detail) return { totalHours: 0, monthHours: 0, openTasks: 0, overdue: 0 };
    const ym = todayYmd().slice(0, 7);
    const today = todayYmd();
    let totalHours = 0;
    let monthHours = 0;
    for (const s of detail.shifts) {
      const h = shiftHours(s.startTime, s.endTime);
      totalHours += h;
      if (s.shiftDate.slice(0, 7) === ym) monthHours += h;
    }
    const openTasks = detail.tasks.filter((t) => t.status === "todo" || t.status === "in_progress").length;
    const overdue = detail.tasks.filter(
      (t) => t.status !== "done" && t.status !== "cancelled" && t.dueDate && t.dueDate < today
    ).length;
    return { totalHours, monthHours, openTasks, overdue };
  }, [detail]);

  const openNewTask = () => {
    setTaskForm(emptyTask);
    setTaskOpen(true);
  };
  const openEditTask = (t: BrandStaffTask) => {
    setTaskForm({
      id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority, dueDate: t.dueDate ?? "",
    });
    setTaskOpen(true);
  };
  const openNewShift = () => {
    setShiftForm({ ...emptyShift, shiftDate: todayYmd() });
    setShiftOpen(true);
  };
  const openEditShift = (s: BrandStaffShift) => {
    setShiftForm({ id: s.id, shiftDate: s.shiftDate, startTime: s.startTime, endTime: s.endTime, note: s.note });
    setShiftOpen(true);
  };

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !taskForm.title.trim()) return;
    setBusy(true);
    try {
      await saveTask({
        id: taskForm.id || undefined,
        brandId,
        staffId: id,
        title: taskForm.title.trim(),
        description: taskForm.description,
        status: taskForm.status,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || undefined,
      });
      setTaskOpen(false);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Görev kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const submitShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !shiftForm.shiftDate) return;
    setBusy(true);
    try {
      await saveShift({
        id: shiftForm.id || undefined,
        brandId,
        staffId: id,
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

  const cycleTaskStatus = async (t: BrandStaffTask) => {
    const order: TaskStatus[] = ["todo", "in_progress", "done"];
    const next = order[(order.indexOf(t.status) + 1) % order.length];
    if (!brandId) return;
    try {
      await saveTask({ ...t, brandId, status: next });
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Güncellenemedi");
    }
  };

  const removeTracking = async (kind: "task" | "shift", trackId: string) => {
    const label = kind === "task" ? "Görev" : "Vardiya";
    if (!confirm(`${label} silinsin mi?`)) return;
    try {
      await deleteTracking(kind, trackId);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Silinemedi");
    }
  };

  const shiftFormHours = shiftHours(shiftForm.startTime, shiftForm.endTime);

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1100px] space-y-5 pb-10">
        <button onClick={() => router.push("/marka/personel")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={15} /> Personel listesi
        </button>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        {loading && !detail ? (
          <div className="py-16 text-center text-muted-foreground">
            <Loader2 size={24} className="mx-auto animate-spin opacity-50" />
            <p className="mt-2 text-sm">Yükleniyor…</p>
          </div>
        ) : !detail ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Personel bulunamadı.</CardContent></Card>
        ) : (
          <>
            {/* Profil başlığı */}
            <Card>
              <CardContent className="flex flex-wrap items-start gap-4 py-5">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                  {detail.staff.avatar || detail.staff.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold text-foreground">{detail.staff.name}</h1>
                    <Badge variant="outline" className="text-[10px]">{STAFF_STATUS_LABELS[detail.staff.status]}</Badge>
                  </div>
                  {detail.staff.role && <p className="text-sm text-muted-foreground">{detail.staff.role}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {detail.staff.email && <a href={`mailto:${detail.staff.email}`} className="flex items-center gap-1 hover:text-foreground"><Mail size={12} /> {detail.staff.email}</a>}
                    {detail.staff.phone && <a href={`tel:${detail.staff.phone}`} className="flex items-center gap-1 hover:text-foreground"><Phone size={12} /> {detail.staff.phone}</a>}
                    {detail.staff.monthlyCost > 0 && (
                      <span className="flex items-center gap-1"><Wallet size={12} /> {STAFF_CURRENCY_SYMBOL[detail.staff.currency]}{detail.staff.monthlyCost.toLocaleString("tr-TR")}/ay</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Hızlı istatistikler */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat icon={<CalendarDays size={16} />} label="Toplam vardiya" value={String(detail.shifts.length)} />
              <MiniStat icon={<Timer size={16} />} label="Bu ay saat" value={formatHours(stats.monthHours)} />
              <MiniStat icon={<ListTodo size={16} />} label="Açık görev" value={String(stats.openTasks)} />
              <MiniStat icon={<AlertTriangle size={16} />} label="Geciken görev" value={String(stats.overdue)} tone={stats.overdue > 0 ? "warn" : undefined} />
            </div>

            {/* Sekmeler */}
            <div className="flex flex-wrap gap-1 border-b border-border">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    tab === t.id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Genel bilgi */}
            {tab === "genel" && (
              <Card>
                <CardHeader className="border-b border-border/60 pb-4">
                  <CardTitle>Genel bilgi</CardTitle>
                  <CardDescription>Personel künyesi ve notlar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 text-sm">
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <InfoRow label="Rol / unvan" value={detail.staff.role || "—"} />
                    <InfoRow label="Durum" value={STAFF_STATUS_LABELS[detail.staff.status]} />
                    <InfoRow
                      label="Departman"
                      value={
                        detail.staff.departmentId
                          ? departments.find((d) => d.id === detail.staff.departmentId)?.name ?? "Atanmadı"
                          : "Atanmadı"
                      }
                    />
                    <InfoRow label="E-posta" value={detail.staff.email || "—"} />
                    <InfoRow label="Telefon" value={detail.staff.phone || "—"} />
                    <InfoRow
                      label="Aylık maliyet"
                      value={detail.staff.monthlyCost > 0 ? `${STAFF_CURRENCY_SYMBOL[detail.staff.currency]}${detail.staff.monthlyCost.toLocaleString("tr-TR")}` : "—"}
                    />
                    <InfoRow
                      label="Baz maaş"
                      value={money(detail.staff.currency, detail.staff.baseSalary)}
                    />
                    <InfoRow
                      label="Kira desteği"
                      value={money(detail.staff.currency, detail.staff.rentSupport)}
                    />
                    <InfoRow
                      label="Yemek yardımı"
                      value={money(detail.staff.currency, detail.staff.mealAllowance)}
                    />
                    <InfoRow label="Toplam vardiya saati" value={formatHours(stats.totalHours)} />
                  </dl>
                  <div>
                    <p className="mb-1 text-[12px] font-medium text-muted-foreground">Notlar</p>
                    <p className="whitespace-pre-wrap text-sm text-foreground/90">{detail.staff.notes || "Not eklenmemiş."}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Vardiyalar */}
            {tab === "vardiyalar" && (
              <Card>
                <CardHeader className="flex-row items-center justify-between border-b border-border/60 pb-4">
                  <div>
                    <CardTitle className="flex items-center gap-2"><CalendarDays size={16} /> Vardiyalar</CardTitle>
                    <CardDescription>{detail.shifts.length} kayıt · toplam {formatHours(stats.totalHours)}</CardDescription>
                  </div>
                  {!readOnly && (
                    <Button size="sm" className="gap-1.5" onClick={openNewShift}><Plus size={14} /> Vardiya</Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 pt-4">
                  {sortedShifts.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Vardiya kaydı yok.</p>
                  ) : (
                    sortedShifts.map((s) => {
                      const h = shiftHours(s.startTime, s.endTime);
                      const overnight = s.endTime <= s.startTime;
                      return (
                        <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-medium tabular-nums">{fmtDateOnly(s.shiftDate)}</span>
                            <span className="text-muted-foreground tabular-nums">{s.startTime}–{s.endTime}{overnight && " (+1g)"}</span>
                            <Badge variant="outline" className="text-[10px] tabular-nums">{formatHours(h)}</Badge>
                            {s.note && <span className="truncate text-xs text-muted-foreground">· {s.note}</span>}
                          </div>
                          {!readOnly && (
                            <div className="flex shrink-0 gap-0.5">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditShift(s)} aria-label="Düzenle"><Pencil size={13} /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void removeTracking("shift", s.id)} aria-label="Sil"><Trash2 size={13} /></Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            )}

            {/* Görevler */}
            {tab === "gorevler" && (
              <Card>
                <CardHeader className="flex-row items-center justify-between border-b border-border/60 pb-4">
                  <div>
                    <CardTitle className="flex items-center gap-2"><ListTodo size={16} /> Görevler</CardTitle>
                    <CardDescription>{detail.tasks.length} görev · {stats.openTasks} açık</CardDescription>
                  </div>
                  {!readOnly && (
                    <Button size="sm" className="gap-1.5" onClick={openNewTask}><Plus size={14} /> Görev</Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 pt-4">
                  {sortedTasks.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Görev yok.</p>
                  ) : (
                    sortedTasks.map((t) => {
                      const overdue = t.status !== "done" && t.status !== "cancelled" && !!t.dueDate && t.dueDate < todayYmd();
                      return (
                        <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {readOnly ? (
                                <span className="shrink-0">
                                  {t.status === "done" ? <CheckCircle2 size={16} className="text-green-600" /> : <Clock size={16} className="text-muted-foreground" />}
                                </span>
                              ) : (
                                <button onClick={() => void cycleTaskStatus(t)} className="shrink-0" aria-label="Durumu değiştir">
                                  {t.status === "done" ? <CheckCircle2 size={16} className="text-green-600" /> : <Clock size={16} className="text-muted-foreground" />}
                                </button>
                              )}
                              <span className={`font-medium ${t.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.title}</span>
                              <Badge variant="outline" className={`text-[10px] ${TASK_STATUS_CLS[t.status]}`}>{TASK_STATUS_LABELS[t.status]}</Badge>
                              <Badge variant="outline" className={`text-[10px] ${PRIORITY_CLS[t.priority]}`}>{TASK_PRIORITY_LABELS[t.priority]}</Badge>
                            </div>
                            {t.description && <p className="mt-1 pl-6 text-xs text-muted-foreground">{t.description}</p>}
                            {t.dueDate && (
                              <p className={`mt-0.5 pl-6 text-[11px] ${overdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                                Son tarih: {fmtDateOnly(t.dueDate)}{overdue && " · gecikti"}
                              </p>
                            )}
                          </div>
                          {!readOnly && (
                            <div className="flex shrink-0 gap-0.5">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditTask(t)} aria-label="Düzenle"><Pencil size={13} /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void removeTracking("task", t.id)} aria-label="Sil"><Trash2 size={13} /></Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            )}

            {/* Aktivite */}
            {tab === "aktivite" && (
              <Card>
                <CardHeader className="border-b border-border/60 pb-4">
                  <CardTitle className="flex items-center gap-2"><Activity size={16} /> Aktivite günlüğü</CardTitle>
                  <CardDescription>Bu personele ait kayıtlar</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {detail.activity.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Henüz aktivite yok.</p>
                  ) : (
                    <ol className="space-y-3">
                      {detail.activity.map((a) => (
                        <li key={a.id} className="flex gap-3 text-sm">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                          <div>
                            <p className="text-foreground">{a.detail}</p>
                            <p className="text-[11px] text-muted-foreground">{a.actorName} · {fmtDateTime(a.createdAt)}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <Modal open={taskOpen} onClose={() => setTaskOpen(false)} title={taskForm.id ? "Görevi düzenle" : "Yeni görev"} size="md">
        <form onSubmit={submitTask} className="space-y-4">
          <Field label="Başlık" required>
            <Input value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} required autoFocus />
          </Field>
          <Field label="Açıklama">
            <Textarea value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Durum">
              <Select value={taskForm.status} onChange={(e) => setTaskForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
                options={[{ value: "todo", label: "Yapılacak" }, { value: "in_progress", label: "Devam ediyor" }, { value: "done", label: "Tamamlandı" }, { value: "cancelled", label: "İptal" }]} />
            </Field>
            <Field label="Öncelik">
              <Select value={taskForm.priority} onChange={(e) => setTaskForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
                options={[{ value: "low", label: "Düşük" }, { value: "medium", label: "Orta" }, { value: "high", label: "Yüksek" }]} />
            </Field>
            <Field label="Son tarih">
              <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </Field>
          </div>
          <FormActions onCancel={() => setTaskOpen(false)} submitLabel={busy ? "Kaydediliyor..." : taskForm.id ? "Güncelle" : "Görev ekle"} />
        </form>
      </Modal>

      <Modal open={shiftOpen} onClose={() => setShiftOpen(false)} title={shiftForm.id ? "Vardiyayı düzenle" : "Yeni vardiya"} size="md">
        <form onSubmit={submitShift} className="space-y-4">
          <Field label="Tarih" required>
            <Input type="date" value={shiftForm.shiftDate} onChange={(e) => setShiftForm((f) => ({ ...f, shiftDate: e.target.value }))} required autoFocus />
          </Field>
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
          <Field label="Not">
            <Input value={shiftForm.note} onChange={(e) => setShiftForm((f) => ({ ...f, note: e.target.value }))} placeholder="Ör. uzaktan, İZİN: yıllık" />
          </Field>
          <FormActions onCancel={() => setShiftOpen(false)} submitLabel={busy ? "Kaydediliyor..." : shiftForm.id ? "Güncelle" : "Vardiya ekle"} />
        </form>
      </Modal>
    </MarkaPageGuard>
  );
}

function MiniStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "warn" }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3.5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone === "warn" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary"}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="text-lg font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
