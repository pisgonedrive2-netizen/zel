"use client";

import { useMemo, useState } from "react";
import {
  Plus, Pencil, CalendarClock, ChevronDown, ChevronUp,
  ArrowRightLeft, Wallet, AlertTriangle, LayoutList, Columns3, GanttChart,
} from "lucide-react";
import {
  useStore,
  DEFAULT_KASA_ID,
  type PlannedItem,
  type PlannedItemPayment,
  type PlannedCategory,
  type PlannedRecurrence,
  type PlannedStatus,
} from "@/store/store";
import { useIsReadOnly } from "@/store/auth";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import { fmt, CHART_COLORS, MONTHS, netAylik, toYearMonthLocal } from "@/lib/data";
import { payrollMonthLongTitle } from "@/lib/payroll-dates";
import { PLANNED_CATEGORIES, plannedCategoryLabel } from "@/lib/planned-categories";
import {
  budgetProgressPct,
  daysUntilPlannedTarget,
  expandPlannedToMonths,
  formatPlannedDateRange,
  plannedDateUrgency,
  quarterKey,
  remainingBudget,
} from "@/lib/planned-schedule";
import Modal from "@/components/ui/modal";
import { Field, Input, NumberInput, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import PageHeader from "@/components/page-header";
import SectionCard from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ProgressBar from "@/components/progress-bar";
import DonutPie from "@/components/charts/donut-pie";
import RevenueLine from "@/components/charts/revenue-line";
import BreakdownBar from "@/components/charts/breakdown-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RECURRENCE_OPTIONS: { value: PlannedRecurrence; label: string }[] = [
  { value: "none", label: "Tek sefer" },
  { value: "monthly", label: "Aylık tekrar" },
  { value: "quarterly", label: "Üç ayda bir" },
  { value: "yearly", label: "Yıllık tekrar" },
];

const STATUS_OPTIONS: { value: PlannedStatus; label: string }[] = [
  { value: "planned", label: "Planlanan" },
  { value: "in-progress", label: "Devam ediyor" },
  { value: "completed", label: "Tamamlandı" },
  { value: "postponed", label: "Ertelendi" },
  { value: "cancelled", label: "İptal" },
];

const priorityCls = (p: PlannedItem["priority"]) =>
  p === "high" ? "text-red-400 border-red-500/30" : p === "medium" ? "text-amber-400 border-amber-500/30" : "text-muted-foreground";

const statusCls = (s: PlannedStatus) =>
  s === "completed" ? "text-green-400 border-green-500/30"
    : s === "in-progress" ? "text-blue-400 border-blue-500/30"
      : s === "postponed" ? "text-violet-400 border-violet-500/30"
        : s === "cancelled" ? "text-muted-foreground border-border"
          : "text-foreground border-border";

const urgencyRowCls = (u: ReturnType<typeof plannedDateUrgency>) =>
  u === "overdue" ? "bg-red-500/5" : u === "soon" ? "bg-amber-500/5" : "";

function expenseCategoryFor(planned: PlannedCategory): string {
  const map: Record<PlannedCategory, string> = {
    capex: "Donanım",
    opex: "Yazılım & Araçlar",
    revenue: "Diğer",
    growth: "Pazarlama Gideri",
    other: "Diğer",
  };
  return map[planned] ?? "Diğer";
}

