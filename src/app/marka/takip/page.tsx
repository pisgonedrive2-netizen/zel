"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList, Plus, Loader2, RefreshCcw, CalendarDays, Trash2, CheckCircle2, Clock,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, FormActions } from "@/components/ui/field";
import {
  fetchStaff, fetchTracking, saveTask, deleteTracking,
} from "@/lib/brand-personnel-api";
import {
  TASK_PRIORITY_LABELS, TASK_STATUS_LABELS,
  type BrandStaff, type BrandStaffShift, type BrandStaffTask,
  type TaskPriority, type TaskStatus,
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

export default function MarkaTakipPage() {
  const { user, brandId, brand, canViewBrand, isAdminView } = useMarkaPortal();
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);
  const [tasks, setTasks] = useState<BrandStaffTask[]>([]);
  const [shifts, setShifts] = useState<BrandStaffShift[]>([]);
  const [staff, setStaff] = useState<BrandStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", staffId: "", status: "todo" as TaskStatus, priority: "medium" as TaskPriority, dueDate: "",
  });

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

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, BrandStaffTask[]> = { todo: [], in_progress: [], done: [], cancelled: [] };
    for (const t of tasks) map[t.status]?.push(t);
    return map;
  }, [tasks]);

  const upcomingShifts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return shifts.filter((s) => s.shiftDate >= today).slice(0, 12);
  }, [shifts]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !form.title.trim()) return;
    setBusy(true);
    try {
      await saveTask({
        brandId,
        title: form.title.trim(),
        description: form.description,
        staffId: form.staffId || undefined,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
      });
      setOpen(false);
      setForm({ title: "", description: "", staffId: "", status: "todo", priority: "medium", dueDate: "" });
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const advance = async (t: BrandStaffTask) => {
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

  const remove = async (t: BrandStaffTask) => {
    try {
      await deleteTracking("task", t.id);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Silinemedi");
    }
  };

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1200px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <ClipboardList size={22} /> Görev & Takip
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{brand?.name} ekip görevleri ve vardiya takvimi</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
            </Button>
            {!readOnly && (
              <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}><Plus size={14} /> Görev ekle</Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.id} className={`rounded-xl border border-t-4 ${col.accent} border-border bg-card`}>
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">{col.label}</h2>
                <Badge variant="outline" className="text-[10px] tabular-nums">{byStatus[col.id].length}</Badge>
              </div>
              <div className="space-y-2 p-3">
                {byStatus[col.id].length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Görev yok</p>
                ) : (
                  byStatus[col.id].map((t) => (
                    <div key={t.id} className="rounded-lg border border-border bg-background px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        {readOnly ? (
                          <span className="mt-0.5 shrink-0">
                            {t.status === "done" ? <CheckCircle2 size={15} className="text-green-600" /> : <Clock size={15} className="text-muted-foreground" />}
                          </span>
                        ) : (
                          <button onClick={() => void advance(t)} className="mt-0.5 shrink-0" aria-label="İlerlet">
                            {t.status === "done" ? <CheckCircle2 size={15} className="text-green-600" /> : <Clock size={15} className="text-muted-foreground" />}
                          </button>
                        )}
                        <span className={`flex-1 text-sm font-medium ${t.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.title}</span>
                        {!readOnly && (
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void remove(t)} aria-label="Sil">
                            <Trash2 size={12} />
                          </Button>
                        )}
                      </div>
                      {t.description && <p className="mt-1 pl-6 text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                        <Badge variant="outline" className={`text-[10px] ${PRIORITY_CLS[t.priority]}`}>{TASK_PRIORITY_LABELS[t.priority]}</Badge>
                        <span className="text-[10px] text-muted-foreground">{staffName(t.staffId)}</span>
                        {t.dueDate && <span className="text-[10px] text-muted-foreground tabular-nums">· {t.dueDate}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        <Card>
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="flex items-center gap-2"><CalendarDays size={16} /> Yaklaşan vardiyalar</CardTitle>
            <CardDescription>Bugünden itibaren planlanmış vardiyalar</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {upcomingShifts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Yaklaşan vardiya yok. Personel detayından vardiya ekleyebilirsiniz.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingShifts.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border px-3 py-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{staffName(s.staffId)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{s.shiftDate}</span>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">{s.startTime}–{s.endTime}{s.note ? ` · ${s.note}` : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {!loading && tasks.length === 0 && shifts.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Henüz görev/vardiya yok. Önce <strong>Personel</strong> sayfasından ekip üyesi ekleyin, sonra görev atayın.
          </p>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Yeni görev" size="md">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Başlık" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required autoFocus />
          </Field>
          <Field label="Açıklama">
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Atanan personel">
              <Select value={form.staffId} onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
                options={[{ value: "", label: "Atanmamış" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} />
            </Field>
            <Field label="Son tarih">
              <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </Field>
            <Field label="Durum">
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
                options={COLUMNS.map((c) => ({ value: c.id, label: TASK_STATUS_LABELS[c.id] })).concat([{ value: "cancelled", label: "İptal" }])} />
            </Field>
            <Field label="Öncelik">
              <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
                options={[{ value: "low", label: "Düşük" }, { value: "medium", label: "Orta" }, { value: "high", label: "Yüksek" }]} />
            </Field>
          </div>
          <FormActions onCancel={() => setOpen(false)} submitLabel={busy ? "Kaydediliyor..." : "Görev ekle"} />
        </form>
      </Modal>
    </MarkaPageGuard>
  );
}
