"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertTriangle, CalendarClock, ExternalLink } from "lucide-react";
import {
  useStore, calcNetPayable, calcCarryForward, calcOpenAdvanceBalance, isPayrollActive,
  sumApprovedContentExpenses, sumPaidContentExpenses, plannedPayrollPlusApprovedContent,
  totalCashOutPaidForMonth,
  type Employee, type Advance, type SalaryExtra,
} from "@/store/store";
import { useAuth, useIsReadOnly } from "@/store/auth";
import { usePanelView } from "@/store/panel-view";
import { fmt, shiftCalendarMonthYm, toYearMonthLocal } from "@/lib/data";
import { payrollDueShort, payrollMonthLongTitle } from "@/lib/payroll-dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import Modal from "@/components/ui/modal";
import { Field, Input as FInput, NumberInput, Select, Textarea, FormGrid, FormActions } from "@/components/ui/field";
import { MonthlyExportMenu } from "@/components/monthly-export-menu";
import {
  exportSalaryMonthCsv,
  exportSalaryMonthPdf,
  listAvailableMonths,
  type SalaryReportRow,
} from "@/lib/monthly-exports";

// ── Helpers ───────────────────────────────────────────────────────────────
function prevMonth(m: string) { return shiftCalendarMonthYm(m, -1); }
function nextMonth(m: string) { return shiftCalendarMonthYm(m, 1); }
const MONTH_NAMES = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
function monthLabel(m: string) { const [y, mo] = m.split("-"); return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y}`; }
function initials(name: string) { return name.split(/[\s(]/).map(p => p[0]).filter(Boolean).join("").toUpperCase().slice(0, 2); }

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
function EmployeeForm({ initial, onSave, onDelete, onClose }: {
  initial?: Employee; onSave: (d: Omit<Employee, "id">) => void; onDelete?: () => void; onClose: () => void;
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
            <FInput type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} />
          </Field>
        </FormGrid>
        <Field label="Cüzdan Adresi" hint="TRC20, EVM veya diğer ağ adresi">
          <FInput value={form.walletAddress} onChange={e => set("walletAddress", e.target.value)} placeholder="T... veya 0x..." className="font-mono text-xs" />
        </Field>
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

// ── Advance Form ──────────────────────────────────────────────────────────
function AdvanceForm({ employeeId, month, initial, onSave, onDelete, onClose }: {
  employeeId: string; month: string; initial?: Advance;
  onSave: (d: Omit<Advance, "id">) => void; onDelete?: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({ employeeId, month, amount: initial?.amount ?? 0, date: initial?.date ?? new Date().toISOString().slice(0, 10), description: initial?.description ?? "" });
  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); onClose(); }}>
      <div className="grid gap-4">
        <FormGrid>
          <Field label="Tutar ($)" required><NumberInput value={form.amount} onChange={v => set("amount", v)} required min={0} step={10} /></Field>
          <Field label="Tarih"><FInput type="date" value={form.date} onChange={e => set("date", e.target.value)} /></Field>
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

// ── Employee detail card (monthly view) ───────────────────────────────────
function EmployeeDetailRow({
  employee,
  month,
  readOnly,
  currentUserId,
}: {
  employee: Employee;
  month: string;
  readOnly: boolean;
  currentUserId?: string;
}) {
  const { advances, salaryExtras, paymentStatuses, contentExpenses,
    updateEmployee, addAdvance, updateAdvance, deleteAdvance,
    addSalaryExtra, updateSalaryExtra, deleteSalaryExtra, setPaymentStatus } = useStore();
  const { user } = useAuth();
  const enterStreamerPanel = usePanelView((s) => s.enterStreamerPanel);
  const router = useRouter();

  const [advModal, setAdvModal]     = useState<"new" | Advance | null>(null);
  const [extraModal, setExtraModal] = useState<"new" | SalaryExtra | null>(null);

  const active = isPayrollActive(employee, month);

  const empAdv     = advances.filter(a => a.employeeId === employee.id && a.month === month);
  const empExtras  = salaryExtras.filter(e => e.employeeId === employee.id && e.month === month);
  const carry      = calcCarryForward(employee.id, month, advances, paymentStatuses);
  const net        = calcNetPayable(employee, month, advances, salaryExtras, paymentStatuses);
  const status     = paymentStatuses.find(p => p.employeeId === employee.id && p.month === month);
  const isPaid     = status?.paid ?? false;
  const openAdv    = calcOpenAdvanceBalance(employee, prevMonth(month), salaryExtras);
  const openAdvAfter = calcOpenAdvanceBalance(employee, month, salaryExtras);

  const totalAdv   = empAdv.reduce((s, a) => s + a.amount, 0);
  const totalRent  = empExtras.filter(e => e.type === "rent").reduce((s, e) => s + e.amount, 0);
  const totalBonus = empExtras.filter(e => e.type === "bonus" || e.type === "expense" || e.type === "other").reduce((s, e) => s + e.amount, 0);
  const totalDeduc = empExtras.filter(e => e.type === "deduction").reduce((s, e) => s + e.amount, 0);
  const rentFromContract = employee.rentSupport;
  const contentAprv = sumApprovedContentExpenses(contentExpenses, employee.id, month);
  const plannedOut  = plannedPayrollPlusApprovedContent(employee, month, advances, salaryExtras, paymentStatuses, contentExpenses);
  const paidOut     = totalCashOutPaidForMonth(employee, month, advances, salaryExtras, paymentStatuses, contentExpenses);
  const paidContentItems = contentExpenses.filter(
    (e) => e.employeeId === employee.id && e.month === month && e.paid
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

  return (
    <>
      <div className={`rounded-xl border transition-colors ${
        !active                ? "border-border bg-muted/40 opacity-70" :
        isPaid                 ? "border-green-500/30 bg-green-50/40 dark:border-green-500/40 dark:bg-green-950/25" :
        "border-border bg-card"
      }`}>
        {/* Employee header row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
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
            </div>
            <p className="text-muted-foreground text-xs truncate mt-0.5">{employee.role} · {employee.department}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
          <div className="text-right">
            <p className="text-muted-foreground text-[10px] uppercase tracking-wide mb-0.5">
              {active ? "Net Ödenecek" : "Bordro pasif"}
            </p>
            <p className={`text-xl font-bold tabular-nums ${
              !active ? "text-muted-foreground" : isPaid ? "text-green-600" : "text-foreground"
            }`}>
              {active ? fmt(net) : "—"}
            </p>
          </div>
          </div>
        </div>

        {/* Calculation strip */}
        {active && (
          <div className="flex items-center gap-2 px-4 py-2.5 text-xs flex-wrap border-b border-border/40 bg-muted/30">
            <span className="text-muted-foreground">{fmt(employee.baseSalary)} temel maaş</span>
            {totalRent > 0 && <><span className="text-muted-foreground/40">+</span><span className="text-blue-600 font-medium">{fmt(totalRent)} kira desteği</span></>}
            {totalRent === 0 && rentFromContract > 0 && active && (
              <><span className="text-muted-foreground/40">·</span><span className="text-muted-foreground text-[10px]" title="Bu ay için kira kalem kaydı yok; sözleşme tutarı gösterilir">söz. kira {fmt(rentFromContract)}</span></>
            )}
            {carry > 0 && <><span className="text-muted-foreground/40">−</span><span className="text-amber-600 font-medium">{fmt(carry)} devir avans</span></>}
            {totalAdv > 0 && <><span className="text-muted-foreground/40">−</span><span className="text-orange-600 font-medium">{fmt(totalAdv)} avans</span></>}
            {totalBonus > 0 && <><span className="text-muted-foreground/40">+</span><span className="text-green-600 font-medium">{fmt(totalBonus)} prim</span></>}
            {totalDeduc > 0 && <><span className="text-muted-foreground/40">−</span><span className="text-red-600 font-medium">{fmt(totalDeduc)} kesinti</span></>}
            <span className="text-muted-foreground/40">=</span>
            <span className="font-semibold text-foreground">{fmt(net)}</span>
            {active && employee.kind !== "coordinator" && (contentAprv > 0 || paidOut > net) && (
              <span className="text-muted-foreground/80 text-[10px] ml-2 hidden sm:inline">
                · plan {fmt(plannedOut)} · ödenen {fmt(paidOut)}
              </span>
            )}
          </div>
        )}

        {/* Outstanding advance banner */}
        {openAdv > 0 && active && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs border-b border-border/40 bg-amber-50/60 dark:bg-amber-950/25">
            <AlertTriangle size={12} className="text-amber-600 shrink-0" />
            <span className="text-amber-700">
              Önceki dönemden açık avans: <span className="font-semibold tabular-nums">{fmt(openAdv)}</span>
              {totalDeduc > 0 && openAdvAfter < openAdv && (
                <span className="text-muted-foreground"> · bu ay {fmt(openAdv - openAdvAfter)} kapatılıyor → kalan {fmt(openAdvAfter)}</span>
              )}
            </span>
          </div>
        )}

        <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Advances */}
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

          {/* Extras */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Kira / Prim / Kesinti</p>
              {active && !readOnly && <button onClick={() => setExtraModal("new")} className="text-[10px] text-blue-600 hover:text-blue-700 transition-colors">+ Ekle</button>}
            </div>
            {empExtras.length === 0 ? (
              <p className="text-muted-foreground/50 text-xs italic">Kalem yok</p>
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

        {/* Bu ay ödenen ekstralar */}
        {active && buAyEkstraToplam > 0 && (
          <div className="px-4 py-3 border-t border-border/60 bg-emerald-50/40 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">
                Bu Ay Ödenen Ekstralar
              </p>
              <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {fmt(buAyEkstraToplam)}
              </span>
            </div>
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
          </div>
        )}

        {/* Payment toggle */}
        {active && (
          <div className="px-4 py-3 border-t border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs">
              {isPaid ? (
                <><CheckCircle2 size={13} className="text-green-600" /><span className="text-green-700 font-medium">Ödendi</span>{status?.paidDate && <span className="text-muted-foreground">· {status.paidDate}</span>}</>
              ) : (
                <><Clock size={13} className="text-amber-600" /><span className="text-amber-700">Ödeme bekliyor · {payrollDueShort(month, employee.paymentDay)}</span></>
              )}
            </div>
            {!readOnly && (
              <Button
                size="sm"
                variant={isPaid ? "outline" : "default"}
                className={isPaid ? "h-7 text-xs" : "h-7 text-xs bg-green-600 hover:bg-green-500 border-0 text-white"}
                onClick={() => setPaymentStatus(employee.id, month, !isPaid, !isPaid ? new Date().toISOString().slice(0, 10) : undefined, currentUserId)}
              >
                {isPaid ? "Geri Al" : "Yönetici Onayla"}
              </Button>
            )}
          </div>
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
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function MaaslarPage() {
  const { user } = useAuth();
  const {
    employees, advances, salaryExtras, paymentStatuses, contentExpenses,
    addEmployee, updateEmployee, deleteEmployee,
  } = useStore();
  const readOnly = useIsReadOnly();
  const [month, setMonth]     = useState(() => toYearMonthLocal(new Date()));
  const [search, setSearch]   = useState("");
  const [empModal, setEmpModal] = useState<"new" | Employee | null>(null);

  const bordrolu = employees.filter(e => e.kind !== "coordinator" && e.status === "active");
  const aktifBuAy = bordrolu.filter(e => isPayrollActive(e, month));
  const totalBase = aktifBuAy.reduce((s, e) => s + e.baseSalary, 0);
  const totalNet  = aktifBuAy.reduce((s, e) => s + calcNetPayable(e, month, advances, salaryExtras, paymentStatuses), 0);
  const paidCnt   = aktifBuAy.filter(e => paymentStatuses.find(p => p.employeeId === e.id && p.month === month && p.paid)).length;
  const openAdvTotal = bordrolu.reduce((s, e) => s + calcOpenAdvanceBalance(e, month, salaryExtras), 0);

  const totalContentAprv = aktifBuAy.reduce((s, e) => s + sumApprovedContentExpenses(contentExpenses, e.id, month), 0);
  const totalPlannedOut  = aktifBuAy.reduce((s, e) => s + plannedPayrollPlusApprovedContent(e, month, advances, salaryExtras, paymentStatuses, contentExpenses), 0);
  const totalPaidOutAll  = aktifBuAy.reduce((s, e) => s + totalCashOutPaidForMonth(e, month, advances, salaryExtras, paymentStatuses, contentExpenses), 0);

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
      const rent    = empExt.filter((e) => e.type === "rent").reduce((s, e) => s + e.amount, 0);
      const add     = empExt.filter((e) => e.type !== "deduction").reduce((s, e) => s + e.amount, 0);
      const ded     = empExt.filter((e) => e.type === "deduction").reduce((s, e) => s + e.amount, 0);
      const status  = paymentStatuses.find((p) => p.employeeId === emp.id && p.month === ym);
      return {
        name:             emp.name,
        role:             emp.role,
        department:       emp.department,
        paymentDay:       emp.paymentDay,
        baseSalary:       emp.baseSalary,
        rentSupport:      rent,
        carryForward:     carry,
        thisMonthAdvance: empAdv.reduce((s, a) => s + a.amount, 0),
        openAdvanceAfter: calcOpenAdvanceBalance(emp, ym, salaryExtras),
        totalBonus:       add - rent,
        totalDeduction:   ded,
        netPayable:       calcNetPayable(emp, ym, advances, salaryExtras, paymentStatuses),
        contentApproved:  sumApprovedContentExpenses(contentExpenses, emp.id, ym),
        plannedTotalOut:  plannedPayrollPlusApprovedContent(emp, ym, advances, salaryExtras, paymentStatuses, contentExpenses),
        totalPaidOut:     totalCashOutPaidForMonth(emp, ym, advances, salaryExtras, paymentStatuses, contentExpenses),
        paid:             status?.paid ?? false,
        paidDate:         status?.paidDate,
        walletAddress:    emp.walletAddress,
      };
    });
  };

  const canExport = user?.role === "admin" || user?.role === "auditor";

  return (
    <div className="p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-3 flex-wrap">
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
              onExportPdf={(ym) => exportSalaryMonthPdf(buildRowsForMonth(ym), ym, { generatedBy: user?.name })}
              onExportCsv={(ym) => exportSalaryMonthCsv(buildRowsForMonth(ym), ym)}
            />
          )}
          {!readOnly && (
            <Button onClick={() => setEmpModal("new")} size="sm" className="gap-1.5">
              <Plus size={14} /> Çalışan Ekle
            </Button>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-8">
        {bordrolu
          .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
          .map(emp => (
            <EmployeeDetailRow
              key={emp.id}
              employee={emp}
              month={month}
              readOnly={readOnly}
              currentUserId={user?.id}
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
                const openAdv = calcOpenAdvanceBalance(emp, month, salaryExtras);
                const kiraAy = salaryExtras
                  .filter(e => e.employeeId === emp.id && e.month === month && e.type === "rent")
                  .reduce((s, e) => s + e.amount, 0);
                const netAy = isPayrollActive(emp, month)
                  ? calcNetPayable(emp, month, advances, salaryExtras, paymentStatuses)
                  : 0;
                const icAy = sumApprovedContentExpenses(contentExpenses, emp.id, month);
                const planAy = plannedPayrollPlusApprovedContent(emp, month, advances, salaryExtras, paymentStatuses, contentExpenses);
                const odenAy = totalCashOutPaidForMonth(emp, month, advances, salaryExtras, paymentStatuses, contentExpenses);
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
                      <span className="text-blue-600">{fmt(kiraAy)}</span>
                    ) : emp.rentSupport > 0 ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-muted-foreground italic">{fmt(emp.rentSupport)}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">Bu ay için kira kalem kaydı yok; sözleşme tutarı</TooltipContent>
                      </Tooltip>
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
                    {isPayrollActive(emp, month) ? fmt(netAy) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                    {icAy > 0 ? <span className="text-violet-600">{fmt(icAy)}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums font-medium whitespace-nowrap">{planAy > 0 ? fmt(planAy) : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-3 tabular-nums font-semibold text-green-700 whitespace-nowrap">{odenAy > 0 ? fmt(odenAy) : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-3">
                    {emp.walletAddress ? (
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
            {paymentStatuses.find(p => p.employeeId === emp.id && p.month === month)?.paidBy && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Onay: {paymentStatuses.find(p => p.employeeId === emp.id && p.month === month)?.approvedAt?.slice(0, 10)}
              </p>
            )}
                  </td>
                  <td className="px-3 py-3">
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => setEmpModal(emp)}
                        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                        aria-label="Çalışanı düzenle"
                      >
                        <Pencil size={13} />
                      </button>
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
          onSave={d => { empModal === "new" ? addEmployee(d) : empModal !== null && saveEmployee(empModal.id, d); }}
          onDelete={empModal !== "new" && empModal !== null ? () => { deleteEmployee(empModal.id); setEmpModal(null); } : undefined}
          onClose={() => setEmpModal(null)}
        />
      </Modal>
    </div>
  );
}
