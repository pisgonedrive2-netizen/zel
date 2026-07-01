"use client";

import { useState, useRef, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, Clock,
  AlertTriangle, CalendarClock, ExternalLink, Home, Receipt, Wallet, Stamp, UserMinus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useStore, calcNetPayable, calcPayrollPayoutDue, calcCarryForward, calcOpenAdvanceBalance, isPayrollActive, isPayrollUpcoming,
  estimateFirstPayrollNet, getRentForMonth, payrollProrationFactor,
  sumApprovedContentExpenses, sumPaidContentExpenses, sumPayrollSettledContentExpenses,
  plannedPayrollPlusApprovedContent,
  totalCashOutPaidForMonth,
  DEFAULT_KASA_ID,
  type Employee, type Advance, type SalaryExtra, type ContentExpense, type MonthPaymentStatus,
  type Kasa, type KasaTransaction,
} from "@/store/store";
import { useAuth, useIsReadOnly } from "@/store/auth";
import { canViewRamizWallet, RAMIZ_EMPLOYEE_ID, filterKasasForRamizViewer, filterKasaTransactionsForRamizViewer } from "@/lib/ramiz-wallet-access";
import { usePanelView } from "@/store/panel-view";
import { fmt, shiftCalendarMonthYm, toYearMonthLocal, toDateLocal, defaultSnapshotDateInMonth } from "@/lib/data";
import { expenseReviewStatus, settlementLabel, isUnsettledApprovedContent } from "@/lib/content-expense";
import { ContentExpensesBulkModal } from "@/components/content-expenses-bulk-modal";
import { PayrollLinesPayModal } from "@/components/payroll-lines-pay-modal";
import { payrollDueShort, payrollMonthLongTitle } from "@/lib/payroll-dates";
import {
  computeTronPanelMetrics,
  kasaPaymentBalance,
  kasaSelectOptionLabel,
} from "@/lib/kasa-tron-metrics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import Modal from "@/components/ui/modal";
import { Field, Input as FInput, NumberInput, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ProofUploader } from "@/components/proof-uploader";
import { MonthlyExportMenu } from "@/components/monthly-export-menu";
import { BulkRentModal } from "@/components/bulk-rent-modal";
import {
  buildSalaryContentExportLines,
  exportSalaryMonthCsv,
  exportSalaryMonthPdf,
  listAvailableMonths,
  monthLabelTr,
  type SalaryReportRow,
  type SalaryUpcomingRow,
} from "@/lib/monthly-exports";
import {
  buildPayrollPaymentLines,
  formatPayrollLineStatusSummary,
  payrollPaymentPhase,
  shortPayrollLineLabel,
  sumPaidPayrollLines,
  sumUnpaidPayrollLines,
  type PayrollLineItem,
} from "@/lib/payroll-lines";

