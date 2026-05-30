"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Mail, Phone, Wallet, Plus, CheckCircle2, Clock, ListTodo,
  CalendarDays, Activity, Trash2,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, FormActions } from "@/components/ui/field";
import { fmtDateTime } from "@/lib/fmt-date";
import {
  fetchStaffDetail, saveTask, saveShift, deleteTracking, type StaffDetail,
} from "@/lib/brand-personnel-api";
import {
  STAFF_STATUS_LABELS, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS,
  type TaskPriority, type TaskStatus,
} from "@/types/brand-personnel";

const CUR_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", TRY: "₺" };
const TASK_STATUS_CLS: Record<TaskStatus, string> = {
  todo: "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300",
  in_progress: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/45 dark:bg-blue-950/40 dark:text-blue-300",
  done: "border-green-300 bg-green-50 text-green-700 dark:border-green-500/45 dark:bg-green-950/40 dark:text-green-300",
  cancelled: "border-red-300 bg-red-50 text-red-600 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-300",
};

export default function MarkaPersonelDetayPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? "");
  const { user, brandId, brand, canViewBrand, isAdminView } = useMarkaPortal();
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);

  const [detail, setDetail] = useState<StaffDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [taskForm, setTaskForm] = useState({
    title: "", description: "", status: "todo" as TaskStatus, priority: "medium" as TaskPriority, dueDate: "",
  });
  const [shiftForm, setShiftForm] = useState({ shiftDate: "", startTime: "09:00", endTime: "18:00", note: "" });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchStaffDetail(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !taskForm.title.trim()) return;
    setBusy(true);
    try {
      await saveTask({
        brandId,
        staffId: id,
        title: taskForm.title.trim(),
        description: taskForm.description,
        status: taskForm.status,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || undefined,
      });
      setTaskOpen(false);
      setTaskForm({ title: "", description: "", status: "todo", priority: "medium", dueDate: "" });
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
      await saveShift({ brandId, staffId: id, ...shiftForm });
      setShiftOpen(false);
      setShiftForm({ shiftDate: "", startTime: "09:00", endTime: "18:00", note: "" });
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Vardiya kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const cycleTaskStatus = async (taskId: string, current: TaskStatus) => {
    const order: TaskStatus[] = ["todo", "in_progress", "done"];
    const next = order[(order.indexOf(current) + 1) % order.length];
    const t = detail?.tasks.find((x) => x.id === taskId);
    if (!t || !brandId) return;
    try {
      await saveTask({ ...t, brandId, status: next });
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Güncellenemedi");
    }
  };

  const removeTracking = async (kind: "task" | "shift", trackId: string) => {
    try {
      await deleteTracking(kind, trackId);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Silinemedi");
    }
  };

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
            <Card>
              <CardContent className="flex flex-wrap items-start gap-4 py-5">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                  {detail.staff.avatar || detail.staff.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold text-foreground">{detail.staff.name}</h1>
                    <Badge variant="outline" className="text-[10px]">{STAFF_STATUS_LABELS[detail.staff.status]}</Badge>
                  </div>
                  {detail.staff.role && <p className="text-sm text-muted-foreground">{detail.staff.role}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {detail.staff.email && <span className="flex items-center gap-1"><Mail size={12} /> {detail.staff.email}</span>}
                    {detail.staff.phone && <span className="flex items-center gap-1"><Phone size={12} /> {detail.staff.phone}</span>}
                    {detail.staff.monthlyCost > 0 && (
                      <span className="flex items-center gap-1"><Wallet size={12} /> {CUR_SYMBOL[detail.staff.currency]}{detail.staff.monthlyCost.toLocaleString("tr-TR")}/ay</span>
                    )}
                  </div>
                  {detail.staff.notes && <p className="mt-2 text-sm text-foreground/80">{detail.staff.notes}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Görevler */}
            <Card>
              <CardHeader className="flex-row items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2"><ListTodo size={16} /> Görevler</CardTitle>
                  <CardDescription>{detail.tasks.length} görev</CardDescription>
                </div>
                {!readOnly && (
                  <Button size="sm" className="gap-1.5" onClick={() => setTaskOpen(true)}><Plus size={14} /> Görev</Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {detail.tasks.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Görev yok.</p>
                ) : (
                  detail.tasks.map((t) => (
                    <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {readOnly ? (
                            <span className="shrink-0">
                              {t.status === "done" ? <CheckCircle2 size={16} className="text-green-600" /> : <Clock size={16} className="text-muted-foreground" />}
                            </span>
                          ) : (
                            <button onClick={() => void cycleTaskStatus(t.id, t.status)} className="shrink-0" aria-label="Durumu değiştir">
                              {t.status === "done" ? <CheckCircle2 size={16} className="text-green-600" /> : <Clock size={16} className="text-muted-foreground" />}
                            </button>
                          )}
                          <span className={`font-medium ${t.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.title}</span>
                          <Badge variant="outline" className={`text-[10px] ${TASK_STATUS_CLS[t.status]}`}>{TASK_STATUS_LABELS[t.status]}</Badge>
                          <Badge variant="outline" className="text-[10px]">{TASK_PRIORITY_LABELS[t.priority]}</Badge>
                        </div>
                        {t.description && <p className="mt-1 pl-6 text-xs text-muted-foreground">{t.description}</p>}
                        {t.dueDate && <p className="mt-0.5 pl-6 text-[11px] text-muted-foreground">Son tarih: {t.dueDate}</p>}
                      </div>
                      {!readOnly && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void removeTracking("task", t.id)} aria-label="Sil">
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Vardiyalar */}
            <Card>
              <CardHeader className="flex-row items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2"><CalendarDays size={16} /> Vardiyalar</CardTitle>
                  <CardDescription>{detail.shifts.length} kayıt</CardDescription>
                </div>
                {!readOnly && (
                  <Button size="sm" className="gap-1.5" onClick={() => setShiftOpen(true)}><Plus size={14} /> Vardiya</Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {detail.shifts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Vardiya yok.</p>
                ) : (
                  detail.shifts.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-medium tabular-nums">{s.shiftDate}</span>
                        <span className="text-muted-foreground tabular-nums">{s.startTime}–{s.endTime}</span>
                        {s.note && <span className="text-xs text-muted-foreground">· {s.note}</span>}
                      </div>
                      {!readOnly && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void removeTracking("shift", s.id)} aria-label="Sil">
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Aktivite */}
            <Card>
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle className="flex items-center gap-2"><Activity size={16} /> Aktivite geçmişi</CardTitle>
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
          </>
        )}
      </div>

      <Modal open={taskOpen} onClose={() => setTaskOpen(false)} title="Yeni görev" size="md">
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
          <FormActions onCancel={() => setTaskOpen(false)} submitLabel={busy ? "Kaydediliyor..." : "Görev ekle"} />
        </form>
      </Modal>

      <Modal open={shiftOpen} onClose={() => setShiftOpen(false)} title="Yeni vardiya" size="md">
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
          <Field label="Not">
            <Input value={shiftForm.note} onChange={(e) => setShiftForm((f) => ({ ...f, note: e.target.value }))} />
          </Field>
          <FormActions onCancel={() => setShiftOpen(false)} submitLabel={busy ? "Kaydediliyor..." : "Vardiya ekle"} />
        </form>
      </Modal>
    </MarkaPageGuard>
  );
}
