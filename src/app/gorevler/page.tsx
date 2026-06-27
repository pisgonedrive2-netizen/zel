"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList, Plus, Trash2, UserPlus, CalendarClock,
  ChevronLeft, ChevronRight, X, CalendarDays, Eraser,
} from "lucide-react";
import { useAuth, landingFor } from "@/store/auth";
import { useStore } from "@/store/store";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  TASK_STATUSES, TASK_PRIORITIES,
  type InternalTask, type TaskStatus, type TaskPriority,
} from "@/types/internal-task";
import { cn } from "@/lib/utils";
import { DailyPlanPanel } from "@/components/tasks/daily-plan-panel";

type TaskView = "all" | "today" | "overdue";

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  urgent: "bg-red-500/15 text-red-600 dark:text-red-300",
};

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "review", "done", "blocked"];

function statusLabel(s: TaskStatus) {
  return TASK_STATUSES.find((x) => x.value === s)?.label ?? s;
}
function priorityLabel(p: TaskPriority) {
  return TASK_PRIORITIES.find((x) => x.value === p)?.label ?? p;
}

export default function GorevlerPage() {
  const { user } = useAuth();
  const router = useRouter();
  const employees = useStore((s) => s.employees);
  const allowed = user ? user.role === "admin" || user.role === "auditor" : false;
  const canEdit = user?.role === "admin";

  const [tasks, setTasks] = useState<InternalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const [showDaily, setShowDaily] = useState(false);
  const [taskView, setTaskView] = useState<TaskView>("all");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && !allowed) router.replace(landingFor(user.role, user));
  }, [user, allowed, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks?hideExited=1", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setTasks(json.tasks ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status !== "inactive"),
    [employees],
  );

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const visibleTasks = useMemo(() => {
    if (taskView === "today") {
      return tasks.filter((t) => t.dueDate === todayKey && t.status !== "done");
    }
    if (taskView === "overdue") {
      return tasks.filter((t) => isOverdue(t));
    }
    return tasks;
  }, [tasks, taskView, todayKey]);

  const todayCount = useMemo(
    () => tasks.filter((t) => t.dueDate === todayKey && t.status !== "done").length,
    [tasks, todayKey],
  );
  const overdueCount = useMemo(() => tasks.filter((t) => isOverdue(t)).length, [tasks]);

  const patchTask = async (id: string, patch: Record<string, unknown>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patchToTask(patch) } : t)));
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      void load();
      window.alert("Görev güncellenemedi.");
    }
  };

  const deleteTask = async (id: string) => {
    if (!window.confirm("Bu görevi silmek istiyor musun?")) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      void load();
      window.alert("Görev silinemedi.");
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of visibleTasks) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [visibleTasks]);

  const cleanupExited = async () => {
    if (!window.confirm("İşten ayrılan personelin (ör. Lucy) tamamlanmamış onboarding görevleri silinsin mi?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "cleanup-exited" }),
      });
      const json = await res.json();
      if (res.ok) {
        window.alert(`${json.deleted ?? 0} görev temizlendi.`);
        await load();
      } else window.alert(json.error ?? "Temizlenemedi.");
    } finally {
      setBusy(false);
    }
  };

  if (!user || !allowed) {
    return (
      <PageShell>
        <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
      </PageShell>
    );
  }

  return (
    <PageShell size="2xl">
      <PageHeader
        title="Görevler"
        description="Ekip görevleri ve günlük planlar. Yayıncılara otomatik bildirim gider; kendi panellerinde görev panosu yoktur."
        icon={<ClipboardList className="h-5 w-5 text-primary" />}
        actions={
          canEdit ? (
            <>
              <Button size="sm" variant="outline" onClick={() => { setShowDaily((v) => !v); setShowNew(false); setShowOnboard(false); }}>
                <CalendarDays className="mr-1 h-3.5 w-3.5" /> Bugünkü plan
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowOnboard((v) => !v); setShowNew(false); setShowDaily(false); }}>
                <UserPlus className="mr-1 h-3.5 w-3.5" /> Onboarding
              </Button>
              <Button size="sm" onClick={() => { setShowNew((v) => !v); setShowOnboard(false); setShowDaily(false); }}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Yeni görev
              </Button>
            </>
          ) : null
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["all", "today", "overdue"] as TaskView[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setTaskView(v)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              taskView === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {v === "all" ? "Tümü" : v === "today" ? `Bugün (${todayCount})` : `Geciken (${overdueCount})`}
          </button>
        ))}
        {canEdit && (
          <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs text-muted-foreground" onClick={() => void cleanupExited()} disabled={busy}>
            <Eraser className="mr-1 h-3 w-3" /> Ayrılan personel görevlerini temizle
          </Button>
        )}
      </div>

      {showDaily && canEdit && (
        <DailyPlanPanel
          employees={activeEmployees.map((e) => ({ id: e.id, name: e.name }))}
          busy={busy}
          onClose={() => setShowDaily(false)}
          onSubmit={async (payload) => {
            setBusy(true);
            try {
              const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ template: "daily", ...payload }),
              });
              const json = await res.json();
              if (res.ok) {
                setShowDaily(false);
                await load();
                if (payload.notify && json.notified > 0) {
                  window.alert(`${json.created} görev oluşturuldu · ${json.notified} bildirim gönderildi.`);
                }
              } else window.alert(json.error ?? "Plan atanamadı.");
            } finally { setBusy(false); }
          }}
        />
      )}

      {showNew && canEdit && (
        <NewTaskForm
          employees={activeEmployees.map((e) => ({ id: e.id, name: e.name }))}
          busy={busy}
          onClose={() => setShowNew(false)}
          onCreate={async (payload) => {
            setBusy(true);
            try {
              const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (res.ok) { setShowNew(false); await load(); }
              else window.alert("Görev oluşturulamadı.");
            } finally { setBusy(false); }
          }}
        />
      )}

      {showOnboard && canEdit && (
        <OnboardingForm
          employees={activeEmployees.map((e) => ({ id: e.id, name: e.name }))}
          busy={busy}
          onClose={() => setShowOnboard(false)}
          onCreate={async (payload) => {
            setBusy(true);
            try {
              const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ template: "onboarding", ...payload }),
              });
              if (res.ok) { setShowOnboard(false); await load(); }
              else window.alert("Onboarding planı oluşturulamadı.");
            } finally { setBusy(false); }
          }}
        />
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Görevler yükleniyor…</p>
      ) : visibleTasks.length === 0 ? (
        <Card className="mt-2">
          <CardContent className="py-10 text-center">
            <ClipboardList className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Henüz görev yok.{canEdit ? " “Yeni görev” ile başla veya yeni personel için “Onboarding planı” oluştur." : ""}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {STATUS_ORDER.map((status) => {
            const colTasks = visibleTasks
              .filter((t) => t.status === status)
              .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt));
            return (
              <div key={status} className="rounded-xl border bg-muted/30 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {statusLabel(status)}
                  </span>
                  <span className="rounded-full bg-background px-1.5 text-[10px] text-muted-foreground">
                    {counts[status] ?? 0}
                  </span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      canEdit={canEdit}
                      onMove={(dir) => {
                        const idx = STATUS_ORDER.indexOf(t.status);
                        const next = STATUS_ORDER[idx + dir];
                        if (next) void patchTask(t.id, { status: next });
                      }}
                      onPriority={(p) => void patchTask(t.id, { priority: p })}
                      onDelete={() => void deleteTask(t.id)}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <p className="px-1 py-3 text-center text-[11px] text-muted-foreground/60">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

function patchToTask(patch: Record<string, unknown>): Partial<InternalTask> {
  const out: Partial<InternalTask> = {};
  if (typeof patch.status === "string") out.status = patch.status as TaskStatus;
  if (typeof patch.priority === "string") out.priority = patch.priority as TaskPriority;
  if (typeof patch.assigneeName === "string") out.assigneeName = patch.assigneeName;
  return out;
}

function isOverdue(t: InternalTask): boolean {
  if (!t.dueDate || t.status === "done") return false;
  return t.dueDate < new Date().toISOString().slice(0, 10);
}

function TaskCard({
  task, canEdit, onMove, onPriority, onDelete,
}: {
  task: InternalTask;
  canEdit: boolean;
  onMove: (dir: -1 | 1) => void;
  onPriority: (p: TaskPriority) => void;
  onDelete: () => void;
}) {
  const idx = STATUS_ORDER.indexOf(task.status);
  return (
    <div className="rounded-lg border bg-card p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-sm font-medium leading-snug text-foreground">{task.title}</p>
        {canEdit && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Görevi sil"
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{task.description}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", PRIORITY_STYLE[task.priority])}>
          {priorityLabel(task.priority)}
        </span>
        {task.category === "onboarding" && (
          <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-300">
            onboarding
          </span>
        )}
        {task.category === "daily" && (
          <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-300">
            günlük
          </span>
        )}
        {task.assigneeName && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {task.assigneeName}
          </span>
        )}
        {task.dueDate && (
          <span className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px]",
            isOverdue(task) ? "bg-red-500/15 text-red-600 dark:text-red-300" : "bg-muted text-muted-foreground",
          )}>
            <CalendarClock className="h-2.5 w-2.5" /> {task.dueDate}
          </span>
        )}
      </div>
      {canEdit && (
        <div className="mt-2 flex items-center justify-between gap-1.5 border-t pt-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={idx <= 0}
              onClick={() => onMove(-1)}
              aria-label="Önceki duruma al"
              className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={idx >= STATUS_ORDER.length - 1}
              onClick={() => onMove(1)}
              aria-label="Sonraki duruma al"
              className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <select
            value={task.priority}
            onChange={(e) => onPriority(e.target.value as TaskPriority)}
            aria-label="Öncelik"
            className="rounded-md border border-border bg-background px-1.5 py-1 text-[11px] text-foreground"
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function NewTaskForm({
  employees, busy, onClose, onCreate,
}: {
  employees: { id: string; name: string }[];
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueDate, setDueDate] = useState("");

  const submit = () => {
    if (!title.trim()) { window.alert("Başlık gerekli."); return; }
    const emp = employees.find((e) => e.id === assigneeId);
    onCreate({
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate || null,
      assigneeEmployeeId: assigneeId || null,
      assigneeName: emp?.name ?? "",
    });
  };

  return (
    <Card className="mb-3">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Yeni görev</h3>
          <button type="button" onClick={onClose} aria-label="Kapat" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <Field label="Başlık" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ör. Eylül içerik takvimini hazırla" />
        </Field>
        <Field label="Açıklama">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Detay (opsiyonel)" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Atanan kişi">
            <Select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              options={[{ value: "", label: "— Atanmadı" }, ...employees.map((e) => ({ value: e.id, label: e.name }))]}
            />
          </Field>
          <Field label="Öncelik">
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              options={TASK_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
            />
          </Field>
          <Field label="Son tarih">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>İptal</Button>
          <Button size="sm" disabled={busy} onClick={submit}>{busy ? "Kaydediliyor…" : "Görev oluştur"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OnboardingForm({
  employees, busy, onClose, onCreate,
}: {
  employees: { id: string; name: string }[];
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: Record<string, unknown>) => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const submit = () => {
    const fromEmp = employees.find((e) => e.id === subjectId)?.name ?? "";
    const name = (subjectName.trim() || fromEmp).trim();
    if (!name) { window.alert("Yeni personelin adını gir veya listeden seç."); return; }
    const assignee = employees.find((e) => e.id === assigneeId);
    onCreate({
      subjectEmployeeId: subjectId || null,
      subjectName: name,
      startDate,
      assigneeEmployeeId: assigneeId || null,
      assigneeName: assignee?.name ?? "",
    });
  };

  return (
    <Card className="mb-3 border-violet-400/40">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Yeni personel onboarding planı</h3>
          <button type="button" onClick={onClose} aria-label="Kapat" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Sadece aktif personel listelenir. İşten ayrılanlar (ör. Lucy, 18 Haz 2026) için plan oluşturulamaz.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Personel (kayıtlı)">
            <Select
              value={subjectId}
              onChange={(e) => { setSubjectId(e.target.value); }}
              options={[{ value: "", label: "— Listeden seç (opsiyonel)" }, ...employees.map((e) => ({ value: e.id, label: e.name }))]}
            />
          </Field>
          <Field label="Ya da yeni isim">
            <Input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Yeni personelin adı" />
          </Field>
          <Field label="İşe giriş tarihi">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Sorumlu (atanan)">
            <Select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              options={[{ value: "", label: "— Atanmadı" }, ...employees.map((e) => ({ value: e.id, label: e.name }))]}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>İptal</Button>
          <Button size="sm" disabled={busy} onClick={submit}>{busy ? "Oluşturuluyor…" : "Planı oluştur"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
