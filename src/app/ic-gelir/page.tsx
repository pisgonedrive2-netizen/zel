"use client";

import { useMemo, useState } from "react";
import {
  Plus, Pencil, Bell, CalendarClock, ChevronDown, ChevronUp,
  DollarSign, Loader2, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import {
  useStore,
  type InternalProject,
  type InternalProjectPayment,
} from "@/store/store";
import { fmt, CHART_COLORS, MONTHS, toYearMonthLocal } from "@/lib/data";
import {
  derivePaymentStatus,
  daysUntilPaymentWindow,
  isInBrandPaymentReminderWindow,
  paymentWindowInMonth,
} from "@/lib/brand-payment-schedule";
import { payrollMonthLongTitle } from "@/lib/payroll-dates";
import { brandUsersForProject } from "@/lib/ic-gelir-remind";
import { isSupabaseClientMode } from "@/lib/supabase-client";
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

const progressColor = (p: number) =>
  p >= 80 ? "#22c55e" : p >= 50 ? "#3b82f6" : p >= 30 ? "#f59e0b" : "#ef4444";

const PAYMENT_PRESETS = [
  { value: "1-5", label: "1–5" },
  { value: "15", label: "15" },
  { value: "17", label: "17" },
  { value: "20-25", label: "20–25" },
];

const STATUS_LABEL: Record<InternalProjectPayment["status"], string> = {
  pending: "Bekliyor",
  paid: "Ödendi",
  overdue: "Gecikmiş",
  cancelled: "İptal",
};

const STATUS_BADGE: Record<InternalProjectPayment["status"], string> = {
  pending: "text-amber-600 border-amber-500/30",
  paid: "text-green-500 border-green-500/30",
  overdue: "text-red-500 border-red-500/30",
  cancelled: "text-muted-foreground",
};

function ProjectForm({
  initial,
  brands,
  employees,
  onSave,
  onDelete,
  onClose,
}: {
  initial?: InternalProject;
  brands: { id: string; name: string; shortName: string }[];
  employees: { id: string; name: string }[];
  onSave: (data: Omit<InternalProject, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<InternalProject, "id">>({
    name: initial?.name ?? "",
    category: initial?.category ?? "",
    monthlyRevenue: initial?.monthlyRevenue ?? 0,
    progress: initial?.progress ?? 0,
    status: initial?.status ?? "active",
    startDate: initial?.startDate ?? new Date().toISOString().slice(0, 10),
    notes: initial?.notes ?? "",
    brandId: initial?.brandId,
    employeeIds: initial?.employeeIds ?? [],
    paymentDay: initial?.paymentDay ?? "1-5",
    reminderEnabled: initial?.reminderEnabled ?? true,
    reminderDaysBefore: initial?.reminderDaysBefore ?? 3,
    lastReminderSentAt: initial?.lastReminderSentAt,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleEmployee = (id: string) => {
    setForm((f) => ({
      ...f,
      employeeIds: f.employeeIds.includes(id)
        ? f.employeeIds.filter((x) => x !== id)
        : [...f.employeeIds, id],
    }));
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Proje / Gelir Adı" required>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="Örn. Galabet yayın paketi" />
          </Field>
          <Field label="Kategori" required>
            <Input value={form.category} onChange={(e) => set("category", e.target.value)} required placeholder="Abonelik, Reklam..." />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Marka">
            <Select
              value={form.brandId ?? ""}
              onChange={(e) => set("brandId", e.target.value || undefined)}
              options={[
                { value: "", label: "— Marka seçilmedi —" },
                ...brands.map((b) => ({ value: b.id, label: `${b.shortName} · ${b.name}` })),
              ]}
            />
          </Field>
          <Field label="Ödeme günü">
            <div className="flex gap-2">
              <Select
                value={PAYMENT_PRESETS.some((p) => p.value === form.paymentDay) ? form.paymentDay : "__custom"}
                onChange={(e) => {
                  if (e.target.value !== "__custom") set("paymentDay", e.target.value);
                }}
                options={[...PAYMENT_PRESETS, { value: "__custom", label: "Özel..." }]}
              />
              <Input
                value={form.paymentDay}
                onChange={(e) => set("paymentDay", e.target.value)}
                placeholder="1-5"
                className="max-w-[100px]"
              />
            </div>
          </Field>
        </FormGrid>
        <Field label="İlgili yayıncılar">
          <div className="flex flex-wrap gap-2 rounded-lg border border-border p-3 max-h-36 overflow-y-auto">
            {employees.length === 0 && (
              <p className="text-xs text-muted-foreground">Aktif yayıncı bulunamadı.</p>
            )}
            {employees.map((e) => (
              <label
                key={e.id}
                className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-1 hover:bg-accent/50"
              >
                <input
                  type="checkbox"
                  checked={form.employeeIds.includes(e.id)}
                  onChange={() => toggleEmployee(e.id)}
                  className="rounded border-border"
                />
                {e.name}
              </label>
            ))}
          </div>
        </Field>
        <FormGrid>
          <Field label="Aylık Gelir ($)" required>
            <NumberInput value={form.monthlyRevenue} onChange={(v) => set("monthlyRevenue", v)} required min={0} step={100} />
          </Field>
          <Field label="İlerleme (%)" required>
            <NumberInput value={form.progress} onChange={(v) => set("progress", v)} required min={0} max={100} step={1} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Başlangıç Tarihi">
            <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </Field>
          <Field label="Durum">
            <Select value={form.status} onChange={(e) => set("status", e.target.value as InternalProject["status"])} options={[
              { value: "active", label: "Aktif" },
              { value: "ongoing", label: "Devam" },
              { value: "paused", label: "Durduruldu" },
            ]} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Hatırlatma">
            <Select
              value={form.reminderEnabled ? "1" : "0"}
              onChange={(e) => set("reminderEnabled", e.target.value === "1")}
              options={[
                { value: "1", label: "Açık (ödeme günü yaklaşınca markaya bildirim)" },
                { value: "0", label: "Kapalı" },
              ]}
            />
          </Field>
          <Field label="Kaç gün önce hatırlat">
            <NumberInput
              value={form.reminderDaysBefore}
              onChange={(v) => set("reminderDaysBefore", Math.max(0, Math.min(v, 30)))}
              min={0}
              max={30}
              step={1}
            />
          </Field>
        </FormGrid>
        <Field label="Notlar">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anlaşma detayları, sözleşme notları..." />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Proje Ekle"} />
    </form>
  );
}

function PaymentForm({
  initial,
  project,
  monthYm,
  onSave,
  onDelete,
  onClose,
}: {
  initial?: InternalProjectPayment;
  project: InternalProject;
  monthYm: string;
  onSave: (data: Omit<InternalProjectPayment, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const win = paymentWindowInMonth(project.paymentDay, monthYm);
  const [form, setForm] = useState<Omit<InternalProjectPayment, "id">>({
    projectId: project.id,
    month: initial?.month ?? monthYm,
    dueDate: initial?.dueDate ?? (win ? win.start.toISOString().slice(0, 10) : undefined),
    amount: initial?.amount ?? project.monthlyRevenue,
    status: initial?.status ?? "pending",
    paidDate: initial?.paidDate,
    notes: initial?.notes ?? "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {project.name} · {payrollMonthLongTitle(monthYm)}
          {win && (
            <>
              {" "}
              · ödeme penceresi: <strong className="text-foreground">{win.label}</strong>
            </>
          )}
        </p>
        <FormGrid>
          <Field label="Tutar ($)" required>
            <NumberInput value={form.amount} onChange={(v) => set("amount", v)} min={0} step={50} />
          </Field>
          <Field label="Durum">
            <Select
              value={form.status}
              onChange={(e) => set("status", e.target.value as InternalProjectPayment["status"])}
              options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Vade / beklenen tarih">
            <Input type="date" value={form.dueDate ?? ""} onChange={(e) => set("dueDate", e.target.value || undefined)} />
          </Field>
          <Field label="Ödeme tarihi">
            <Input type="date" value={form.paidDate ?? ""} onChange={(e) => set("paidDate", e.target.value || undefined)} />
          </Field>
        </FormGrid>
        <Field label="Not">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Fatura no, havale referansı..." />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Kaydı Güncelle" : "Tahsilat Kaydı Ekle"} />
    </form>
  );
}

export default function IcGelirPage() {
  const {
    projects, projectPayments, brands, employees,
    addProject, updateProject, deleteProject,
    addProjectPayment, updateProjectPayment, deleteProjectPayment,
  } = useStore();
  const { users } = useAuth();

  const [viewMonth, setViewMonth] = useState(() => toYearMonthLocal(new Date()));
  const [filterBrand, setFilterBrand] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [projectModal, setProjectModal] = useState<"new" | InternalProject | null>(null);
  const [paymentModal, setPaymentModal] = useState<
    | { mode: "new"; project: InternalProject }
    | { mode: "edit"; payment: InternalProjectPayment; project: InternalProject }
    | null
  >(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindOk, setRemindOk] = useState<string | null>(null);

  const streamers = useMemo(
    () => employees.filter((e) => e.kind !== "coordinator" && e.status === "active"),
    [employees]
  );

  const filteredProjects = useMemo(() => {
    if (!filterBrand) return projects;
    return projects.filter((p) => p.brandId === filterBrand);
  }, [projects, filterBrand]);

  const paymentsForMonth = useMemo(
    () => projectPayments.filter((p) => p.month === viewMonth),
    [projectPayments, viewMonth]
  );

  const aktif = filteredProjects.filter((p) => p.status !== "paused");
  const yillikToplam = aktif.reduce((s, p) => s + p.monthlyRevenue * 12, 0);
  const aylikToplam = aktif.reduce((s, p) => s + p.monthlyRevenue, 0);

  const bekleyenTahsilat = useMemo(() => {
    const today = new Date();
    return aktif.reduce((sum, proj) => {
      const pay = paymentsForMonth.find((x) => x.projectId === proj.id);
      const st = derivePaymentStatus(pay?.status ?? "pending", viewMonth, proj.paymentDay, today);
      if (st === "paid" || st === "cancelled") return sum;
      return sum + (pay?.amount ?? proj.monthlyRevenue);
    }, 0);
  }, [aktif, paymentsForMonth, viewMonth]);

  const odemePenceresinde = useMemo(() => {
    const today = new Date();
    return aktif.filter((p) =>
      p.paymentDay &&
      isInBrandPaymentReminderWindow(p.paymentDay, viewMonth, today, p.reminderDaysBefore ?? 3)
    ).length;
  }, [aktif, viewMonth]);

  const pieData = filteredProjects.map((p) => ({ name: p.name, value: p.monthlyRevenue * 12 }));
  const lineData = MONTHS.map((ay) => ({ ay, icGelir: aylikToplam }));
  const barData = filteredProjects.map((p) => ({ proje: p.name, yillik: p.monthlyRevenue * 12 }));

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const base = new Date();
    for (let i = -2; i <= 4; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      const ym = toYearMonthLocal(d);
      opts.push({ value: ym, label: payrollMonthLongTitle(ym) });
    }
    return opts;
  }, []);

  async function sendReminder(project: InternalProject) {
    setRemindOk(null);
    if (!project.brandId) {
      setRemindOk("Önce projeye marka bağlayın.");
      return;
    }
    const accounts = brandUsersForProject(users, project.brandId);
    if (accounts.length === 0) {
      setRemindOk("Bu marka için portal kullanıcısı yok.");
      return;
    }
    setRemindingId(project.id);
    try {
      if (isSupabaseClientMode()) {
        const res = await fetch("/api/ic-gelir/remind", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id, month: viewMonth }),
        });
        const data = (await res.json()) as { error?: string; sentTo?: string[]; lastReminderSentAt?: string };
        if (!res.ok) throw new Error(data.error ?? "Gönderilemedi");
        if (data.lastReminderSentAt) {
          updateProject(project.id, { lastReminderSentAt: data.lastReminderSentAt });
        }
        setRemindOk(`Gönderildi: ${(data.sentTo ?? accounts.map((a) => a.name)).join(", ")}`);
      } else {
        const { pushNotification } = useStore.getState();
        const brand = brands.find((b) => b.id === project.brandId);
        const label = brand?.shortName ?? project.name;
        for (const bu of accounts) {
          pushNotification({
            type: "brand_payment_reminder",
            title: `${label} · ödeme hatırlatması`,
            message: `${project.name} için ${payrollMonthLongTitle(viewMonth)} tahsilatı bekleniyor (${fmt(project.monthlyRevenue)}).`,
            forRole: "brand",
            forUserId: bu.id,
            href: "/marka/izlenmeler",
            refId: `brand-pay-manual-${project.id}-${viewMonth}-${bu.id}`,
          });
        }
        updateProject(project.id, { lastReminderSentAt: new Date().toISOString() });
        setRemindOk(`Yerel mod: ${accounts.map((a) => a.name).join(", ")}`);
      }
    } catch (e) {
      setRemindOk(e instanceof Error ? e.message : "Hata");
    } finally {
      setRemindingId(null);
    }
  }

  return (
    <div className="p-8">
      <PageHeader
        title="İç Gelir"
        subtitle="Marka anlaşmaları, yayıncı paylaşımı, ödeme günleri ve tahsilat takibi"
        badge={projects.length === 0 ? "Kayıt yok" : `${aktif.length} aktif · ${payrollMonthLongTitle(viewMonth)}`}
        badgeTone={projects.length === 0 ? "slate" : "blue"}
      />

      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <Field label="Dönem">
          <Select value={viewMonth} onChange={(e) => setViewMonth(e.target.value)} options={monthOptions} />
        </Field>
        <Field label="Marka filtresi">
          <Select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            options={[
              { value: "", label: "Tüm markalar" },
              ...brands.map((b) => ({ value: b.id, label: b.shortName })),
            ]}
          />
        </Field>
        {remindOk && (
          <p className="text-sm text-muted-foreground self-end pb-2">{remindOk}</p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Yıllık İç Gelir", value: fmt(yillikToplam), cls: "text-blue-400" },
          { label: "Aylık Beklenen", value: fmt(aylikToplam), cls: "text-foreground" },
          { label: "Bekleyen Tahsilat", value: fmt(bekleyenTahsilat), cls: "text-amber-500" },
          { label: "Ödeme Penceresinde", value: String(odemePenceresinde), cls: "text-violet-400" },
          { label: "Aktif Kayıt", value: String(aktif.length), cls: "text-green-400" },
        ].map((k) => (
          <div key={k.label} className="border border-border rounded-xl px-4 py-3 bg-card">
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card mb-4">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-medium text-foreground">Gelir kaynakları & tahsilat</p>
          <Button size="sm" onClick={() => setProjectModal("new")} className="gap-1.5 h-7 text-xs">
            <Plus size={13} /> Gelir kaydı ekle
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {["", "Kayıt", "Marka", "Yayıncılar", "Ödeme günü", "Aylık", "Tahsilat", "İlerleme", ""].map((h, i) => (
                  <th key={i} className="px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Henüz iç gelir kaydı yok. Marka, yayıncı ve ödeme günü ile kayıt ekleyin.
                  </td>
                </tr>
              )}
              {filteredProjects.map((p) => {
                const brand = brands.find((b) => b.id === p.brandId);
                const pay = paymentsForMonth.find((x) => x.projectId === p.id);
                const today = new Date();
                const payStatus = derivePaymentStatus(pay?.status ?? "pending", viewMonth, p.paymentDay, today);
                const daysLeft = daysUntilPaymentWindow(p.paymentDay, viewMonth, today);
                const expanded = expandedId === p.id;
                const yayıncılar = p.employeeIds
                  .map((id) => employees.find((e) => e.id === id)?.name)
                  .filter(Boolean)
                  .join(", ") || "—";
                const brandAccountCount = brandUsersForProject(users, p.brandId).length;

                return (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    brand={brand}
                    pay={pay}
                    payStatus={payStatus}
                    daysLeft={daysLeft}
                    expanded={expanded}
                    yayıncılar={yayıncılar}
                    brandAccountCount={brandAccountCount}
                    reminding={remindingId === p.id}
                    onToggle={() => setExpandedId(expanded ? null : p.id)}
                    onEdit={() => setProjectModal(p)}
                    onRemind={() => void sendReminder(p)}
                    onAddPayment={() => setPaymentModal({ mode: "new", project: p })}
                    onEditPayment={() => pay && setPaymentModal({ mode: "edit", payment: pay, project: p })}
                    history={projectPayments.filter((x) => x.projectId === p.id)}
                    viewMonth={viewMonth}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredProjects.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <SectionCard title="Gelir payları">
              <DonutPie data={pieData} height={260} />
            </SectionCard>
            <SectionCard title="Aylık tahmin">
              <RevenueLine
                data={lineData}
                series={[{ key: "icGelir", label: "İç Gelir", color: CHART_COLORS.icGelir }]}
                height={260}
              />
            </SectionCard>
          </div>
          <SectionCard title="Yıllık karşılaştırma" className="mt-4">
            <BreakdownBar
              data={barData}
              series={[{ key: "yillik", label: "Yıllık", color: CHART_COLORS.icGelir }]}
              categoryKey="proje"
              height={200}
              horizontal
            />
          </SectionCard>
        </>
      ) : null}

      <Modal open={projectModal !== null} onClose={() => setProjectModal(null)} title={projectModal === "new" ? "Yeni iç gelir kaydı" : "Kaydı düzenle"}>
        <ProjectForm
          initial={projectModal !== "new" && projectModal !== null ? projectModal : undefined}
          brands={brands}
          employees={streamers}
          onSave={(data) => {
            if (projectModal === "new") addProject(data);
            else if (projectModal !== null) updateProject(projectModal.id, data);
          }}
          onDelete={projectModal !== "new" && projectModal !== null ? () => { deleteProject(projectModal.id); setProjectModal(null); } : undefined}
          onClose={() => setProjectModal(null)}
        />
      </Modal>

      <Modal
        open={paymentModal !== null}
        onClose={() => setPaymentModal(null)}
        title={paymentModal?.mode === "edit" ? "Tahsilat kaydı" : "Aylık tahsilat ekle"}
      >
        {paymentModal && (
          <PaymentForm
            initial={paymentModal.mode === "edit" ? paymentModal.payment : undefined}
            project={paymentModal.project}
            monthYm={viewMonth}
            onSave={(data) => {
              if (paymentModal.mode === "new") addProjectPayment(data);
              else updateProjectPayment(paymentModal.payment.id, data);
            }}
            onDelete={
              paymentModal.mode === "edit"
                ? () => { deleteProjectPayment(paymentModal.payment.id); setPaymentModal(null); }
                : undefined
            }
            onClose={() => setPaymentModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function ProjectRow({
  project: p,
  brand,
  pay,
  payStatus,
  daysLeft,
  expanded,
  yayıncılar,
  brandAccountCount,
  reminding,
  onToggle,
  onEdit,
  onRemind,
  onAddPayment,
  onEditPayment,
  history,
  viewMonth,
}: {
  project: InternalProject;
  brand?: { shortName: string; name: string };
  pay?: InternalProjectPayment;
  payStatus: InternalProjectPayment["status"];
  daysLeft: number | null;
  expanded: boolean;
  yayıncılar: string;
  brandAccountCount: number;
  reminding: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemind: () => void;
  onAddPayment: () => void;
  onEditPayment: () => void;
  history: InternalProjectPayment[];
  viewMonth: string;
}) {
  const win = paymentWindowInMonth(p.paymentDay, viewMonth);
  return (
    <>
      <tr className="border-b border-border/60 hover:bg-accent/20">
        <td className="px-2 py-2">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onToggle}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </td>
        <td className="px-3 py-3 font-medium text-foreground whitespace-nowrap">{p.name}</td>
        <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
          {brand ? brand.shortName : <span className="text-amber-600">—</span>}
        </td>
        <td className="px-3 py-3 text-xs text-muted-foreground max-w-[140px] truncate" title={yayıncılar}>{yayıncılar}</td>
        <td className="px-3 py-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-1 text-xs">
            <CalendarClock size={11} className="text-muted-foreground" />
            {p.paymentDay || "—"}
            {daysLeft !== null && daysLeft >= 0 && payStatus !== "paid" && (
              <span className="text-amber-600">({daysLeft === 0 ? "bugün" : `${daysLeft}g`})</span>
            )}
          </span>
        </td>
        <td className="px-3 py-3 tabular-nums">{fmt(p.monthlyRevenue)}</td>
        <td className="px-3 py-3 whitespace-nowrap">
          <Badge variant="outline" className={STATUS_BADGE[payStatus]}>
            {payStatus === "paid" && <CheckCircle2 size={10} className="mr-1 inline" />}
            {payStatus === "overdue" && <AlertTriangle size={10} className="mr-1 inline" />}
            {STATUS_LABEL[payStatus]}
          </Badge>
          {!pay && payStatus !== "paid" && (
            <Button variant="link" size="sm" className="h-auto p-0 ml-1 text-xs" onClick={onAddPayment}>
              + kayıt
            </Button>
          )}
          {pay && (
            <Button variant="link" size="sm" className="h-auto p-0 ml-1 text-xs" onClick={onEditPayment}>
              düzenle
            </Button>
          )}
        </td>
        <td className="px-3 py-3 w-28">
          <ProgressBar value={p.progress} color={progressColor(p.progress)} />
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          <div className="flex justify-end gap-1 flex-wrap">
            {p.brandId && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={reminding || brandAccountCount === 0}
                title={brandAccountCount === 0 ? "Marka kullanıcısı yok" : "Marka portalına hatırlatma gönder"}
                onClick={onRemind}
              >
                {reminding ? <Loader2 size={11} className="animate-spin" /> : <Bell size={11} />}
                Hatırlat
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={onEdit}>
              <Pencil size={11} />
            </Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/10 border-b border-border">
          <td colSpan={9} className="px-4 py-4">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium mb-2 flex items-center gap-1"><DollarSign size={14} /> Ödeme takvimi</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>Bu ay penceresi: {win?.label ?? "Tanımsız"}</li>
                  <li>Portal hesabı: {brandAccountCount > 0 ? `${brandAccountCount} kullanıcı` : "Yok"}</li>
                  <li>
                    Son hatırlatma:{" "}
                    {p.lastReminderSentAt
                      ? new Date(p.lastReminderSentAt).toLocaleString("tr-TR")
                      : "Henüz gönderilmedi"}
                  </li>
                  <li>Hatırlatma: {p.reminderEnabled ? `${p.reminderDaysBefore} gün önce` : "Kapalı"}</li>
                </ul>
                {!pay && (
                  <Button size="sm" className="mt-3 h-7 text-xs" onClick={onAddPayment}>
                    {payrollMonthLongTitle(viewMonth)} tahsilat kaydı oluştur
                  </Button>
                )}
              </div>
              <div>
                <p className="font-medium mb-2">Son tahsilatlar</p>
                {history.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Kayıt yok</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {[...history]
                      .sort((a, b) => b.month.localeCompare(a.month))
                      .slice(0, 6)
                      .map((row) => (
                        <li key={row.id} className="flex justify-between gap-2">
                          <span>{payrollMonthLongTitle(row.month)}</span>
                          <span className={STATUS_BADGE[row.status]}>
                            {STATUS_LABEL[row.status]} · {fmt(row.amount)}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
            {p.notes && (
              <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2">{p.notes}</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
