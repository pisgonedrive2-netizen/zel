"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useStore, type WeeklyPlan, type Employee, WEEKDAYS_LONG } from "@/store/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";

export const PLAN_ACTIVITIES = [
  "Yayın",
  "Vlog Çekimi",
  "Yetişkin İçerik",
  "Site Videoları",
  "Edit / Post-Prod",
  "Reklam Çekimi",
  "Toplantı",
  "İzin",
] as const;

const STATUS_COLORS: Record<WeeklyPlan["status"], string> = {
  planned: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/50 dark:border-blue-500/40 dark:text-blue-100",
  in_progress: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/45 dark:border-amber-500/40 dark:text-amber-100",
  completed: "bg-green-50 border-green-200 text-green-900 dark:bg-green-950/45 dark:border-green-500/40 dark:text-green-100",
  cancelled: "bg-muted border-border text-muted-foreground line-through",
};

export function formatDateLong(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function weekRangeLabel(weekStartIso: string) {
  const a = new Date(weekStartIso + "T00:00:00");
  const b = new Date(weekStartIso + "T00:00:00");
  b.setDate(b.getDate() + 6);
  return `${a.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} – ${b.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}`;
}

/** Pazartesi ISO (YYYY-MM-DD) */
export function weekStartOfIso(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function WeeklyPlanForm({
  employeeId,
  userId,
  weekStart,
  initial,
  employees,
  onSave,
  onDelete,
  onClose,
}: {
  employeeId: string;
  userId: string;
  weekStart: string;
  initial?: WeeklyPlan;
  employees?: Employee[];
  onSave: (d: Omit<WeeklyPlan, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { brands } = useStore();
  const [form, setForm] = useState<Omit<WeeklyPlan, "id">>({
    employeeId,
    weekStart,
    date: initial?.date ?? weekStart,
    startTime: initial?.startTime ?? "",
    endTime: initial?.endTime ?? "",
    activity: initial?.activity ?? "Yayın",
    brandName: initial?.brandName ?? "",
    notes: initial?.notes ?? "",
    status: initial?.status ?? "planned",
    createdBy: initial?.createdBy ?? userId,
    createdAt: initial?.createdAt ?? new Date().toISOString(),
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const weekDays = useMemo(() => {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart + "T00:00:00");
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, [weekStart]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...form, weekStart: weekStartOfIso(form.date) });
        onClose();
      }}
    >
      <PlanFormStack>
        {employees && employees.length > 0 && (
          <Field label="Yayıncı" required>
            <Select
              value={form.employeeId}
              onChange={(e) => set("employeeId", e.target.value)}
              required
              options={employees.map((em) => ({ value: em.id, label: em.name }))}
            />
          </Field>
        )}
        <FormGrid>
          <Field label="Tarih" required>
            <Select
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              required
              options={weekDays.map((d) => ({ value: d, label: formatDateLong(d) }))}
            />
          </Field>
          <Field label="Aktivite" required>
            <Select
              value={form.activity}
              onChange={(e) => set("activity", e.target.value)}
              required
              options={PLAN_ACTIVITIES.map((a) => ({ value: a, label: a }))}
            />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Başlangıç">
            <Input type="time" value={form.startTime ?? ""} onChange={(e) => set("startTime", e.target.value)} />
          </Field>
          <Field label="Bitiş">
            <Input type="time" value={form.endTime ?? ""} onChange={(e) => set("endTime", e.target.value)} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Marka / Konu">
            <Input
              value={form.brandName ?? ""}
              onChange={(e) => set("brandName", e.target.value)}
              placeholder="Gala / Padi vs."
              list="brand-dl-plan"
            />
            <datalist id="brand-dl-plan">
              {brands.map((b) => (
                <option key={b.id} value={b.shortName} />
              ))}
            </datalist>
          </Field>
          <Field label="Durum">
            <Select
              value={form.status}
              onChange={(e) => set("status", e.target.value as WeeklyPlan["status"])}
              options={[
                { value: "planned", label: "Planlandı" },
                { value: "in_progress", label: "Devam Ediyor" },
                { value: "completed", label: "Tamamlandı" },
                { value: "cancelled", label: "İptal" },
              ]}
            />
          </Field>
        </FormGrid>
        <Field label="Not">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Detay..." />
        </Field>
      </PlanFormStack>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Plan Ekle"} />
    </form>
  );
}

function PlanFormStack({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4">{children}</div>;
}

export function WeeklyPlanGrid({
  weekStart,
  label,
  plans,
  onAdd,
  onEdit,
}: {
  weekStart: string;
  label: string;
  plans: WeeklyPlan[];
  onAdd: () => void;
  onEdit: (p: WeeklyPlan) => void;
}) {
  const days = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart + "T00:00:00");
      d.setDate(d.getDate() + i);
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }, [weekStart]);

  const dayCell = (iso: string, i: number, compact?: boolean) => {
    const dayPlans = plans
      .filter((p) => p.date === iso)
      .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    const isToday = iso === new Date().toISOString().slice(0, 10);
    return (
      <div
        key={iso}
        className={`border rounded-lg p-2 min-h-[128px] ${
          compact ? "min-w-[9.5rem] max-w-[11rem] w-[9.5rem] flex-none snap-start shrink-0" : "min-w-0 w-full"
        } ${isToday ? "border-blue-300 bg-blue-50/30 dark:border-blue-500/50 dark:bg-blue-950/35" : "border-border"}`}
      >
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          {WEEKDAYS_LONG[i].slice(0, 3)} <span className="text-foreground/60">{iso.slice(8, 10)}</span>
        </p>
        {dayPlans.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/40 italic">—</p>
        ) : (
          <div className="space-y-1">
            {dayPlans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onEdit(p)}
                className={`block w-full text-left px-1.5 py-1 rounded border text-[10px] ${STATUS_COLORS[p.status]}`}
              >
                {(p.startTime || p.endTime) && (
                  <p className="font-mono text-[9px]">
                    {p.startTime}
                    {p.endTime && `–${p.endTime}`}
                  </p>
                )}
                <p className="font-medium leading-tight">{p.activity}</p>
                {p.brandName && <p className="text-[9px] opacity-70 truncate">{p.brandName}</p>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full min-w-0 overflow-hidden">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">{label}</CardTitle>
          <CardDescription className="mt-1">
            {formatDateLong(days[0])} – {formatDateLong(days[6])}
          </CardDescription>
        </div>
        <Button size="sm" onClick={onAdd} className="gap-1.5 shrink-0" type="button">
          <Plus size={14} /> Plan Ekle
        </Button>
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
  );
}