function PlannedItemForm({
  initial,
  employees,
  brands,
  projects,
  onSave,
  onDelete,
  onClose,
  readOnly,
}: {
  initial?: PlannedItem;
  employees: { id: string; name: string }[];
  brands: { id: string; shortName: string; name: string }[];
  projects: { id: string; name: string }[];
  onSave: (data: Omit<PlannedItem, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const [form, setForm] = useState<Omit<PlannedItem, "id">>({
    name: initial?.name ?? "",
    category: initial?.category ?? "other",
    budget: initial?.budget ?? 0,
    spent: initial?.spent ?? 0,
    startDate: initial?.startDate ?? "",
    targetDate: initial?.targetDate ?? "",
    priority: initial?.priority ?? "medium",
    status: initial?.status ?? "planned",
    notes: initial?.notes ?? "",
    employeeId: initial?.employeeId,
    brandId: initial?.brandId,
    internalProjectId: initial?.internalProjectId,
    isRecurring: initial?.isRecurring ?? false,
    recurrence: initial?.recurrence ?? "none",
    expenseEntryId: initial?.expenseEntryId,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!readOnly) { onSave(form); onClose(); } }}>
      <fieldset disabled={readOnly} className="grid gap-4 disabled:opacity-90">
        <Field label="Hedef / yatırım adı" required>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <FormGrid>
          <Field label="Kategori" required>
            <Select
              value={form.category}
              onChange={(e) => set("category", e.target.value as PlannedCategory)}
              options={PLANNED_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            />
          </Field>
          <Field label="Durum">
            <Select
              value={form.status}
              onChange={(e) => set("status", e.target.value as PlannedStatus)}
              options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
            />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Bütçe ($)" required>
            <NumberInput value={form.budget} onChange={(v) => set("budget", v)} min={0} step={500} />
          </Field>
          <Field label="Harcanan ($)">
            <NumberInput value={form.spent} onChange={(v) => set("spent", v)} min={0} step={100} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Başlangıç">
            <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </Field>
          <Field label="Hedef bitiş">
            <Input type="date" value={form.targetDate} onChange={(e) => set("targetDate", e.target.value)} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Öncelik">
            <Select
              value={form.priority}
              onChange={(e) => set("priority", e.target.value as PlannedItem["priority"])}
              options={[
                { value: "high", label: "Yüksek" },
                { value: "medium", label: "Orta" },
                { value: "low", label: "Düşük" },
              ]}
            />
          </Field>
          <Field label="Sorumlu">
            <Select
              value={form.employeeId ?? ""}
              onChange={(e) => set("employeeId", e.target.value || undefined)}
              options={[
                { value: "", label: "—" },
                ...employees.map((e) => ({ value: e.id, label: e.name })),
              ]}
            />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Marka">
            <Select
              value={form.brandId ?? ""}
              onChange={(e) => set("brandId", e.target.value || undefined)}
              options={[
                { value: "", label: "—" },
                ...brands.map((b) => ({ value: b.id, label: b.shortName })),
              ]}
            />
          </Field>
          <Field label="İç gelir projesi">
            <Select
              value={form.internalProjectId ?? ""}
              onChange={(e) => set("internalProjectId", e.target.value || undefined)}
              options={[
                { value: "", label: "—" },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Tekrar">
            <Select
              value={form.isRecurring ? "1" : "0"}
              onChange={(e) => {
                const on = e.target.value === "1";
                set("isRecurring", on);
                if (!on) set("recurrence", "none");
              }}
              options={[
                { value: "0", label: "Hayır" },
                { value: "1", label: "Evet" },
              ]}
            />
          </Field>
          <Field label="Tekrar sıklığı">
            <Select
              value={form.recurrence}
              onChange={(e) => set("recurrence", e.target.value as PlannedRecurrence)}
              options={RECURRENCE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
            />
          </Field>
        </FormGrid>
        <Field label="Notlar">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </fieldset>
      <FormActions onCancel={onClose} onDelete={readOnly ? undefined : onDelete} submitLabel={initial ? "Güncelle" : "Hedef ekle"} />
    </form>
  );
}

function PaymentForm({
  initial,
  item,
  monthYm,
  onSave,
  onDelete,
  onClose,
  readOnly,
}: {
  initial?: PlannedItemPayment;
  item: PlannedItem;
  monthYm: string;
  onSave: (data: Omit<PlannedItemPayment, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const [form, setForm] = useState<Omit<PlannedItemPayment, "id">>({
    plannedItemId: item.id,
    month: initial?.month ?? monthYm,
    dueDate: initial?.dueDate ?? item.targetDate,
    amount: initial?.amount ?? Math.max(0, remainingBudget(item)),
    status: initial?.status ?? "pending",
    paidDate: initial?.paidDate,
    notes: initial?.notes ?? "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!readOnly) { onSave(form); onClose(); } }}>
      <fieldset disabled={readOnly} className="grid gap-4">
        <p className="text-sm text-muted-foreground">{item.name} · {payrollMonthLongTitle(monthYm)}</p>
        <FormGrid>
          <Field label="Tutar ($)">
            <NumberInput value={form.amount} onChange={(v) => set("amount", v)} min={0} />
          </Field>
          <Field label="Durum">
            <Select
              value={form.status}
              onChange={(e) => set("status", e.target.value as PlannedItemPayment["status"])}
              options={[
                { value: "pending", label: "Bekliyor" },
                { value: "paid", label: "Ödendi" },
                { value: "cancelled", label: "İptal" },
              ]}
            />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Vade">
            <Input type="date" value={form.dueDate ?? ""} onChange={(e) => set("dueDate", e.target.value || undefined)} />
          </Field>
          <Field label="Ödeme tarihi">
            <Input type="date" value={form.paidDate ?? ""} onChange={(e) => set("paidDate", e.target.value || undefined)} />
          </Field>
        </FormGrid>
        <Field label="Not">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </fieldset>
      <FormActions onCancel={onClose} onDelete={readOnly ? undefined : onDelete} submitLabel={initial ? "Güncelle" : "Taksit ekle"} />
    </form>
  );
}

export default function PlanlananPage() {
  const {
    plannedItems, plannedItemPayments, employees, brands, projects, kasas,
    addPlannedItem, updatePlannedItem, deletePlannedItem,
    addPlannedItemPayment, updatePlannedItemPayment, deletePlannedItemPayment,
    addExpense, addKasaTransaction,
  } = useStore();
  const readOnly = useIsReadOnly();
  const defaultKasaId =
    kasas.find((k) => k.isDefault && !k.archived)?.id
    ?? kasas.find((k) => !k.archived)?.id
    ?? DEFAULT_KASA_ID;

  const [viewMonth, setViewMonth] = useState(() => toYearMonthLocal(new Date()));
  const [filterCategory, setFilterCategory] = useState<"" | PlannedCategory>("");
  const [filterStatus, setFilterStatus] = useState<"" | PlannedStatus>("");
  const [filterQuarter, setFilterQuarter] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemModal, setItemModal] = useState<"new" | PlannedItem | null>(null);
  const [paymentModal, setPaymentModal] = useState<
    | { mode: "new"; item: PlannedItem }
    | { mode: "edit"; payment: PlannedItemPayment; item: PlannedItem }
    | null
  >(null);
  const [transferMsg, setTransferMsg] = useState<string | null>(null);

  const staff = useMemo(
    () => employees.filter((e) => e.status === "active"),
    [employees]
  );

  const filtered = useMemo(() => {
    let list = [...plannedItems];
    if (filterCategory) list = list.filter((i) => i.category === filterCategory);
    if (filterStatus) list = list.filter((i) => i.status === filterStatus);
    if (filterQuarter) {
      list = list.filter((i) => {
        const q = quarterKey(i.targetDate) ?? quarterKey(i.startDate);
        return q === filterQuarter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.notes.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const da = a.targetDate || a.startDate || "9999";
      const db = b.targetDate || b.startDate || "9999";
      return da.localeCompare(db);
    });
    return list;
  }, [plannedItems, filterCategory, filterStatus, filterQuarter, search]);

  const today = new Date();
  const active = filtered.filter((i) => i.status !== "cancelled" && i.status !== "completed");
  const toplamButce = active.reduce((s, i) => s + i.budget, 0);
  const toplamHarcanan = filtered.reduce((s, i) => s + (i.spent ?? 0), 0);
  const yaklasan = filtered.filter((i) => plannedDateUrgency(i.targetDate, i.status, today) === "soon").length;
  const gecikmis = filtered.filter((i) => plannedDateUrgency(i.targetDate, i.status, today) === "overdue").length;

  const timelineFrom = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return toYearMonthLocal(d);
  }, []);
  const timelineTo = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 10);
    return toYearMonthLocal(d);
  }, []);

  const plannedByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of plannedItems) {
      for (const { month, amount } of expandPlannedToMonths(item, timelineFrom, timelineTo)) {
        map.set(month, (map.get(month) ?? 0) + amount);
      }
    }
    const year = viewMonth.split("-")[0] ?? String(new Date().getFullYear());
    return MONTHS.map((ay, i) => {
      const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
      return { ay, planlanan: map.get(ym) ?? 0 };
    });
  }, [plannedItems, timelineFrom, timelineTo, viewMonth]);

  const pieData = useMemo(() => {
    const m = new Map<PlannedCategory, number>();
    for (const i of filtered) {
      m.set(i.category, (m.get(i.category) ?? 0) + i.budget);
    }
    return PLANNED_CATEGORIES.filter((c) => (m.get(c.value) ?? 0) > 0).map((c) => ({
      name: c.label,
      value: m.get(c.value) ?? 0,
    }));
  }, [filtered]);

  const proj2026 = MONTHS.map((ay, i) => ({
    ay,
    net2025: netAylik[i],
    net2026: Math.round(netAylik[i] * 1.35),
    planlanan: plannedByMonth[i]?.planlanan ?? 0,
  }));

  const quarterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const i of plannedItems) {
      const q = quarterKey(i.targetDate) ?? quarterKey(i.startDate);
      if (q) set.add(q);
    }
    return [...set].sort();
  }, [plannedItems]);

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const base = new Date();
    for (let i = -2; i <= 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      const ym = toYearMonthLocal(d);
      opts.push({ value: ym, label: payrollMonthLongTitle(ym) });
    }
    return opts;
  }, []);

  function transferToExpense(item: PlannedItem) {
    if (readOnly) return;
    const amount = remainingBudget(item);
    if (amount <= 0) {
      setTransferMsg("Kalan bütçe yok — harcama zaten tamamlanmış görünüyor.");
      return;
    }
    addExpense({
      category: expenseCategoryFor(item.category),
      amount,
      date: new Date().toISOString().slice(0, 10),
      description: `[Planlanan] ${item.name}`,
    });
    updatePlannedItem(item.id, {
      spent: item.budget,
      status: item.status === "planned" || item.status === "in-progress" ? "completed" : item.status,
    });
    setTransferMsg(`Giderlere ${fmt(amount)} aktarıldı (/giderler).`);
  }

  function transferToKasa(item: PlannedItem) {
    if (readOnly) return;
    const amount = remainingBudget(item);
    if (amount <= 0) {
      setTransferMsg("Kalan bütçe yok.");
      return;
    }
    addKasaTransaction({
      kasaId: defaultKasaId,
      date: new Date().toISOString().slice(0, 16),
      direction: "out",
      amountUsd: amount,
      feeUsd: 0,
      purpose: `[Planlanan] ${item.name}`,
      counterparty: "Planlanan yatırım",
      proof: "",
      notes: item.notes,
    });
    updatePlannedItem(item.id, { spent: item.budget });
    setTransferMsg(`Kasaya ${fmt(amount)} çıkış yazıldı (/kasa).`);
  }

  const KANBAN: { status: PlannedStatus; title: string }[] = [
    { status: "planned", title: "Planlanan" },
    { status: "in-progress", title: "Devam" },
    { status: "completed", title: "Tamamlandı" },
    { status: "postponed", title: "Ertelendi" },
    { status: "cancelled", title: "İptal" },
  ];

  return (
    <div className="p-8">
      <PageHeader
        title="Planlanan"
        subtitle={
          isSupabaseClientMode()
            ? "CapEx, OpEx, gelir ve büyüme hedefleri · tarih, bütçe, taksit ve bağlantılar"
            : "Yatırım ve büyüme planlaması"
        }
        badge={`${filtered.length} kayıt`}
        badgeTone="blue"
      />

      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <Field label="Dönem (taksit)">
          <Select value={viewMonth} onChange={(e) => setViewMonth(e.target.value)} options={monthOptions} />
        </Field>
        <Field label="Kategori">
          <Select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as "" | PlannedCategory)}
            options={[{ value: "", label: "Tümü" }, ...PLANNED_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))]}
          />
        </Field>
        <Field label="Durum">
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "" | PlannedStatus)}
            options={[{ value: "", label: "Tümü" }, ...STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))]}
          />
        </Field>
        <Field label="Çeyrek">
          <Select
            value={filterQuarter}
            onChange={(e) => setFilterQuarter(e.target.value)}
            options={[{ value: "", label: "Tümü" }, ...quarterOptions.map((q) => ({ value: q, label: q }))]}
          />
        </Field>
        <Field label="Ara">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hedef adı..." className="min-w-[160px]" />
        </Field>
        {transferMsg && <p className="text-sm text-muted-foreground pb-2">{transferMsg}</p>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Aktif bütçe", value: fmt(toplamButce), cls: "text-amber-400" },
          { label: "Harcanan", value: fmt(toplamHarcanan), cls: "text-foreground" },
          { label: "Yaklaşan (14g)", value: String(yaklasan), cls: "text-violet-400" },
          { label: "Gecikmiş", value: String(gecikmis), cls: "text-red-400" },
          { label: "Kayıt", value: String(filtered.length), cls: "text-green-400" },
        ].map((k) => (
          <div key={k.label} className="border border-border rounded-xl px-4 py-3 bg-card">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="list" className="mb-6">
        <TabsList>
          <TabsTrigger value="list" className="gap-1.5"><LayoutList size={14} /> Liste</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5"><GanttChart size={14} /> Zaman çizelgesi</TabsTrigger>
          <TabsTrigger value="kanban" className="gap-1.5"><Columns3 size={14} /> Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <PlannedTableHeader readOnly={readOnly} onAdd={() => setItemModal("new")} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {["", "Hedef", "Kategori", "Tarih", "Bütçe", "Kalan", "Öncelik", "Durum", ""].map((h, i) => (
                      <th key={i} className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                        Filtrelere uygun kayıt yok.
                      </td>
                    </tr>
                  )}
                  {filtered.map((item) => (
                    <PlannedRow
                      key={item.id}
                      item={item}
                      employees={employees}
                      brands={brands}
                      projects={projects}
                      payments={plannedItemPayments.filter((p) => p.plannedItemId === item.id)}
                      viewMonth={viewMonth}
                      expanded={expandedId === item.id}
                      readOnly={readOnly}
                      onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      onEdit={() => setItemModal(item)}
                      onPaymentNew={() => setPaymentModal({ mode: "new", item })}
                      onPaymentEdit={(pay) => setPaymentModal({ mode: "edit", payment: pay, item })}
                      onTransferExpense={() => transferToExpense(item)}
                      onTransferKasa={() => transferToKasa(item)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <SectionCard title="Aylık planlanan bütçe (hedef tarih + tekrarlar)">
            <BreakdownBar
              data={plannedByMonth.filter((_, i) => plannedByMonth[i].planlanan > 0 || i < 12)}
              series={[{ key: "planlanan", label: "Planlanan", color: CHART_COLORS.icGelir }]}
              categoryKey="ay"
              height={240}
            />
          </SectionCard>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-4">
            {monthOptions.slice(2, 14).map((m) => {
              const itemsInMonth = plannedItems.filter((it) => {
                const exp = expandPlannedToMonths(it, m.value, m.value);
                return exp.some((e) => e.month === m.value);
              });
              if (itemsInMonth.length === 0) return null;
              return (
                <MotionMonthCard key={m.value}>
                  <p className="text-xs font-medium text-foreground mb-2">{m.label}</p>
                  <ul className="space-y-1">
                    {itemsInMonth.map((it) => (
                      <li key={it.id} className="text-[10px] text-muted-foreground truncate" title={it.name}>
                        {it.name}
                      </li>
                    ))}
                  </ul>
                </MotionMonthCard>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 min-h-[320px]">
            {KANBAN.map((col) => {
              const cards = filtered.filter((i) => i.status === col.status);
              return (
                <div key={col.status} className="rounded-xl border border-border bg-muted/10 p-2 flex flex-col">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1 py-2">
                    {col.title} <span className="text-foreground">({cards.length})</span>
                  </p>
                  <div className="flex flex-col gap-2 flex-1">
                    {cards.map((item) => (
                      <KanbanCard
                        key={item.id}
                        item={item}
                        readOnly={readOnly}
                        onEdit={() => setItemModal(item)}
                        onStatus={(st) => updatePlannedItem(item.id, { status: st })}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <PlannedCharts>
        <SectionCard title="Kategori bütçe payı">
          <DonutPie data={pieData.length ? pieData : [{ name: "—", value: 1 }]} height={260} />
        </SectionCard>
        <SectionCard title="2025 net · 2026 hedef · planlanan aylık">
          <RevenueLine
            data={proj2026}
            series={[
              { key: "net2025", label: "2025 Net", color: CHART_COLORS.icGelir },
              { key: "net2026", label: "2026 +%35", color: CHART_COLORS.net },
              { key: "planlanan", label: "Planlanan bütçe", color: CHART_COLORS.disGelir },
            ]}
            height={260}
          />
        </SectionCard>
      </PlannedCharts>

      <div className="mt-4 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
        <p className="text-green-400 font-semibold text-sm mb-1">2026 projeksiyonu</p>
        <p className="text-muted-foreground text-sm">
          Sabit büyüme senaryosu net kar:{" "}
          <span className="text-green-400 font-bold">{fmt(Math.round(netAylik.reduce((s, v) => s + v, 0) * 1.35))}</span>
          {" · "}Kayıtlı planlanan toplam bütçe:{" "}
          <span className="text-amber-400 font-bold">{fmt(plannedItems.reduce((s, i) => s + i.budget, 0))}</span>
        </p>
      </div>

      <Modal open={itemModal !== null} onClose={() => setItemModal(null)} title={itemModal === "new" ? "Hedef ekle" : "Hedefi düzenle"}>
        <PlannedItemForm
          initial={itemModal !== "new" && itemModal !== null ? itemModal : undefined}
          employees={staff}
          brands={brands}
          projects={projects}
          readOnly={readOnly}
          onSave={(data) => {
            if (itemModal === "new") addPlannedItem(data);
            else if (itemModal !== null) updatePlannedItem(itemModal.id, data);
          }}
          onDelete={!readOnly && itemModal !== "new" && itemModal !== null ? () => { deletePlannedItem(itemModal.id); setItemModal(null); } : undefined}
          onClose={() => setItemModal(null)}
        />
      </Modal>

      <Modal open={paymentModal !== null} onClose={() => setPaymentModal(null)} title={paymentModal?.mode === "edit" ? "Taksit kaydı" : "Taksit ekle"}>
        {paymentModal && (
          <PaymentForm
            initial={paymentModal.mode === "edit" ? paymentModal.payment : undefined}
            item={paymentModal.item}
            monthYm={viewMonth}
            readOnly={readOnly}
            onSave={(data) => {
              if (paymentModal.mode === "new") {
                addPlannedItemPayment(data);
                if (data.status === "paid") {
                  const item = paymentModal.item;
                  updatePlannedItem(item.id, { spent: (item.spent ?? 0) + data.amount });
                }
              } else {
                updatePlannedItemPayment(paymentModal.payment.id, data);
              }
            }}
            onDelete={
              !readOnly && paymentModal.mode === "edit"
                ? () => { deletePlannedItemPayment(paymentModal.payment.id); setPaymentModal(null); }
                : undefined
            }
            onClose={() => setPaymentModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function PlannedTableHeader({ readOnly, onAdd }: { readOnly: boolean; onAdd: () => void }) {
  return (
    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
      <p className="text-sm font-medium text-foreground">Yatırım & büyüme hedefleri</p>
      {!readOnly && (
        <Button size="sm" onClick={onAdd} className="gap-1.5 h-7 text-xs">
          <Plus size={13} /> Hedef ekle
        </Button>
      )}
    </div>
  );
}

function PlannedCharts({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{children}</div>;
}

function MotionMonthCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-3">{children}</div>;
}

function KanbanCard({
  item,
  readOnly,
  onEdit,
  onStatus,
}: {
  item: PlannedItem;
  readOnly: boolean;
  onEdit: () => void;
  onStatus: (s: PlannedStatus) => void;
}) {
  const urg = plannedDateUrgency(item.targetDate, item.status);
  return (
    <div className={`rounded-lg border border-border bg-card p-3 text-sm ${urgencyRowCls(urg)}`}>
      <p className="font-medium text-foreground leading-tight">{item.name}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{plannedCategoryLabel(item.category)}</p>
      <p className="text-xs tabular-nums mt-2">{fmt(item.budget)} · kalan {fmt(remainingBudget(item))}</p>
      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
        <CalendarClock size={10} /> {formatPlannedDateRange(item)}
      </p>
      <ProgressBar value={budgetProgressPct(item)} color="#3b82f6" />
      <KanbanActions>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onEdit}><Pencil size={11} /></Button>
        {!readOnly && (
          <Select
            value={item.status}
            onChange={(e) => onStatus(e.target.value as PlannedStatus)}
            options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}

          />
        )}
      </KanbanActions>
    </div>
  );
}

function KanbanActions({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-1 mt-2 items-center">{children}</div>;
}

function PlannedRow({
  item,
  employees,
  brands,
  projects,
  payments,
  viewMonth,
  expanded,
  readOnly,
  onToggle,
  onEdit,
  onPaymentNew,
  onPaymentEdit,
  onTransferExpense,
  onTransferKasa,
}: {
  item: PlannedItem;
  employees: { id: string; name: string }[];
  brands: { id: string; shortName: string }[];
  projects: { id: string; name: string }[];
  payments: PlannedItemPayment[];
  viewMonth: string;
  expanded: boolean;
  readOnly: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onPaymentNew: () => void;
  onPaymentEdit: (p: PlannedItemPayment) => void;
  onTransferExpense: () => void;
  onTransferKasa: () => void;
}) {
  const urg = plannedDateUrgency(item.targetDate, item.status);
  const days = daysUntilPlannedTarget(item.targetDate);
  const pay = payments.find((p) => p.month === viewMonth);
  const emp = employees.find((e) => e.id === item.employeeId)?.name;
  const brand = brands.find((b) => b.id === item.brandId)?.shortName;
  const proj = projects.find((p) => p.id === item.internalProjectId)?.name;

  return (
    <>
      <tr className={`border-b border-border/60 hover:bg-accent/20 ${urgencyRowCls(urg)}`}>
        <td className="px-2 py-2">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onToggle}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </td>
        <td className="px-3 py-3 font-medium">
          {item.name}
          {item.isRecurring && (
            <Badge variant="outline" className="ml-1 text-[10px]">Tekrar</Badge>
          )}
        </td>
        <td className="px-3 py-3 text-xs text-muted-foreground">{plannedCategoryLabel(item.category)}</td>
        <td className="px-3 py-3 text-xs whitespace-nowrap">
          {formatPlannedDateRange(item)}
          {days !== null && item.status !== "completed" && item.status !== "cancelled" && (
            <span className={urg === "overdue" ? " text-red-500" : " text-amber-600"}>
              {" "}({days < 0 ? `${-days}g geçti` : days === 0 ? "bugün" : `${days}g`})
            </span>
          )}
        </td>
        <td className="px-3 py-3 tabular-nums">{fmt(item.budget)}</td>
        <td className="px-3 py-3 tabular-nums text-amber-600">{fmt(remainingBudget(item))}</td>
        <td className="px-3 py-3">
          <Badge variant="outline" className={`text-xs ${priorityCls(item.priority)}`}>
            {item.priority === "high" ? "Yüksek" : item.priority === "medium" ? "Orta" : "Düşük"}
          </Badge>
        </td>
        <td className="px-3 py-3">
          <Badge variant="outline" className={`text-xs ${statusCls(item.status)}`}>
            {STATUS_OPTIONS.find((s) => s.value === item.status)?.label}
          </Badge>
        </td>
        <td className="px-3 py-2 text-right">
          <Button variant="outline" size="sm" className="h-7" onClick={onEdit}><Pencil size={12} /></Button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/10 border-b border-border">
          <td colSpan={9} className="px-4 py-4 text-sm">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium mb-2">Bağlantılar & bütçe</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>Sorumlu: {emp ?? "—"}</li>
                  <li>Marka: {brand ?? "—"}</li>
                  <li>İç gelir: {proj ?? "—"}</li>
                  <li>Harcanan: {fmt(item.spent)} / {fmt(item.budget)}</li>
                  <li>Tekrar: {item.isRecurring ? RECURRENCE_OPTIONS.find((r) => r.value === item.recurrence)?.label : "Hayır"}</li>
                </ul>
                <ProgressBar value={budgetProgressPct(item)} color="#22c55e" />
                {!readOnly && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onTransferExpense}>
                      <ArrowRightLeft size={11} /> Giderlere aktar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onTransferKasa}>
                      <Wallet size={11} /> Kasaya çıkış
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={onPaymentNew}>
                      {payrollMonthLongTitle(viewMonth)} taksit
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium mb-2">Taksitler</p>
                {payments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Kayıt yok</p>
                ) : (
                  <ul className="text-xs space-y-1">
                    {[...payments].sort((a, b) => b.month.localeCompare(a.month)).map((p) => (
                      <li key={p.id} className="flex justify-between gap-2">
                        <span>{payrollMonthLongTitle(p.month)}</span>
                        <button type="button" className="text-primary hover:underline" onClick={() => onPaymentEdit(p)}>
                          {p.status} · {fmt(p.amount)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {pay && (
                  <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <AlertTriangle size={10} /> Bu ay taksit: {fmt(pay.amount)} ({pay.status})
                  </p>
                )}
              </div>
            </div>
            {item.notes && <p className="mt-3 text-xs text-muted-foreground border-t pt-2">{item.notes}</p>}
          </td>
        </tr>
      )}
    </>
  );
}