// ── Helpers ───────────────────────────────────────────────────────────────
function prevMonth(m: string) { return shiftCalendarMonthYm(m, -1); }
const CONTENT_INLINE_MAX = 3;
/** Bu sayıdan fazla kalemde liste kartta gösterilmez — yalnızca modal. */
const PAYROLL_LINES_INLINE_MAX = 4;
function nextMonth(m: string) { return shiftCalendarMonthYm(m, 1); }
const MONTH_NAMES = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
function monthLabel(m: string) { const [y, mo] = m.split("-"); return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y}`; }
function initials(name: string) { return name.split(/[\s(]/).map(p => p[0]).filter(Boolean).join("").toUpperCase().slice(0, 2); }

/** Seçili ayda bordro kartı gösterilecek ay (çıkış sonrası ödenmemiş son bordro dahil). */
function employeePayrollMonthForView(
  employee: Employee,
  viewMonth: string,
  advances: Advance[],
  salaryExtras: SalaryExtra[],
  contentExpenses: ContentExpense[],
  paymentStatuses: MonthPaymentStatus[],
): string | null {
  if (employee.kind === "coordinator") return null;
  if (isPayrollActive(employee, viewMonth)) return viewMonth;
  const end = employee.payrollEndMonth;
  if (!end || viewMonth < end) return null;
  const lines = buildPayrollPaymentLines(
    employee,
    end,
    advances,
    salaryExtras,
    contentExpenses,
    paymentStatuses,
  );
  if (lines.length > 0 && payrollPaymentPhase(lines) !== "full") return end;
  return null;
}

function payrollAmountDue(
  net: number,
  unpaidLineTotal: number,
  isFullyPaid: boolean,
  paidOut: number,
  payrollLines: PayrollLineItem[],
): number {
  if (isFullyPaid) return paidOut > 0 ? paidOut : net;
  if (unpaidLineTotal > 0) return unpaidLineTotal;
  if (payrollPaymentPhase(payrollLines) === "partial") {
    return Math.max(0, net - sumPaidPayrollLines(payrollLines));
  }
  return net;
}

// ── Inline-editable cell ──────────────────────────────────────────────────
function InlineEdit({ value, onSave, className = "", mono = false, readOnly = false }: {
  value: string; onSave: (v: string) => void; className?: string; mono?: boolean; readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const inputRef              = useRef<HTMLInputElement>(null);

  const start = () => { if (readOnly) return; setDraft(value); setEditing(true); setTimeout(() => inputRef.current?.select(), 0); };
  const save  = () => { const v = draft.trim(); if (v !== value) onSave(v); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (readOnly) {
    return (
      <span className={`select-text ${mono ? "font-mono text-xs" : ""} ${className}`}>
        {value || <span className="italic text-muted-foreground">—</span>}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label="Satır içi düzenle"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
        className={`bg-transparent border-b border-blue-500/60 outline-none focus:border-blue-600 text-sm ${mono ? "font-mono text-xs" : ""} ${className}`}
        style={{ width: Math.max(draft.length * 8, 80) + "px" }}
      />
    );
  }
  return (
    <span onDoubleClick={start} title="Düzenlemek için çift tıkla"
      className={`cursor-default select-none group/inline relative ${className}`}>
      {value || <span className="italic text-muted-foreground">— boş, çift tıkla</span>}
      <span className="ml-1 opacity-0 group-hover/inline:opacity-40 transition-opacity text-[10px] text-muted-foreground">✎</span>
    </span>
  );
}

// ── Employee Form ─────────────────────────────────────────────────────────
function EmployeeForm({ initial, onSave, onDelete, onClose, hideWallet = false }: {
  initial?: Employee; onSave: (d: Omit<Employee, "id">) => void; onDelete?: () => void; onClose: () => void;
  hideWallet?: boolean;
}) {
  const [form, setForm] = useState<Omit<Employee, "id">>({
    name:              initial?.name              ?? "",
    role:              initial?.role              ?? "",
    department:        initial?.department        ?? "",
    baseSalary:        initial?.baseSalary        ?? 0,
    rentSupport:       initial?.rentSupport       ?? 0,
    initialAdvance:    initial?.initialAdvance    ?? 0,
    paymentDay:        initial?.paymentDay        ?? "1-5",
    payrollStartMonth: initial?.payrollStartMonth ?? toYearMonthLocal(new Date()),
    startDate:         initial?.startDate         ?? new Date().toISOString().slice(0, 10),
    status:            initial?.status            ?? "active",
    walletAddress:     initial?.walletAddress     ?? "",
    avatar:            initial?.avatar            ?? "",
    notes:             initial?.notes             ?? "",
    kind:              initial?.kind              ?? "streamer",
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Ad / Takma Ad" required>
            <FInput value={form.name} onChange={e => set("name", e.target.value)} required placeholder="Ad Soyad / takma ad" />
          </Field>
          <Field label="Rol / Pozisyon" required>
            <FInput value={form.role} onChange={e => set("role", e.target.value)} required placeholder="Yayıncı, Moderatör..." />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Departman">
            <FInput value={form.department} onChange={e => set("department", e.target.value)} placeholder="Yayın, İçerik..." />
          </Field>
          <Field label="Tip">
            <Select value={form.kind} onChange={e => set("kind", e.target.value as Employee["kind"])}
              options={[
                { value: "streamer",    label: "Yayıncı" },
                { value: "moderator",   label: "Moderatör" },
                { value: "coordinator", label: "Koordinatör" },
                { value: "other",       label: "Diğer" },
              ]} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Aylık Maaş ($)" required>
            <NumberInput value={form.baseSalary} onChange={v => set("baseSalary", v)} required min={0} step={50} />
          </Field>
          <Field label="Ev Kira Desteği ($/ay)" hint="Yoksa 0">
            <NumberInput value={form.rentSupport} onChange={v => set("rentSupport", v)} min={0} step={50} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Açılış Avans Bakiyesi ($)" hint="İçerideki avans (kapatılana kadar görünür)">
            <NumberInput value={form.initialAdvance} onChange={v => set("initialAdvance", v)} min={0} step={100} />
          </Field>
          <Field label="Ödeme Günü" hint='ör. "1-5" veya "17"'>
            <FInput value={form.paymentDay} onChange={e => set("paymentDay", e.target.value)} placeholder="1-5" />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Bordro Başlangıç Ayı" hint="Bu aydan önce maaş hesaplanmaz">
            <FInput type="month" value={form.payrollStartMonth} onChange={e => set("payrollStartMonth", e.target.value)} />
          </Field>
          <Field label="İşe Başlangıç">
            <DateTimePicker mode="date" value={form.startDate} onChange={(v) => set("startDate", v)} />
          </Field>
        </FormGrid>
        {!hideWallet && (
        <Field label="Cüzdan Adresi" hint="TRC20, EVM veya diğer ağ adresi">
          <FInput value={form.walletAddress} onChange={e => set("walletAddress", e.target.value)} placeholder="T... veya 0x..." className="font-mono text-xs" />
        </Field>
        )}
        <Field label="Durum">
          <Select value={form.status} onChange={e => set("status", e.target.value as Employee["status"])}
            options={[{ value:"active", label:"Aktif" },{ value:"inactive", label:"Pasif" }]} />
        </Field>
        <Field label="Notlar">
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Anlaşma detayları..." />
        </Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Ekle"} />
    </form>
  );
}

const EXIT_REASON_LABELS: Record<NonNullable<Employee["exitReason"]>, string> = {
  resignation: "İstifa",
  termination: "Fesih",
  contract_end: "Sözleşme bitimi",
  other: "Diğer",
};

function ExitEmployeeForm({
  employee,
  defaultMonth,
  onConfirm,
  onClose,
}: {
  employee: Employee;
  defaultMonth: string;
  onConfirm: (input: {
    exitDate: string;
    payrollEndMonth: string;
    exitReason: Employee["exitReason"];
    settlementNote: string;
    clearFutureRent: boolean;
  }) => void;
  onClose: () => void;
}) {
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10));
  const [payrollEndMonth, setPayrollEndMonth] = useState(defaultMonth);
  const [exitReason, setExitReason] = useState<Employee["exitReason"]>("resignation");
  const [settlementNote, setSettlementNote] = useState("");
  const [clearFutureRent, setClearFutureRent] = useState(true);
  const factor = payrollProrationFactor(
    { ...employee, payrollEndMonth, exitDate },
    payrollEndMonth,
  );
  const proratedBase = employee.baseSalary * factor;
  // Kira sabit aylık kalem; çıkış ayında orantılanmaz.
  const proratedRent = employee.rentSupport ?? 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm({
          exitDate,
          payrollEndMonth,
          exitReason,
          settlementNote,
          clearFutureRent,
        });
        onClose();
      }}
      className="space-y-4"
    >
      <div className="rounded-lg border border-amber-300/50 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
        <strong>{employee.name}</strong> için iş çıkışı kaydı oluşturulacak. Son bordro ayından sonra maaş ve kira kalemleri hesaplanmaz.
      </div>
      <FormGrid>
        <Field label="Ayrılış tarihi" required>
          <DateTimePicker mode="date" value={exitDate} onChange={setExitDate} />
        </Field>
        <Field label="Son bordro ayı (dahil)" required>
          <FInput type="month" value={payrollEndMonth} onChange={(e) => setPayrollEndMonth(e.target.value)} />
        </Field>
        <Field label="Ayrılış nedeni">
          <Select
            value={exitReason ?? "other"}
            onChange={(e) => setExitReason(e.target.value as Employee["exitReason"])}
            options={Object.entries(EXIT_REASON_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />
        </Field>
      </FormGrid>
      <div className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-xs space-y-1">
        <p className="font-medium">Son ay tahmini (oransal)</p>
        <p>Temel maaş: <strong>{fmt(proratedBase)}</strong>{factor < 1 ? ` (%${Math.round(factor * 100)} · ${exitDate})` : ""}</p>
        {employee.rentSupport > 0 && (
          <p>Kira desteği: <strong>{fmt(proratedRent)}</strong></p>
        )}
        <p className="text-muted-foreground">Açık avans ve içerik kalemleri ayrıca bordroda kalır; son ödemeyi tamamlayın.</p>
      </div>
      <Field label="Kapanış notu (opsiyonel)">
        <Textarea value={settlementNote} onChange={(e) => setSettlementNote(e.target.value)} rows={2} placeholder="Devir, ekipman iadesi, son ödeme detayı..." />
      </Field>
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <input type="checkbox" checked={clearFutureRent} onChange={(e) => setClearFutureRent(e.target.checked)} className="rounded" />
        Son aydan sonraki kira kalemlerini temizle
      </label>
      <FormActions onCancel={onClose} submitLabel="İş çıkışını kaydet" />
    </form>
  );
}

// ── Advance Form ──────────────────────────────────────────────────────────
function AdvanceForm({ employeeId, month, initial, onSave, onDelete, onClose }: {
  employeeId: string; month: string; initial?: Advance;
  onSave: (d: Omit<Advance, "id">) => void; onDelete?: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({ employeeId, month, amount: initial?.amount ?? 0, date: initial?.date ?? defaultSnapshotDateInMonth(month), description: initial?.description ?? "" });
  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Tutar ($)" required><NumberInput value={form.amount} onChange={v => set("amount", v)} required min={0} step={10} /></Field>
          <Field label="Tarih"><DateTimePicker mode="date" value={form.date} onChange={(v) => set("date", v)} /></Field>
        </FormGrid>
        <Field label="Açıklama"><FInput value={form.description} onChange={e => set("description", e.target.value)} placeholder="Avans sebebi..." /></Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Avans Ekle"} />
    </form>
  );
}

// ── Extra Form ────────────────────────────────────────────────────────────
function ExtraForm({ employeeId, month, initial, onSave, onDelete, onClose }: {
  employeeId: string; month: string; initial?: SalaryExtra;
  onSave: (d: Omit<SalaryExtra, "id">) => void; onDelete?: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({ employeeId, month, amount: initial?.amount ?? 0, description: initial?.description ?? "", type: initial?.type ?? "expense" as SalaryExtra["type"] });
  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form as Omit<SalaryExtra, "id">); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Tutar ($)" required><NumberInput value={form.amount} onChange={v => set("amount", v)} required min={0} step={10} /></Field>
          <Field label="Tip"><Select value={form.type} onChange={e => set("type", e.target.value)}
            options={[
              { value:"bonus",     label:"Prim/Bonus" },
              { value:"rent",      label:"Kira Desteği" },
              { value:"expense",   label:"Masraf" },
              { value:"deduction", label:"Kesinti" },
              { value:"other",     label:"Diğer" },
            ]} /></Field>
        </FormGrid>
        <Field label="Açıklama" required><FInput value={form.description} onChange={e => set("description", e.target.value)} required placeholder="Prim sebebi, masraf türü..." /></Field>
      </div>
      <FormActions onCancel={onClose} onDelete={onDelete} submitLabel={initial ? "Güncelle" : "Ekle"} />
    </form>
  );
}

/** Kart içi açılır/kapanır bölüm (uzun listeler için). */
function PayrollStatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "blue" | "green" | "amber" | "red" | "violet";
}) {
  const accentCls =
    accent === "blue"
      ? "text-blue-700 dark:text-blue-300"
      : accent === "green"
        ? "text-green-700 dark:text-green-300"
        : accent === "amber"
          ? "text-amber-700 dark:text-amber-300"
          : accent === "red"
            ? "text-red-700 dark:text-red-300"
            : accent === "violet"
              ? "text-violet-700 dark:text-violet-300"
              : "text-foreground";
  return (
    <div className="px-3 py-2.5 min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
      <p className={`text-sm font-semibold tabular-nums truncate ${accentCls}`}>{value}</p>
    </div>
  );
}

function PayrollCardSection({
  title,
  summary,
  defaultOpen = false,
  children,
  trailing,
  tone = "default",
}: {
  title: ReactNode;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  trailing?: ReactNode;
  tone?: "default" | "violet" | "emerald";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toneCls =
    tone === "violet"
      ? "bg-violet-50/40 dark:bg-violet-950/15"
      : tone === "emerald"
        ? "bg-emerald-50/40 dark:bg-emerald-950/20"
        : "";

  return (
    <div className={cn("border-t border-border/60", toneCls)}>
      <div className="flex w-full items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left hover:bg-accent/25 transition-colors rounded-md -mx-1 px-1 py-0.5"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <ChevronDown
            size={14}
            className={cn(
              "shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
          <span className="flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          {!open && summary ? (
            <span className="text-xs text-muted-foreground tabular-nums shrink-0 max-w-[55%] truncate text-right">
              {summary}
            </span>
          ) : null}
        </button>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {open ? <div className="px-4 pb-3 pt-0">{children}</div> : null}
    </div>
  );
}

// ── Employee detail card (monthly view) ───────────────────────────────────
function EmployeeDetailRow({
  employee,
  month: viewMonth,
  readOnly,
  currentUserId,
  onBulkRent,
}: {
  employee: Employee;
  month: string;
  readOnly: boolean;
  currentUserId?: string;
  onBulkRent?: (employeeId: string) => void;
}) {
  const { advances, salaryExtras, paymentStatuses, contentExpenses, kasas, kasaTransactions,
    updateEmployee, addAdvance, updateAdvance, deleteAdvance,
    addSalaryExtra, updateSalaryExtra, deleteSalaryExtra,
    payEmployeeSalary, unpayEmployeeSalary, payPayrollLine, unpayPayrollLine,
    markPayrollLinePaid, markEmployeePayrollLinesPaid,
    payContentExpense, settleContentExpenseToPayroll, unsettleContentExpenseFromPayroll,
  } = useStore();
  const { user } = useAuth();
  const canRamizWallet = canViewRamizWallet(user);
  const viewKasas = useMemo(
    () => filterKasasForRamizViewer(kasas, canRamizWallet),
    [kasas, canRamizWallet],
  );
  const viewKasaTransactions = useMemo(
    () => filterKasaTransactionsForRamizViewer(kasaTransactions, canRamizWallet),
    [kasaTransactions, canRamizWallet],
  );
  const enterStreamerPanel = usePanelView((s) => s.enterStreamerPanel);
  const router = useRouter();

  const [advModal, setAdvModal]     = useState<"new" | Advance | null>(null);
  const [extraModal, setExtraModal] = useState<"new" | SalaryExtra | null>(null);
  const [payTarget, setPayTarget] = useState<
    { mode: "line"; line: PayrollLineItem } | { mode: "all" } | null
  >(null);
  const [contentPayModalOpen, setContentPayModalOpen] = useState(false);
  const [payrollLinesModalOpen, setPayrollLinesModalOpen] = useState(false);

  const payrollMonth = useMemo(() => {
    if (isPayrollActive(employee, viewMonth)) return viewMonth;
    const end = employee.payrollEndMonth;
    if (end && viewMonth >= end) {
      const lines = buildPayrollPaymentLines(
        employee,
        end,
        advances,
        salaryExtras,
        contentExpenses,
        paymentStatuses,
      );
      if (lines.length > 0 && payrollPaymentPhase(lines) !== "full") return end;
    }
    return viewMonth;
  }, [employee, viewMonth, advances, salaryExtras, contentExpenses, paymentStatuses]);
  const finalPayrollCarryover = payrollMonth !== viewMonth && isPayrollActive(employee, payrollMonth);
  const month = payrollMonth;

  const active = isPayrollActive(employee, month);
  const upcoming = isPayrollUpcoming(employee, viewMonth);
  const firstPayrollNet = estimateFirstPayrollNet(employee);

  const empAdv     = advances.filter(a => a.employeeId === employee.id && a.month === month);
  const empExtras  = salaryExtras.filter(e => e.employeeId === employee.id && e.month === month);
  const carry      = calcCarryForward(employee.id, month, advances, paymentStatuses);
  const netBase    = calcNetPayable(employee, month, advances, salaryExtras, paymentStatuses);
  const net        = calcPayrollPayoutDue(employee, month, advances, salaryExtras, paymentStatuses, contentExpenses);
  const status     = paymentStatuses.find(p => p.employeeId === employee.id && p.month === month);
  const payrollLines = useMemo(
    () =>
      buildPayrollPaymentLines(
        employee,
        month,
        advances,
        salaryExtras,
        contentExpenses,
        paymentStatuses,
      ),
    [employee, month, advances, salaryExtras, contentExpenses, paymentStatuses],
  );
  const paymentPhase = payrollPaymentPhase(payrollLines);
  const isFullyPaid = paymentPhase === "full";
  const isPartial = paymentPhase === "partial";
  const unpaidLineTotal = sumUnpaidPayrollLines(payrollLines);
  const paidLineCount = payrollLines.filter((l) => l.paid).length;
  const hasManyPayrollLines = payrollLines.length > PAYROLL_LINES_INLINE_MAX;
  const openAdv    = calcOpenAdvanceBalance(employee, prevMonth(month), salaryExtras);
  const openAdvAfter = calcOpenAdvanceBalance(employee, month, salaryExtras);

  const totalAdv   = empAdv.reduce((s, a) => s + a.amount, 0);
  const totalRent  = active ? getRentForMonth(employee, month, salaryExtras) : 0;
  const rentFromExtrasOnly = empExtras.filter(e => e.type === "rent").reduce((s, e) => s + e.amount, 0);
  const totalBonus = empExtras.filter(e => e.type === "bonus" || e.type === "expense" || e.type === "other").reduce((s, e) => s + e.amount, 0);
  const totalDeduc = empExtras.filter(e => e.type === "deduction").reduce((s, e) => s + e.amount, 0);
  const contentAprv = sumApprovedContentExpenses(contentExpenses, employee.id, month);
  const contentPayroll = sumPayrollSettledContentExpenses(contentExpenses, employee.id, month);
  const plannedOut  = plannedPayrollPlusApprovedContent(employee, month, advances, salaryExtras, paymentStatuses, contentExpenses);
  const paidOut     = totalCashOutPaidForMonth(employee, month, advances, salaryExtras, paymentStatuses, contentExpenses);
  const amountDue = payrollAmountDue(net, unpaidLineTotal, isFullyPaid, paidOut, payrollLines);
  const monthContentExpenses = useMemo(
    () =>
      contentExpenses
        .filter((e) => e.employeeId === employee.id && e.month === month)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [contentExpenses, employee.id, month]
  );
  const paidContentItems = contentExpenses.filter(
    (e) =>
      e.employeeId === employee.id &&
      e.month === month &&
      e.paid &&
      e.reviewStatus !== "cancelled" &&
      e.reviewStatus !== "rejected",
  );
  const paidContentTotal = sumPaidContentExpenses(contentExpenses, employee.id, month);
  const extraSalaryItems = empExtras.filter(
    (e) => e.type === "bonus" || e.type === "expense" || e.type === "other"
  );
  const extraSalaryTotal = extraSalaryItems.reduce((s, e) => s + e.amount, 0);
  const advanceCashTotal = empAdv.reduce((s, a) => s + a.amount, 0);
  const buAyEkstraToplam = paidContentTotal + extraSalaryTotal + advanceCashTotal;
  const canEnterPanel =
    user?.role === "admin" &&
    (employee.kind === "streamer" || employee.kind === "moderator");

  const EXTRA_TYPE_LABEL: Record<string, string> = {
    bonus: "Prim",
    expense: "Masraf",
    other: "Diğer",
    rent: "Kira",
    deduction: "Kesinti",
  };

  const monthContentTotal = monthContentExpenses.reduce((s, e) => s + e.amountUsd, 0);
  const pendingContentCount = monthContentExpenses.filter(
    (e) => expenseReviewStatus(e) === "pending" || expenseReviewStatus(e) === "needs_info",
  ).length;
  const hasManyContent = monthContentExpenses.length > CONTENT_INLINE_MAX;
  const isHeavyCard = hasManyContent || hasManyPayrollLines;
  const payableContentCount = monthContentExpenses.filter(isUnsettledApprovedContent).length;
  const payableContentTotal = monthContentExpenses.filter(isUnsettledApprovedContent).reduce((s, e) => s + e.amountUsd, 0);

  const payContentFromKasaBulk = (
    ids: string[],
    opts: { kasaId: string; paidDate: string },
  ) => {
    for (const id of ids) {
      payContentExpense({
        contentExpenseId: id,
        kasaId: opts.kasaId,
        paidDate: opts.paidDate,
      });
    }
  };
  const [cardOpen, setCardOpen] = useState(!isHeavyCard);

  return (
    <>
      <div className={`rounded-xl border transition-colors ${
        upcoming               ? "border-violet-400/40 bg-violet-50/30 dark:border-violet-500/35 dark:bg-violet-950/20" :
        !active                ? "border-border bg-muted/40 opacity-70" :
        isFullyPaid            ? "border-green-500/30 bg-green-50/40 dark:border-green-500/40 dark:bg-green-950/25" :
        isPartial              ? "border-amber-400/50 bg-amber-50/35 dark:border-amber-500/40 dark:bg-amber-950/25" :
        "border-border bg-card"
      }`}>
        {/* Employee header — tutar ve ödeme aksiyonları dar kartlarda taşmasın diye iki satır */}
        <div className="px-4 py-3 border-b border-border/60 space-y-2">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setCardOpen((o) => !o)}
            className="shrink-0 p-0.5 rounded-md hover:bg-accent/50 text-muted-foreground transition-colors mt-0.5"
            aria-expanded={cardOpen}
            aria-label={cardOpen ? "Kartı daralt" : "Kartı genişlet"}
          >
            <ChevronDown
              size={18}
              className={cn("transition-transform duration-200", cardOpen && "rotate-180")}
            />
          </button>
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-bold">
              {employee.avatar || initials(employee.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <InlineEdit
                value={employee.name}
                onSave={v => updateEmployee(employee.id, { name: v })}
                className="font-semibold text-sm text-foreground"
                readOnly={readOnly}
              />
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {employee.kind === "streamer"    ? "Yayıncı"     :
                 employee.kind === "moderator"   ? "Moderatör"   :
                 employee.kind === "coordinator" ? "Koordinatör" : "Diğer"}
              </Badge>
              <Badge variant="outline" className="text-[10px] gap-1 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/40">
                <CalendarClock size={10} /> {employee.paymentDay}
              </Badge>
              {finalPayrollCarryover && (
                <Badge variant="outline" className="text-[10px] text-amber-800 border-amber-400/50 bg-amber-50/60 dark:text-amber-200">
                  Son bordro · {monthLabel(payrollMonth)}
                </Badge>
              )}
              {employee.status === "inactive" && active && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Ayrıldı
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-xs truncate mt-0.5">{employee.role} · {employee.department}</p>
            {upcoming && (
              <p className="text-violet-700 dark:text-violet-300 text-[11px] mt-1 leading-snug">
                İlk maaş 1–5 {monthLabelTr(employee.payrollStartMonth)} · tahmini {fmt(firstPayrollNet)}
                {employee.rentSupport > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({fmt(employee.baseSalary)} + {fmt(employee.rentSupport)} kira)
                  </span>
                )}
              </p>
            )}
            {employee.id === "emp-acelya" && month === "2026-05" && active && (
              <p className="text-violet-800 dark:text-violet-200 text-[11px] mt-1 leading-snug">
                Mayıs kira desteği {fmt(1550)} · avans {fmt(900)} (bu ay {fmt(300)} kesinti, 1/3)
                {" → "}
                <span className="font-medium">ilk ödeme {fmt(net)}</span>
                <span className="text-muted-foreground">
                  {" "}
                  ({fmt(3500)} maaş + {fmt(1550)} kira − {fmt(300)} · 1–5 Haziran · kalan avans{" "}
                  {fmt(openAdvAfter)})
                </span>
              </p>
            )}
            {employee.id === "emp-acelya" && month === "2026-06" && active && (
              <p className="text-violet-800 dark:text-violet-200 text-[11px] mt-1 leading-snug">
                29 Haziran iş çıkışı · floor(3.500 / 30 × 29) − kalan avans {fmt(600)}
                {" → "}
                <span className="font-medium">net maaş {fmt(2783)}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · kira {fmt(1550)} 5 Haziran&apos;da ödendi
                </span>
              </p>
            )}
            {employee.id === "emp-acelya" && active && month !== "2026-05" && month !== "2026-06" && openAdv > 0 && (
              <p className="text-violet-800 dark:text-violet-200 text-[11px] mt-1 leading-snug">
                Açık avans {fmt(openAdv)}
                {totalDeduc > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · bu ay {fmt(totalDeduc)} kesinti
                    {openAdvAfter < openAdv ? ` → kalan ${fmt(openAdvAfter)}` : ""}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pl-[calc(1.25rem+2.25rem)]">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {canEnterPanel && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1"
                onClick={() => {
                  enterStreamerPanel(employee.id, employee.name);
                  router.push("/yayinci/maas");
                }}
              >
                <ExternalLink size={11} />
                Panele gir
              </Button>
            )}
            {active && !readOnly && payrollLines.length > 0 && !isFullyPaid && (
              <Button
                type="button"
                size="sm"
                className="h-7 text-[10px] gap-1 bg-green-600 hover:bg-green-500 text-white border-0"
                onClick={() => setPayTarget({ mode: "all" })}
                disabled={unpaidLineTotal <= 0 && net <= 0}
              >
                <Wallet size={11} />
                Öde
              </Button>
            )}
            {active && !readOnly && payrollLines.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  "h-7 text-[10px] gap-1",
                  isFullyPaid &&
                    "text-green-700 border-green-500/40 bg-green-50/60 hover:bg-green-50 dark:text-green-300 dark:border-green-500/35 dark:bg-green-950/30",
                  isPartial &&
                    "text-amber-800 border-amber-400/50 bg-amber-50/60 dark:text-amber-200 dark:border-amber-500/40",
                )}
                onClick={() => setPayrollLinesModalOpen(true)}
              >
                <CheckCircle2 size={11} />
                {isFullyPaid
                  ? `Ödendi${status?.paidDate ? ` · ${status.paidDate}` : ""}`
                  : isPartial
                    ? `Kısmi · ${paidLineCount}/${payrollLines.length}`
                    : "Ödeme kalemleri"}
              </Button>
            )}
            {active && readOnly && isFullyPaid && (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 w-fit text-green-700 border-green-500/40 bg-green-50/60 dark:text-green-300 dark:border-green-500/35 dark:bg-green-950/30"
              >
                <CheckCircle2 size={10} />
                Ödendi{status?.paidDate ? ` · ${status.paidDate}` : ""}
              </Badge>
            )}
            {active && readOnly && isPartial && (
              <Badge variant="outline" className="text-[10px] text-amber-800 border-amber-400/50 bg-amber-50/60 dark:text-amber-200">
                Kısmi · {fmt(unpaidLineTotal)} kaldı
              </Badge>
            )}
          </div>
          <div className="text-right shrink-0 min-w-0">
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide mb-0.5">
              {active
                ? isFullyPaid
                  ? "Net ödendi"
                  : isPartial
                    ? "Kalan"
                    : "Net ödenecek"
                : upcoming
                  ? "İlk bordro"
                  : "Bordro pasif"}
            </p>
            <p
              className={`font-bold tabular-nums leading-tight ${
                upcoming ? "text-violet-700 dark:text-violet-300" :
                !active ? "text-muted-foreground" : isFullyPaid ? "text-green-600" : isPartial ? "text-amber-700 dark:text-amber-300" : "text-foreground"
              }`}
              style={{ fontSize: "clamp(1rem, 2.5vw, 1.25rem)" }}
            >
              {active
                ? fmt(amountDue)
                : upcoming
                  ? fmt(firstPayrollNet)
                  : "—"}
            </p>
          </div>
        </div>
        </div>

        {/* Kapalı kart özeti */}
        {active && !cardOpen && (
          <button
            type="button"
            onClick={() => setCardOpen(true)}
            className="w-full px-4 py-2 text-left text-xs border-b border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors"
          >
            <span className="text-muted-foreground">
              {monthContentExpenses.length > 0 && (
                <>
                  <span className="text-violet-700 dark:text-violet-300 font-medium">
                    {monthContentExpenses.length} içerik harcaması
                  </span>
                  {" · "}
                  <span className="tabular-nums">{fmt(monthContentTotal)}</span>
                  {pendingContentCount > 0 && (
                    <span className="text-amber-600"> · {pendingContentCount} incelemede</span>
                  )}
                  {" · "}
                </>
              )}
              {empAdv.length > 0 && <span>{empAdv.length} avans · </span>}
              {empExtras.length > 0 && <span>{empExtras.length} bordro kalemi · </span>}
              <span className="text-blue-600">Detayları göster</span>
            </span>
          </button>
        )}

        {cardOpen && active && (
          <div className="mx-4 mt-3 mb-1 rounded-xl border border-border/80 bg-muted/15 overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-border/50">
              <PayrollStatCell label="Temel maaş" value={fmt(employee.baseSalary)} />
              {totalRent > 0 && (
                <PayrollStatCell label="Kira desteği" value={fmt(totalRent)} accent="blue" />
              )}
              {totalDeduc > 0 && (
                <PayrollStatCell label="Kesinti" value={`−${fmt(totalDeduc)}`} accent="red" />
              )}
              {contentPayroll > 0 && (
                <PayrollStatCell label="İçerik (bordro)" value={fmt(contentPayroll)} accent="violet" />
              )}
              {carry > 0 && (
                <PayrollStatCell label="Devir avans" value={`−${fmt(carry)}`} accent="amber" />
              )}
              <PayrollStatCell
                label={isFullyPaid ? "Net ödendi" : isPartial ? "Kalan" : "Net ödenecek"}
                value={fmt(amountDue)}
                accent={isFullyPaid ? "green" : isPartial ? "amber" : undefined}
              />
            </div>
            {(openAdv > 0 || isPartial || contentAprv > 0) && (
              <div className="border-t border-border/50 px-3 py-2 text-[11px] text-muted-foreground space-y-1 bg-card/40">
                {openAdv > 0 && (
                  <p className="flex items-start gap-1.5">
                    <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Açık avans <strong className="tabular-nums text-foreground">{fmt(openAdv)}</strong>
                      {totalDeduc > 0 && openAdvAfter < openAdv && (
                        <> · bu ay <strong className="tabular-nums">{fmt(openAdv - openAdvAfter)}</strong> kapanıyor</>
                      )}
                    </span>
                  </p>
                )}
                {isPartial && (
                  <p>
                    Ödenen <strong className="tabular-nums text-green-700">{fmt(sumPaidPayrollLines(payrollLines))}</strong>
                    {" · "}
                    {formatPayrollLineStatusSummary(payrollLines)}
                  </p>
                )}
                {contentAprv > 0 && (
                  <p>
                    Onaylı bekleyen içerik: <strong className="tabular-nums text-violet-700">{fmt(contentAprv)}</strong>
                  </p>
                )}
              </div>
            )}
            {active && !readOnly && payrollLines.length > 0 && !isFullyPaid && (
              <div className="border-t border-border/50 px-3 py-2.5 flex flex-wrap items-center gap-2 bg-card/30">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Ödeme kalemleri
                </span>
                {payrollLines
                  .filter((l) => !l.paid)
                  .slice(0, isHeavyCard ? 2 : 4)
                  .map((line) => (
                    <Button
                      key={line.lineId}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] px-2"
                      onClick={() => setPayTarget({ mode: "line", line })}
                    >
                      {shortPayrollLineLabel(line)} · {fmt(line.amountUsd)}
                    </Button>
                  ))}
                {(payrollLines.filter((l) => !l.paid).length > (isHeavyCard ? 2 : 4) || payrollLines.length > 1) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] ml-auto"
                    onClick={() => setPayrollLinesModalOpen(true)}
                  >
                    Tüm kalemler ({payrollLines.length})
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {cardOpen && (
        <>
        <PayrollCardSection
          title="Avanslar & bordro kalemleri"
          summary={
            empAdv.length + empExtras.length > 0
              ? `${empAdv.length + empExtras.length} kalem`
              : "Boş"
          }
          defaultOpen={false}
        >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Avanslar</p>
              {active && !readOnly && <button onClick={() => setAdvModal("new")} className="text-[10px] text-blue-600 hover:text-blue-700 transition-colors">+ Avans</button>}
            </div>
            {empAdv.length === 0 ? (
              <p className="text-muted-foreground/50 text-xs italic">Avans yok</p>
            ) : (
              <div className="space-y-1">
                {empAdv.map(a => (
                  <div key={a.id} className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs truncate">{a.description || "Avans"} · {a.date}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-amber-600 text-xs tabular-nums font-medium">{fmt(a.amount)}</span>
                      {!readOnly && <button onClick={() => setAdvModal(a)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"><Pencil size={10} /></button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Kira / Prim / Kesinti</p>
              {active && !readOnly && (
                <div className="flex items-center gap-2">
                  {onBulkRent && (
                    <button
                      type="button"
                      onClick={() => onBulkRent(employee.id)}
                      className="text-[10px] text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Toplu kira
                    </button>
                  )}
                  <button onClick={() => setExtraModal("new")} className="text-[10px] text-blue-600 hover:text-blue-700 transition-colors">+ Ekle</button>
                </div>
              )}
            </div>
            {empExtras.length === 0 ? (
              active && employee.rentSupport > 0 ? (
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Sözleşme kira desteği: <span className="font-semibold tabular-nums">{fmt(employee.rentSupport)}</span>
                  <span className="text-muted-foreground"> · nete dahil, kalem henüz oluşturulmadı</span>
                </p>
              ) : (
                <p className="text-muted-foreground/50 text-xs italic">Kalem yok</p>
              )
            ) : (
              <div className="space-y-1">
                {empExtras.map(e => {
                  const sign = e.type === "deduction" ? "−" : "+";
                  const cls  = e.type === "deduction" ? "text-red-600"
                            : e.type === "rent"      ? "text-blue-600"
                            : "text-green-600";
                  return (
                    <div key={e.id} className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs truncate">{e.description}</span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className={`text-xs tabular-nums font-medium ${cls}`}>{sign}{fmt(e.amount)}</span>
                        {!readOnly && <button onClick={() => setExtraModal(e)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"><Pencil size={10} /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </PayrollCardSection>

        {active && monthContentExpenses.length > 0 && (
          <PayrollCardSection
            tone="violet"
            title={
              <span className="inline-flex items-center gap-1.5 text-violet-800 dark:text-violet-300">
                <Receipt size={11} />
                İçerik harcamaları ({monthContentExpenses.length})
              </span>
            }
            summary={`${fmt(monthContentTotal)}${pendingContentCount > 0 ? ` · ${pendingContentCount} bekliyor` : ""}`}
            defaultOpen={false}
            trailing={
              <div className="flex items-center gap-2">
                {!readOnly && user?.role === "admin" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-6 text-[10px] px-2 bg-violet-600 hover:bg-violet-500 text-white border-0"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setContentPayModalOpen(true);
                    }}
                  >
                    Ödemeleri yönet
                  </Button>
                )}
                <button
                  type="button"
                  className="text-[10px] text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    router.push(`/icerik-harcamalari?employee=${employee.id}&month=${month}`);
                  }}
                >
                  <ExternalLink size={10} />
                  Tümü
                </button>
              </div>
            }
          >
            {hasManyContent ? (
              <div className="space-y-2.5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {monthContentExpenses.length} harcama bu kartta listelenmiyor.
                  {payableContentCount > 0 && (
                    <>
                      {" "}
                      <strong className="text-green-700 dark:text-green-400 tabular-nums">
                        {payableContentCount} tanesi kasadan ödenebilir ({fmt(payableContentTotal)})
                      </strong>
                    </>
                  )}
                </p>
                <ul className="space-y-1 text-xs border border-border/50 rounded-md divide-y divide-border/40">
                  {monthContentExpenses.slice(0, 4).map((e) => (
                    <li key={e.id} className="flex justify-between gap-2 px-2.5 py-1.5">
                      <span className="min-w-0 truncate text-muted-foreground">
                        {e.date} · {e.brandName} · {e.description || e.category}
                      </span>
                      <span className="shrink-0 tabular-nums font-medium">{fmt(e.amountUsd)}</span>
                    </li>
                  ))}
                </ul>
                {monthContentExpenses.length > 4 && (
                  <p className="text-[10px] text-muted-foreground">
                    +{monthContentExpenses.length - 4} kayıt daha…
                  </p>
                )}
                {!readOnly && user?.role === "admin" && (
                  <Button
                    type="button"
                    size="sm"
                    className="w-full h-8 text-xs gap-1.5 bg-violet-600 hover:bg-violet-500 text-white border-0"
                    onClick={() => setContentPayModalOpen(true)}
                  >
                    <Receipt size={13} />
                    Ödemeleri yönet
                    {payableContentCount > 0 && (
                      <span className="opacity-90">
                        · {payableContentCount} ödenebilir
                      </span>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/50">
                      <th className="text-left py-1 pr-2 font-medium">Tarih</th>
                      <th className="text-left py-1 pr-2 font-medium">Marka</th>
                      <th className="text-right py-1 pr-2 font-medium">USD</th>
                      <th className="text-left py-1 font-medium">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthContentExpenses.map((e) => (
                      <tr key={e.id} className="border-b border-border/30 last:border-0">
                        <td className="py-1.5 pr-2 text-muted-foreground whitespace-nowrap">{e.date}</td>
                        <td className="py-1.5 pr-2 truncate max-w-[180px]" title={e.description}>
                          {e.brandName} · {e.description || e.category}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums font-medium">{fmt(e.amountUsd)}</td>
                        <td className="py-1.5 text-[10px] text-muted-foreground">{settlementLabel(e)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>Bekleyen onaylı: <strong className="tabular-nums">{fmt(contentAprv)}</strong></span>
              <span>Bordroya işli: <strong className="tabular-nums text-violet-700">{fmt(contentPayroll)}</strong></span>
              <span>Kasadan ödenen: <strong className="tabular-nums text-green-700">{fmt(paidContentTotal)}</strong></span>
            </p>
          </PayrollCardSection>
        )}

        {active && buAyEkstraToplam > 0 && (
          <PayrollCardSection
            tone="emerald"
            title="Bu ay ödenen ekstralar"
            summary={fmt(buAyEkstraToplam)}
            defaultOpen={false}
          >
            <div className="space-y-1 text-xs">
              {empAdv.map((a) => (
                <div key={a.id} className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate">
                    Avans · {a.description || a.date}
                  </span>
                  <span className="text-amber-700 dark:text-amber-400 tabular-nums font-medium shrink-0">
                    {fmt(a.amount)}
                  </span>
                </div>
              ))}
              {extraSalaryItems.map((e) => (
                <div key={e.id} className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate">
                    {EXTRA_TYPE_LABEL[e.type] ?? e.type} · {e.description}
                  </span>
                  <span className="text-green-700 dark:text-green-400 tabular-nums font-medium shrink-0">
                    {fmt(e.amount)}
                  </span>
                </div>
              ))}
              {paidContentItems.map((e) => (
                <div key={e.id} className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate">
                    İçerik (ödendi) · {e.description || e.category}
                  </span>
                  <span className="text-violet-700 dark:text-violet-400 tabular-nums font-medium shrink-0">
                    {fmt(e.amountUsd)}
                  </span>
                </div>
              ))}
            </div>
            {paidOut > 0 && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Toplam nakit çıkışı (maaş + içerik): <span className="font-medium tabular-nums">{fmt(paidOut)}</span>
              </p>
            )}
          </PayrollCardSection>
        )}

        {active && payrollLines.length > 0 && (
          <PayrollCardSection
            title={
              <span className="inline-flex items-center gap-1.5">
                <Wallet size={11} />
                Ödeme kalemleri ({payrollLines.length})
              </span>
            }
            summary={
              isFullyPaid
                ? `Tamamlandı · ${fmt(amountDue)}`
                : isPartial
                  ? `${formatPayrollLineStatusSummary(payrollLines)} · kalan ${fmt(unpaidLineTotal)}`
                  : `Bekliyor · ${fmt(amountDue)}`
            }
            defaultOpen={false}
            trailing={
              !readOnly ? (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-6 text-[10px] px-2 bg-green-600 hover:bg-green-500 text-white border-0"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setPayrollLinesModalOpen(true);
                  }}
                >
                  Yönet
                </Button>
              ) : undefined
            }
          >
            {hasManyPayrollLines ? (
              <div className="space-y-2.5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {payrollLines.length} ödeme kalemi kartta listelenmiyor.
                  {unpaidLineTotal > 0 && (
                    <>
                      {" "}
                      <strong className="text-amber-800 dark:text-amber-200 tabular-nums">
                        Kalan {fmt(unpaidLineTotal)}
                      </strong>
                      {" "}
                      ({payrollLines.length - paidLineCount} bekliyor)
                    </>
                  )}
                </p>
                <ul className="space-y-1 text-xs border border-border/50 rounded-md divide-y divide-border/40">
                  {payrollLines.slice(0, 3).map((line) => (
                    <li key={line.lineId} className="flex justify-between gap-2 px-2.5 py-1.5">
                      <span className="min-w-0 truncate text-muted-foreground">
                        {line.label}
                      </span>
                      <span className="shrink-0 tabular-nums font-medium flex items-center gap-1">
                        {fmt(line.amountUsd)}
                        {line.paid ? (
                          <CheckCircle2 size={10} className="text-green-600" />
                        ) : (
                          <Clock size={10} className="text-amber-600" />
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {payrollLines.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">
                    +{payrollLines.length - 3} kalem daha…
                  </p>
                )}
                {!readOnly && (
                  <Button
                    type="button"
                    size="sm"
                    className="w-full h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-500 text-white border-0"
                    onClick={() => setPayrollLinesModalOpen(true)}
                  >
                    <Wallet size={13} />
                    Ödemeleri yönet
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {payrollLines.map((line) => (
                  <div
                    key={line.lineId}
                    className={cn(
                      "flex justify-between gap-2 text-xs rounded-md border px-2.5 py-1.5",
                      line.paid
                        ? "border-green-200/60 bg-green-50/30 dark:border-green-500/30"
                        : "border-border bg-muted/15",
                    )}
                  >
                    <span className="truncate text-muted-foreground">{line.label}</span>
                    <span className="tabular-nums font-medium shrink-0">{fmt(line.amountUsd)}</span>
                  </div>
                ))}
                {!readOnly && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs mt-1"
                    onClick={() => setPayrollLinesModalOpen(true)}
                  >
                    Tüm kalemleri aç
                  </Button>
                )}
              </div>
            )}
          </PayrollCardSection>
        )}
        </>
        )}
      </div>

      {/* Modals */}
      <Modal open={advModal !== null} onClose={() => setAdvModal(null)} title={advModal === "new" ? "Avans Ekle" : "Avans Düzenle"} size="sm">
        <AdvanceForm employeeId={employee.id} month={month} initial={advModal !== "new" && advModal !== null ? advModal : undefined}
          onSave={d => { advModal === "new" ? addAdvance(d) : advModal !== null && updateAdvance(advModal.id, d); }}
          onDelete={advModal !== "new" && advModal !== null ? () => { deleteAdvance(advModal.id); setAdvModal(null); } : undefined}
          onClose={() => setAdvModal(null)} />
      </Modal>
      <Modal open={extraModal !== null} onClose={() => setExtraModal(null)} title={extraModal === "new" ? "Kalem Ekle" : "Kalemi Düzenle"} size="sm">
        <ExtraForm employeeId={employee.id} month={month} initial={extraModal !== "new" && extraModal !== null ? extraModal : undefined}
          onSave={d => { extraModal === "new" ? addSalaryExtra(d) : extraModal !== null && updateSalaryExtra(extraModal.id, d); }}
          onDelete={extraModal !== "new" && extraModal !== null ? () => { deleteSalaryExtra(extraModal.id); setExtraModal(null); } : undefined}
          onClose={() => setExtraModal(null)} />
      </Modal>
      <PayrollLinesPayModal
        open={payrollLinesModalOpen}
        onClose={() => setPayrollLinesModalOpen(false)}
        employee={employee}
        month={month}
        payrollLines={payrollLines}
        kasas={viewKasas}
        kasaTransactions={viewKasaTransactions}
        status={status}
        netPayable={amountDue}
        readOnly={readOnly}
        isFullyPaid={isFullyPaid}
        isPartial={isPartial}
        onPayLine={(line) => {
          setPayrollLinesModalOpen(false);
          setPayTarget({ mode: "line", line });
        }}
        onPayAll={() => {
          setPayrollLinesModalOpen(false);
          setPayTarget({ mode: "all" });
        }}
        onMarkLinePaid={(line, paidDate) => {
          markPayrollLinePaid({
            employeeId: employee.id,
            month,
            lineId: line.lineId,
            paidDate,
            paidBy: currentUserId,
          });
        }}
        onMarkAllPaid={(paidDate) => {
          if (
            window.confirm(
              `${employee.name} · ${monthLabelTr(month)} bekleyen tüm kalemler ödendi olarak işaretlensin mi? (Kasa hareketi oluşturulmaz.)`,
            )
          ) {
            markEmployeePayrollLinesPaid({
              employeeId: employee.id,
              month,
              paidDate,
              paidBy: currentUserId,
            });
          }
        }}
        onUnpayLine={(lineId, label) => {
          if (
            window.confirm(
              `"${label}" ödemesi geri alınsın mı? Bağlı kasa hareketi silinir.`,
            )
          ) {
            unpayPayrollLine(employee.id, month, lineId);
          }
        }}
        onUnpayAll={() => {
          if (
            window.confirm(
              "Tüm ödemeler geri alınsın mı? Bağlı kasa hareketleri silinir.",
            )
          ) {
            unpayEmployeeSalary(employee.id, month);
            setPayrollLinesModalOpen(false);
          }
        }}
      />

      <ContentExpensesBulkModal
        open={contentPayModalOpen}
        onClose={() => setContentPayModalOpen(false)}
        employee={employee}
        month={month}
        expenses={monthContentExpenses}
        kasas={viewKasas}
        kasaTransactions={viewKasaTransactions}
        readOnly={readOnly}
        isAdmin={user?.role === "admin"}
        onPayFromKasa={payContentFromKasaBulk}
        onSettleToPayroll={settleContentExpenseToPayroll}
        onUnsettlePayroll={unsettleContentExpenseFromPayroll}
        onOpenReview={(id) => {
          setContentPayModalOpen(false);
          router.push(`/icerik-harcamalari?review=${id}`);
        }}
      />

      <Modal
        open={payTarget !== null}
        onClose={() => setPayTarget(null)}
        title={
          payTarget?.mode === "line"
            ? `Ödeme · ${payTarget.line.label}`
            : isPartial
              ? "Kalan kalemleri öde"
              : "Maaş ödemesi (tüm kalemler)"
        }
        size="md"
      >
        <PaySalaryForm
          key={
            payTarget?.mode === "line"
              ? payTarget.line.lineId
              : payTarget?.mode === "all"
                ? "all"
                : "closed"
          }
          employeeName={employee.name}
          month={month}
          netAmount={
            payTarget?.mode === "line"
              ? payTarget.line.amountUsd
              : amountDue
          }
          lineLabel={payTarget?.mode === "line" ? payTarget.line.label : undefined}
          kasas={viewKasas}
          kasaTransactions={viewKasaTransactions}
          onSave={(d) => {
            if (payTarget?.mode === "line") {
              payPayrollLine({
                employeeId: employee.id,
                month,
                lineId: payTarget.line.lineId,
                amountUsd: d.amountUsd,
                kasaId: d.kasaId,
                paidDate: d.paidDate,
                feeUsd: d.feeUsd,
                notes: d.notes,
                proof: d.proof,
                paidBy: currentUserId,
              });
            } else {
              payEmployeeSalary({
                employeeId: employee.id,
                month,
                amountUsd: d.amountUsd,
                kasaId: d.kasaId,
                paidDate: d.paidDate,
                feeUsd: d.feeUsd,
                notes: d.notes,
                proof: d.proof,
                paidBy: currentUserId,
              });
            }
          }}
          onClose={() => setPayTarget(null)}
        />
      </Modal>
    </>
  );
}

// ── Pay salary modal ──────────────────────────────────────────────────────
function PaySalaryForm({
  employeeName, month, netAmount, lineLabel, kasas, kasaTransactions, onSave, onClose,
}: {
  employeeName: string;
  month: string;
  netAmount: number;
  lineLabel?: string;
  kasas: Kasa[];
  kasaTransactions: KasaTransaction[];
  onSave: (d: {
    amountUsd: number;
    kasaId: string;
    paidDate: string;
    feeUsd: number;
    notes: string;
    proof: string;
  }) => void;
  onClose: () => void;
}) {
  const activeKasas = useMemo(
    () => kasas.filter((k) => !k.archived).sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name)),
    [kasas]
  );
  const defaultKasaId = activeKasas.find((k) => k.isDefault)?.id ?? activeKasas[0]?.id ?? DEFAULT_KASA_ID;

  const [kasaId, setKasaId]       = useState(defaultKasaId);
  const [amountUsd, setAmountUsd] = useState(netAmount);
  const [feeUsd, setFeeUsd]       = useState(0);
  const [paidDate, setPaidDate]   = useState(() => defaultSnapshotDateInMonth(month));
  const [notes, setNotes]         = useState("");
  const [proof, setProof]         = useState("");

  const tronPanel = useMemo(
    () => computeTronPanelMetrics(kasas, kasaTransactions),
    [kasas, kasaTransactions],
  );

  const balanceBefore = useMemo(
    () => kasaPaymentBalance(kasaId, kasas, kasaTransactions, tronPanel),
    [kasas, kasaTransactions, kasaId, tronPanel],
  );
  const balanceAfter = balanceBefore - amountUsd - feeUsd;
  const lowBalance = balanceAfter < 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (lowBalance) {
          const ok = window.confirm(
            "Seçili kasanın bakiyesi bu ödemeyi karşılamıyor; yine de devam edilsin mi?"
          );
          if (!ok) return;
        }
        onSave({ amountUsd, kasaId, paidDate, feeUsd, notes, proof });
        onClose();
      }}
    >
      <div className="grid gap-4">
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{employeeName}</span> · {month} bordrosu
          {lineLabel ? (
            <>
              {" "}
              · kalem: <span className="font-medium text-foreground">{lineLabel}</span>
            </>
          ) : (
            " · tüm kalemler"
          )}
          {" "}
          · önerilen tutar{" "}
          <span className="tabular-nums font-medium text-foreground">{fmt(netAmount)}</span>
        </div>
        <FormGrid>
          <Field label="Kasa" required hint="Tutar bu kasadan düşülür">
            <Select
              value={kasaId}
              onChange={(e) => setKasaId(e.target.value)}
              required
              options={activeKasas.map((k) => ({
                value: k.id,
                label: kasaSelectOptionLabel(k, kasas, kasaTransactions, tronPanel),
              }))}
            />
          </Field>
          <Field label="Ödeme tarihi" required>
            <DateTimePicker mode="date" value={paidDate} onChange={(v) => setPaidDate(v)} required />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Tutar (USD)" required>
            <NumberInput value={amountUsd} onChange={(v) => setAmountUsd(v)} required min={0} step={0.01} />
          </Field>
          <Field label="Network fee (USDT)" hint="TRC20 ≈ $4">
            <NumberInput value={feeUsd} onChange={(v) => setFeeUsd(v)} min={0} step={0.01} />
          </Field>
        </FormGrid>
        <Field label="Kanıt (TXID / dekont / ekran görüntüsü)">
          <ProofUploader
            value={proof}
            onChange={setProof}
            folder="kasa"
            placeholder="TXID, https://... veya resim yükle"
          />
        </Field>
        <Field label="Notlar">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Açıklama, ödeme yöntemi vb." />
        </Field>
        <div className={`rounded-lg border px-4 py-2.5 text-xs ${
          lowBalance
            ? "border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-950/30 dark:text-red-300"
            : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-950/30 dark:text-emerald-200"
        }`}>
          Bakiye: <span className="font-medium tabular-nums">{fmt(balanceBefore)}</span>
          {" → "}
          <span className="font-medium tabular-nums">{fmt(balanceAfter)}</span>
          {lowBalance && " · bakiye yetersiz"}
          {tronPanel?.genelKasa?.id === kasaId && ((tronPanel.includedTronOut ?? 0) > 0 || (tronPanel.includedTronIn ?? 0) > 0) && (
            <span className="block mt-1 opacity-90">
              Genel Kasa işletme bakiyesi
              {(tronPanel.includedTronOut ?? 0) > 0 && ` · TRON gider −${fmt(tronPanel.includedTronOut)}`}
              {(tronPanel.includedTronIn ?? 0) > 0 && ` · TRON gelir +${fmt(tronPanel.includedTronIn)}`}
            </span>
          )}
        </div>
      </div>
      <FormActions onCancel={onClose} submitLabel="Onayla ve Kasadan Düş" />
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function MaaslarPage() {
  const { user } = useAuth();
  const canRamizWallet = canViewRamizWallet(user);
  const {
    employees, advances, salaryExtras, paymentStatuses, contentExpenses,
    addEmployee, updateEmployee, deleteEmployee, processEmployeeExit,
    markEmployeePayrollLinesPaid,
  } = useStore();
  const readOnly = useIsReadOnly("write.payroll");
  const [month, setMonth]     = useState(() => toYearMonthLocal(new Date()));
  const [search, setSearch]   = useState("");
  const [empModal, setEmpModal] = useState<"new" | Employee | null>(null);
  const [exitModal, setExitModal] = useState<Employee | null>(null);
  const [bulkRent, setBulkRent] = useState<{ employeeId?: string } | null>(null);

  const bordrolu = employees.filter(e => e.kind !== "coordinator" && e.status === "active");
  const payrollCardEmployees = useMemo(
    () =>
      employees.filter(
        (e) =>
          employeePayrollMonthForView(
            e,
            month,
            advances,
            salaryExtras,
            contentExpenses,
            paymentStatuses,
          ) !== null,
      ),
    [employees, month, advances, salaryExtras, contentExpenses, paymentStatuses],
  );
  const aktifBuAy = payrollCardEmployees.filter((e) => {
    const pm =
      employeePayrollMonthForView(
        e,
        month,
        advances,
        salaryExtras,
        contentExpenses,
        paymentStatuses,
      ) ?? month;
    return isPayrollActive(e, pm);
  });
  const totalBase = aktifBuAy.reduce((s, e) => s + e.baseSalary, 0);
  const totalNet  = aktifBuAy.reduce((s, e) => {
    const pm =
      employeePayrollMonthForView(
        e,
        month,
        advances,
        salaryExtras,
        contentExpenses,
        paymentStatuses,
      ) ?? month;
    const lines = buildPayrollPaymentLines(
      e,
      pm,
      advances,
      salaryExtras,
      contentExpenses,
      paymentStatuses,
    );
    return s + payrollAmountDue(
      calcPayrollPayoutDue(e, pm, advances, salaryExtras, paymentStatuses, contentExpenses),
      sumUnpaidPayrollLines(lines),
      payrollPaymentPhase(lines) === "full",
      totalCashOutPaidForMonth(e, pm, advances, salaryExtras, paymentStatuses, contentExpenses),
      lines,
    );
  }, 0);
  const paidCnt   = aktifBuAy.filter((e) => {
    const pm =
      employeePayrollMonthForView(
        e,
        month,
        advances,
        salaryExtras,
        contentExpenses,
        paymentStatuses,
      ) ?? month;
    const lines = buildPayrollPaymentLines(
      e,
      pm,
      advances,
      salaryExtras,
      contentExpenses,
      paymentStatuses,
    );
    return lines.length > 0 && payrollPaymentPhase(lines) === "full";
  }).length;
  const openAdvTotal = bordrolu.reduce((s, e) => s + calcOpenAdvanceBalance(e, month, salaryExtras), 0);

  const totalContentAprv = aktifBuAy.reduce((s, e) => s + sumApprovedContentExpenses(contentExpenses, e.id, month), 0);
  const totalPlannedOut  = aktifBuAy.reduce((s, e) => s + plannedPayrollPlusApprovedContent(e, month, advances, salaryExtras, paymentStatuses, contentExpenses), 0);
  const totalPaidOutAll  = aktifBuAy.reduce((s, e) => s + totalCashOutPaidForMonth(e, month, advances, salaryExtras, paymentStatuses, contentExpenses), 0);

  const monthUnpaidEmployeeCount = useMemo(() => {
    return payrollCardEmployees.filter((emp) => {
      const pm =
        employeePayrollMonthForView(
          emp,
          month,
          advances,
          salaryExtras,
          contentExpenses,
          paymentStatuses,
        ) ?? month;
      const lines = buildPayrollPaymentLines(
        emp,
        pm,
        advances,
        salaryExtras,
        contentExpenses,
        paymentStatuses,
      );
      return lines.length > 0 && payrollPaymentPhase(lines) !== "full";
    }).length;
  }, [payrollCardEmployees, month, advances, salaryExtras, contentExpenses, paymentStatuses]);

  const markEntireMonthPaid = () => {
    const targets = payrollCardEmployees.filter((emp) => {
      const pm =
        employeePayrollMonthForView(
          emp,
          month,
          advances,
          salaryExtras,
          contentExpenses,
          paymentStatuses,
        ) ?? month;
      const lines = buildPayrollPaymentLines(
        emp,
        pm,
        advances,
        salaryExtras,
        contentExpenses,
        paymentStatuses,
      );
      return lines.some((l) => !l.paid);
    });
    if (targets.length === 0) {
      window.alert(`${monthLabelTr(month)} için işaretlenecek bekleyen kalem yok.`);
      return;
    }
    const ok = window.confirm(
      `${monthLabelTr(month)} · ${targets.length} çalışanın bekleyen tüm bordro kalemleri ödendi olarak işaretlensin mi?\n\nKasa hareketi oluşturulmaz — yalnızca kayıt güncellenir.`,
    );
    if (!ok) return;
    const paidDate = toDateLocal(new Date());
    for (const emp of targets) {
      const pm =
        employeePayrollMonthForView(
          emp,
          month,
          advances,
          salaryExtras,
          contentExpenses,
          paymentStatuses,
        ) ?? month;
      markEmployeePayrollLinesPaid({
        employeeId: emp.id,
        month: pm,
        paidDate,
        paidBy: user?.id,
      });
    }
  };

  const sorted = useMemo(() => [...employees].sort((a, b) => {
    const ka = a.kind === "coordinator" ? 1 : 0;
    const kb = b.kind === "coordinator" ? 1 : 0;
    if (ka !== kb) return ka - kb;
    return b.baseSalary - a.baseSalary;
  }), [employees]);

  const filtered = sorted.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase())
  );

  const saveEmployee = (id: string, data: Omit<Employee, "id">) => {
    // updateEmployee: rentSupport değişince bu ay + sonraki ayların kira kalemlerini günceller.
    updateEmployee(id, data);
  };

  const availableMonths = useMemo(
    () => listAvailableMonths([
      ...advances.map((a) => a.month + "-01"),
      ...salaryExtras.map((s) => s.month + "-01"),
      ...paymentStatuses.map((p) => p.month + "-01"),
      month + "-01",
    ]),
    [advances, salaryExtras, paymentStatuses, month]
  );

  const buildRowsForMonth = (ym: string): SalaryReportRow[] => {
    const eligible = employees.filter((e) => e.kind !== "coordinator" && isPayrollActive(e, ym));
    return eligible.map((emp) => {
      const empAdv  = advances.filter((a) => a.employeeId === emp.id && a.month === ym);
      const empExt  = salaryExtras.filter((e) => e.employeeId === emp.id && e.month === ym);
      const carry   = calcCarryForward(emp.id, ym, advances, paymentStatuses);
      const rentAmt   = getRentForMonth(emp, ym, salaryExtras);
      const totalBonus = empExt
        .filter(
          (e) =>
            e.type !== "deduction" &&
            e.type !== "rent" &&
            !e.contentExpenseId,
        )
        .reduce((s, e) => s + e.amount, 0);
      const ded     = empExt.filter((e) => e.type === "deduction").reduce((s, e) => s + e.amount, 0);
      const status  = paymentStatuses.find((p) => p.employeeId === emp.id && p.month === ym);
      return {
        name:             emp.name,
        role:             emp.role,
        department:       emp.department,
        paymentDay:       emp.paymentDay,
        baseSalary:       emp.baseSalary,
        rentSupport:      rentAmt,
        carryForward:     carry,
        thisMonthAdvance: empAdv.reduce((s, a) => s + a.amount, 0),
        openAdvanceAfter: calcOpenAdvanceBalance(emp, ym, salaryExtras),
        totalBonus,
        totalDeduction:   ded,
        netPayable:       calcPayrollPayoutDue(emp, ym, advances, salaryExtras, paymentStatuses, contentExpenses),
        contentApproved:  sumApprovedContentExpenses(contentExpenses, emp.id, ym),
        contentPayrollSettled: sumPayrollSettledContentExpenses(contentExpenses, emp.id, ym),
        plannedTotalOut:  plannedPayrollPlusApprovedContent(emp, ym, advances, salaryExtras, paymentStatuses, contentExpenses),
        totalPaidOut:     totalCashOutPaidForMonth(emp, ym, advances, salaryExtras, paymentStatuses, contentExpenses),
        paid:             status?.paid ?? false,
        paidDate:         status?.paidDate,
        walletAddress:
          emp.id === RAMIZ_EMPLOYEE_ID && !canRamizWallet ? "" : emp.walletAddress,
      };
    });
  };

  const buildUpcomingRowsForMonth = (ym: string): SalaryUpcomingRow[] =>
    employees
      .filter((e) => e.kind !== "coordinator" && isPayrollUpcoming(e, ym))
      .map((e) => ({
        name: e.name,
        role: e.role,
        paymentDay: e.paymentDay,
        payrollStartMonth: e.payrollStartMonth,
        estimatedNet: estimateFirstPayrollNet(e),
      }));

  const canExport = user?.role === "admin" || user?.role === "auditor";

  const exportBordro = (ym: string, kind: "pdf" | "csv") => {
    const rows = buildRowsForMonth(ym);
    if (rows.length === 0) {
      const go = window.confirm(
        `${monthLabelTr(ym)} için bordrolu çalışan yok.\n\nYine de boş rapor indirmek ister misiniz?`,
      );
      if (!go) return;
    }
    const bordroluIds = employees.filter((e) => e.kind !== "coordinator");
    const contentLines = buildSalaryContentExportLines(
      ym,
      bordroluIds.map((e) => ({ id: e.id, name: e.name })),
      contentExpenses,
    );
    const upcomingRows = buildUpcomingRowsForMonth(ym);
    if (kind === "pdf") {
      exportSalaryMonthPdf(rows, ym, {
        generatedBy: user?.name,
        contentLines,
        upcomingRows,
      });
    } else {
      exportSalaryMonthCsv(rows, ym);
    }
  };

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Maaşlar</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {payrollMonthLongTitle(month)} bordrosu · ödeme günü kartlarda (çoğu 1–5, özel: 17.) — tutarlar bu aya aittir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <MonthlyExportMenu
              month={month}
              availableMonths={availableMonths}
              label="Bordro indir"
              onExportPdf={(ym) => exportBordro(ym, "pdf")}
              onExportCsv={(ym) => exportBordro(ym, "csv")}
            />
          )}
          {!readOnly && (
            <>
              {monthUnpaidEmployeeCount > 0 && (
                <Button
                  onClick={markEntireMonthPaid}
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                >
                  <Stamp size={14} />
                  {monthLabel(month)} ödendi işaretle
                </Button>
              )}
              <Button
                onClick={() => setBulkRent({})}
                size="sm"
                variant="outline"
                className="gap-1.5"
              >
                <Home size={14} /> Toplu kira
              </Button>
              <Button onClick={() => setEmpModal("new")} size="sm" className="gap-1.5">
                <Plus size={14} /> Çalışan Ekle
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        {[
          { label: "Bu Ay Bordrolu",     value: String(aktifBuAy.length), cls: "text-foreground" },
          { label: "Temel Maaş Toplamı", value: fmt(totalBase),           cls: "text-foreground" },
          { label: "Net Ödenecek",       value: fmt(totalNet),            cls: "text-foreground font-bold" },
          { label: "İçerik (onaylı)",    value: fmt(totalContentAprv),    cls: totalContentAprv > 0 ? "text-violet-600" : "text-muted-foreground" },
          { label: "Plan Toplamı",       value: fmt(totalPlannedOut),     cls: "text-foreground", sub: "Net + onaylı içerik" },
          { label: "Ödenen Toplam",      value: fmt(totalPaidOutAll),     cls: "text-green-700 font-bold", sub: "İşaretli maaş + ödenen içerik" },
          { label: "Bekleyen Ödeme",     value: `${aktifBuAy.length - paidCnt}/${aktifBuAy.length}`, cls: paidCnt === aktifBuAy.length ? "text-green-600" : "text-amber-600" },
          { label: "Açık Avans",         value: fmt(openAdvTotal),        cls: openAdvTotal > 0 ? "text-amber-600" : "text-muted-foreground" },
        ].map(k => (
          <div key={k.label} className="border border-border rounded-xl px-4 py-3 bg-card">
            <p className="text-muted-foreground text-xs mb-1">{k.label}</p>
            <p className={`text-xl tabular-nums ${k.cls}`}>{k.value}</p>
            {"sub" in k && k.sub ? <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{k.sub}</p> : null}
          </div>
        ))}
      </div>

      {/* Month nav + search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden">
          <button onClick={() => setMonth(prevMonth(month))} className="px-2 py-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={15} /></button>
          <span className="px-4 py-1.5 text-sm font-medium min-w-[140px] text-center border-x border-border">{monthLabel(month)}</span>
          <button onClick={() => setMonth(nextMonth(month))} className="px-2 py-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronRight size={15} /></button>
        </div>
        <Input
          placeholder="Çalışan ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-52 h-8 text-sm"
        />
      </div>

      {/* Monthly cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        {payrollCardEmployees
          .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
          .map(emp => (
            <EmployeeDetailRow
              key={emp.id}
              employee={emp}
              month={month}
              readOnly={readOnly}
              currentUserId={user?.id}
              onBulkRent={readOnly ? undefined : (id) => setBulkRent({ employeeId: id })}
            />
          ))}
      </div>

      <Separator className="mb-6" />

      {/* All employees table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Tüm Çalışanlar</p>
          <p className="text-xs text-muted-foreground">{employees.length} kayıt · {bordrolu.length} bordrolu</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["","Ad / Takma Ad","Rol","Tip","Temel maaş","Kira (ay)","Açık Avans","Ödeme Günü","Bordro Başl.","Net (ay)","İçerik onay","Plan","Ödenen","Cüzdan","Durum",""].map((h, i) => (
                  <th key={i} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => {
                const payrollPm = employeePayrollMonthForView(
                  emp,
                  month,
                  advances,
                  salaryExtras,
                  contentExpenses,
                  paymentStatuses,
                );
                const openAdv = calcOpenAdvanceBalance(emp, month, salaryExtras);
                const kiraAy = payrollPm && isPayrollActive(emp, payrollPm)
                  ? getRentForMonth(emp, payrollPm, salaryExtras)
                  : 0;
                const kiraKalem = payrollPm
                  ? salaryExtras
                      .filter(e => e.employeeId === emp.id && e.month === payrollPm && e.type === "rent")
                      .reduce((s, e) => s + e.amount, 0)
                  : 0;
                const upcomingAy = isPayrollUpcoming(emp, month);
                const netLines = payrollPm
                  ? buildPayrollPaymentLines(
                      emp,
                      payrollPm,
                      advances,
                      salaryExtras,
                      contentExpenses,
                      paymentStatuses,
                    )
                  : [];
                const netAy = payrollPm
                  ? payrollAmountDue(
                      calcPayrollPayoutDue(
                        emp,
                        payrollPm,
                        advances,
                        salaryExtras,
                        paymentStatuses,
                        contentExpenses,
                      ),
                      sumUnpaidPayrollLines(netLines),
                      payrollPaymentPhase(netLines) === "full",
                      totalCashOutPaidForMonth(
                        emp,
                        payrollPm,
                        advances,
                        salaryExtras,
                        paymentStatuses,
                        contentExpenses,
                      ),
                      netLines,
                    )
                  : 0;
                const icAy = payrollPm
                  ? sumApprovedContentExpenses(contentExpenses, emp.id, payrollPm)
                  : 0;
                const planAy = payrollPm
                  ? plannedPayrollPlusApprovedContent(
                      emp,
                      payrollPm,
                      advances,
                      salaryExtras,
                      paymentStatuses,
                      contentExpenses,
                    )
                  : 0;
                const odenAy = payrollPm
                  ? totalCashOutPaidForMonth(
                      emp,
                      payrollPm,
                      advances,
                      salaryExtras,
                      paymentStatuses,
                      contentExpenses,
                    )
                  : 0;
                const netCarryover = payrollPm !== null && payrollPm !== month;
                return (
                <tr key={emp.id} className="border-b border-border/60 hover:bg-accent/30 transition-colors">
                  <td className="px-3 py-3 w-10">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-bold">{emp.avatar || initials(emp.name)}</AvatarFallback>
                    </Avatar>
                  </td>
                  <td className="px-3 py-3 font-medium text-foreground whitespace-nowrap">
                    <InlineEdit value={emp.name} onSave={v => updateEmployee(emp.id, { name: v })} className="font-medium text-foreground" readOnly={readOnly} />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                    <InlineEdit value={emp.role} onSave={v => updateEmployee(emp.id, { role: v })} className="text-sm" readOnly={readOnly} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      {emp.kind === "streamer"    ? "Yayıncı"     :
                       emp.kind === "moderator"   ? "Moderatör"   :
                       emp.kind === "coordinator" ? "Koordinatör" : "Diğer"}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 tabular-nums font-medium whitespace-nowrap">{fmt(emp.baseSalary)}</td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                    {kiraAy > 0 ? (
                      kiraKalem > 0 ? (
                        <span className="text-blue-600">{fmt(kiraAy)}</span>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="text-blue-600">{fmt(kiraAy)}</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">Kira kalemi yok; sözleşme tutarı (net ile uyumlu)</TooltipContent>
                        </Tooltip>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                    {openAdv > 0 ? <span className="text-amber-600 font-medium">{fmt(openAdv)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <CalendarClock size={11} /> {emp.paymentDay}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">{emp.payrollStartMonth}</td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                    {payrollPm ? (
                      netCarryover ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="text-amber-700 dark:text-amber-300 font-medium">{fmt(netAy)}</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {monthLabel(payrollPm)} son bordro · {monthLabel(month)} ödemesi
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        fmt(netAy)
                      )
                    ) : upcomingAy ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-violet-700 dark:text-violet-300 font-medium">
                            {fmt(estimateFirstPayrollNet(emp))}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          İlk maaş 1–5 {monthLabelTr(emp.payrollStartMonth)}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                    {icAy > 0 ? <span className="text-violet-600">{fmt(icAy)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums font-medium whitespace-nowrap">{planAy > 0 ? fmt(planAy) : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-3 tabular-nums font-semibold text-green-700 whitespace-nowrap">{odenAy > 0 ? fmt(odenAy) : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-3">
                    {emp.id === RAMIZ_EMPLOYEE_ID && !canRamizWallet ? (
                      <span className="text-muted-foreground text-xs italic">Gizli</span>
                    ) : emp.walletAddress ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="font-mono text-xs text-muted-foreground">
                            {emp.walletAddress.slice(0,6)}…{emp.walletAddress.slice(-4)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="font-mono text-xs max-w-xs break-all">{emp.walletAddress}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <InlineEdit value={emp.walletAddress || ""} onSave={v => updateEmployee(emp.id, { walletAddress: v })} className="text-muted-foreground/50 text-xs italic" mono readOnly={readOnly} />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="outline" className={emp.status === "active" ? "text-green-600 border-green-500/30" : "text-muted-foreground"}>
                      {emp.status === "active" ? "Aktif" : "Pasif"}
                    </Badge>
                    {emp.payrollEndMonth && (
                      <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
                        Çıkış: {emp.exitDate ?? "—"} · son bordro {emp.payrollEndMonth}
                      </p>
                    )}
            {paymentStatuses.find(p => p.employeeId === emp.id && p.month === month)?.paidBy && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Onay: {paymentStatuses.find(p => p.employeeId === emp.id && p.month === month)?.approvedAt?.slice(0, 10)}
              </p>
            )}
                  </td>
                  <td className="px-3 py-3">
                    {!readOnly && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEmpModal(emp)}
                          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                          aria-label="Çalışanı düzenle"
                        >
                          <Pencil size={13} />
                        </button>
                        {emp.status === "active" && !emp.payrollEndMonth && (
                          <button
                            type="button"
                            onClick={() => setExitModal(emp)}
                            className="text-muted-foreground/40 hover:text-amber-600 transition-colors"
                            aria-label="İş çıkışı"
                            title="İş çıkışı kaydet"
                          >
                            <UserMinus size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={empModal !== null} onClose={() => setEmpModal(null)} title={empModal === "new" ? "Yeni Çalışan" : "Çalışanı Düzenle"}>
        <EmployeeForm
          initial={empModal !== "new" && empModal !== null ? empModal : undefined}
          hideWallet={empModal !== "new" && empModal !== null && empModal.id === RAMIZ_EMPLOYEE_ID && !canRamizWallet}
          onSave={d => {
            if (empModal === "new") {
              addEmployee(d);
              // Yeni personel için takvimli onboarding görev planı öner.
              if (window.confirm(`${d.name} için onboarding görev planı (takvimli) oluşturulsun mu?\n\nGörevler panosunda (sözleşme, erişim, tanışma, ilk içerik, 30 gün değerlendirme) listelenir.`)) {
                void fetch("/api/tasks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    template: "onboarding",
                    subjectName: d.name,
                    startDate: d.startDate || new Date().toISOString().slice(0, 10),
                  }),
                }).catch(() => {});
              }
            } else if (empModal !== null) {
              saveEmployee(empModal.id, d);
            }
          }}
          onDelete={empModal !== "new" && empModal !== null ? () => { deleteEmployee(empModal.id); setEmpModal(null); } : undefined}
          onClose={() => setEmpModal(null)}
        />
      </Modal>

      <Modal open={exitModal !== null} onClose={() => setExitModal(null)} title="İş çıkışı kaydı" size="md">
        {exitModal && (
          <ExitEmployeeForm
            employee={exitModal}
            defaultMonth={month}
            onConfirm={(input) => processEmployeeExit(exitModal.id, input)}
            onClose={() => setExitModal(null)}
          />
        )}
      </Modal>

      <BulkRentModal
        open={bulkRent !== null}
        onClose={() => setBulkRent(null)}
        employees={employees}
        defaultEmployeeId={bulkRent?.employeeId}
        defaultFromMonth={month}
      />
    </div>
  );
}
