"use client";

import { useMemo, useState } from "react";
import { Bell, CalendarClock, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { TASK_PRIORITIES, type TaskPriority } from "@/types/internal-task";

type EmployeeOpt = { id: string; name: string };

export function DailyPlanPanel({
  employees,
  busy,
  onClose,
  onSubmit,
}: {
  employees: EmployeeOpt[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    dueDate: string;
    notify: boolean;
    items: { title: string; description: string; assigneeEmployeeId: string | null; assigneeName: string; priority: TaskPriority }[];
  }) => void;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dueDate, setDueDate] = useState(today);
  const [notify, setNotify] = useState(true);
  const [lines, setLines] = useState("");
  const [defaultAssigneeId, setDefaultAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");

  const parseLines = () => {
    const defaultEmp = employees.find((e) => e.id === defaultAssigneeId);
    return lines
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((raw) => {
        // "Ramiz: Yayın planını güncelle" veya düz metin
        const colon = raw.indexOf(":");
        let assigneeEmployeeId = defaultAssigneeId || null;
        let assigneeName = defaultEmp?.name ?? "";
        let title = raw;
        if (colon > 0 && colon < 24) {
          const maybeName = raw.slice(0, colon).trim();
          const emp = employees.find(
            (e) => e.name.toLowerCase() === maybeName.toLowerCase() || e.name.split(" ")[0].toLowerCase() === maybeName.toLowerCase(),
          );
          if (emp) {
            assigneeEmployeeId = emp.id;
            assigneeName = emp.name;
            title = raw.slice(colon + 1).trim();
          }
        }
        return {
          title,
          description: "",
          assigneeEmployeeId,
          assigneeName,
          priority,
        };
      });
  };

  const submit = () => {
    const items = parseLines();
    if (items.length === 0) {
      window.alert("En az bir görev satırı gir (her satır bir görev).");
      return;
    }
    onSubmit({ dueDate, notify, items });
  };

  return (
    <Card className="mb-3 border-primary/30">
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Bugünkü plan — toplu atama</h3>
            <p className="text-[11px] text-muted-foreground">
              Her satır bir görev. İsteğe bağlı <code className="text-[10px]">İsim: görev</code> formatı veya varsayılan kişi.
              Yayıncılara bildirim gider; panelde görev panosu yok.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Tarih">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Varsayılan kişi">
            <Select
              value={defaultAssigneeId}
              onChange={(e) => setDefaultAssigneeId(e.target.value)}
              options={[{ value: "", label: "— Satırdan veya boş" }, ...employees.map((e) => ({ value: e.id, label: e.name }))]}
            />
          </Field>
          <Field label="Öncelik">
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              options={TASK_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
            />
          </Field>
        </div>
        <Field label="Görevler (her satır bir madde)" hint="Ör: Ramiz: Kick yayını 20:00 · Açelya: Reels çekimi">
          <Textarea
            value={lines}
            onChange={(e) => setLines(e.target.value)}
            rows={6}
            placeholder={"Ramiz: Haftalık planı güncelle\nAçelya: Marka linklerini kontrol et\nOrkun: Kasa mutabakatı"}
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="rounded border-border" />
          <Bell className="h-3.5 w-3.5" /> Atanan yayıncılara bildirim gönder
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>İptal</Button>
          <Button size="sm" disabled={busy} onClick={submit}>
            {busy ? "Atanıyor…" : (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> Planı ata
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
