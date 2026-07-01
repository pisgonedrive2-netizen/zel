import type {
  Advance,
  ContentExpense,
  Employee,
  MonthPaymentStatus,
  SalaryExtra,
} from "@/store/store";
import {
  isPayrollActive,
  payrollProrationFactor,
  proRatedBaseSalary,
} from "@/lib/payroll-utils";

function ymGt(a: string, b: string): boolean {
  return a > b;
}

function calcCarryForward(
  employeeId: string,
  currentMonth: string,
  advances: Advance[],
  paymentStatuses: MonthPaymentStatus[],
): number {
  return advances
    .filter((a) => {
      if (a.employeeId !== employeeId) return false;
      if (!ymGt(currentMonth, a.month)) return false;
      const paid = paymentStatuses.find(
        (p) => p.employeeId === employeeId && p.month === a.month && p.paid,
      );
      return !paid;
    })
    .reduce((s, a) => s + a.amount, 0);
}

function getRentForMonth(
  employee: Employee,
  month: string,
  extras: SalaryExtra[],
): number {
  const rentExtras = extras.filter(
    (e) => e.employeeId === employee.id && e.month === month && e.type === "rent",
  );
  if (rentExtras.length > 0) {
    return rentExtras.reduce((s, e) => s + e.amount, 0);
  }
  return employee.rentSupport;
}

function payrollSettledContentNotInExtras(
  employeeId: string,
  month: string,
  extras: SalaryExtra[],
  contentExpenses: ContentExpense[],
): number {
  const linkedFromExtras = extras
    .filter(
      (e) =>
        e.employeeId === employeeId &&
        e.month === month &&
        e.contentExpenseId,
    )
    .reduce((s, e) => s + e.amount, 0);

  const payrollSettled = contentExpenses
    .filter(
      (e) =>
        e.employeeId === employeeId &&
        e.month === month &&
        (e.salaryExtraId || e.settlementMode === "payroll") &&
        e.reviewStatus !== "rejected" &&
        e.reviewStatus !== "cancelled",
    )
    .reduce((s, e) => s + e.amountUsd, 0);

  return Math.max(0, payrollSettled - linkedFromExtras);
}

export type PayrollLineKind =
  | "base_salary"
  | "rent"
  | "bonus"
  | "expense"
  | "other"
  | "content_payroll";

/** Tek bir ödenebilir bordro kalemi + ödeme durumu. */
export interface PayrollLineItem {
  lineId: string;
  kind: PayrollLineKind;
  label: string;
  amountUsd: number;
  refId?: string;
  paid: boolean;
  paidDate?: string;
  paidBy?: string;
  kasaTxId?: string;
}

export interface PayrollLinePaidRecord {
  lineId: string;
  kind: PayrollLineKind;
  label: string;
  amountUsd: number;
  refId?: string;
  paid: boolean;
  paidDate?: string;
  paidBy?: string;
  kasaTxId?: string;
}

const EXTRA_LABEL: Record<string, string> = {
  bonus: "Prim",
  expense: "Masraf",
  other: "Diğer",
};

function statusFor(
  employeeId: string,
  month: string,
  paymentStatuses: MonthPaymentStatus[],
): MonthPaymentStatus | undefined {
  return paymentStatuses.find(
    (p) => p.employeeId === employeeId && p.month === month,
  );
}

/** Ay için ödenebilir kalemlerin planı (ödeme durumu hariç). */
export function buildPayrollLinePlan(
  employee: Employee,
  month: string,
  advances: Advance[],
  extras: SalaryExtra[],
  contentExpenses: ContentExpense[],
  paymentStatuses: MonthPaymentStatus[] = [],
): Omit<PayrollLineItem, "paid" | "paidDate" | "paidBy" | "kasaTxId">[] {
  if (!isPayrollActive(employee, month)) return [];

  const empExtras = extras.filter(
    (e) => e.employeeId === employee.id && e.month === month,
  );
  const empAdvances = advances.filter(
    (a) => a.employeeId === employee.id && a.month === month,
  );
  const totalDeduc = empExtras
    .filter((e) => e.type === "deduction")
    .reduce((s, e) => s + e.amount, 0);
  const totalAdvance = empAdvances.reduce((s, a) => s + a.amount, 0);
  const carryFwd = calcCarryForward(
    employee.id,
    month,
    advances,
    paymentStatuses,
  );
  const factor = payrollProrationFactor(employee, month);
  const netBaseSalary = Math.max(
    0,
    proRatedBaseSalary(employee.baseSalary, factor) - totalDeduc - totalAdvance - carryFwd,
  );
  const lines: Omit<
    PayrollLineItem,
    "paid" | "paidDate" | "paidBy" | "kasaTxId"
  >[] = [];

  if (netBaseSalary > 0) {
    lines.push({
      lineId: "base",
      kind: "base_salary",
      label: factor < 1 ? `Temel maaş (oransal %${Math.round(factor * 100)})` : "Temel maaş",
      amountUsd: netBaseSalary,
    });
  }

  // Kira sabit aylık kalem; çıkış ayında orantılanmaz (yalnızca temel maaş).
  const rent = getRentForMonth(employee, month, extras);
  if (rent > 0) {
    lines.push({
      lineId: "rent",
      kind: "rent",
      label: "Kira desteği",
      amountUsd: rent,
    });
  }

  for (const e of empExtras) {
    if (e.type === "deduction" || e.type === "rent") continue;
    lines.push({
      lineId: `extra:${e.id}`,
      kind: e.type === "bonus" ? "bonus" : e.type === "expense" ? "expense" : "other",
      label: e.description?.trim()
        ? `${EXTRA_LABEL[e.type] ?? e.type} · ${e.description}`
        : (EXTRA_LABEL[e.type] ?? e.type),
      amountUsd: e.amount,
      refId: e.id,
    });
  }

  const orphanContent = payrollSettledContentNotInExtras(
    employee.id,
    month,
    extras,
    contentExpenses,
  );
  if (orphanContent > 0) {
    lines.push({
      lineId: "content:orphan",
      kind: "content_payroll",
      label: "İçerik (bordro)",
      amountUsd: orphanContent,
    });
  }

  for (const e of extras.filter(
    (x) =>
      x.employeeId === employee.id &&
      x.month === month &&
      x.contentExpenseId,
  )) {
    const exp = contentExpenses.find((c) => c.id === e.contentExpenseId);
    if (!exp || exp.reviewStatus === "rejected" || exp.reviewStatus === "cancelled")
      continue;
    lines.push({
      lineId: `content:${e.contentExpenseId}`,
      kind: "content_payroll",
      label: exp.description?.trim()
        ? `İçerik · ${exp.description}`
        : `İçerik · ${exp.category}`,
      amountUsd: e.amount,
      refId: e.contentExpenseId,
    });
  }

  return lines;
}

function applyStoredPayments(
  plan: Omit<PayrollLineItem, "paid" | "paidDate" | "paidBy" | "kasaTxId">[],
  stored: PayrollLinePaidRecord[] | undefined,
  legacyPaid: boolean,
): PayrollLineItem[] {
  if (legacyPaid && (!stored || stored.length === 0)) {
    return plan.map((p) => ({ ...p, paid: true }));
  }
  const byId = new Map((stored ?? []).map((s) => [s.lineId, s]));
  return plan.map((p) => {
    const s = byId.get(p.lineId);
    return {
      ...p,
      paid: s?.paid ?? false,
      paidDate: s?.paidDate,
      paidBy: s?.paidBy,
      kasaTxId: s?.kasaTxId,
    };
  });
}

export function buildPayrollPaymentLines(
  employee: Employee,
  month: string,
  advances: Advance[],
  extras: SalaryExtra[],
  contentExpenses: ContentExpense[],
  paymentStatuses: MonthPaymentStatus[],
): PayrollLineItem[] {
  const plan = buildPayrollLinePlan(
    employee,
    month,
    advances,
    extras,
    contentExpenses,
    paymentStatuses,
  );
  const st = statusFor(employee.id, month, paymentStatuses);
  return applyStoredPayments(plan, st?.linePayments, st?.paid ?? false);
}

export function sumPaidPayrollLines(lines: PayrollLineItem[]): number {
  return lines.filter((l) => l.paid).reduce((s, l) => s + l.amountUsd, 0);
}

export function sumUnpaidPayrollLines(lines: PayrollLineItem[]): number {
  return lines.filter((l) => !l.paid).reduce((s, l) => s + l.amountUsd, 0);
}

export function isPayrollFullyPaid(lines: PayrollLineItem[]): boolean {
  return lines.length > 0 && lines.every((l) => l.paid);
}

export function hasPartialPayrollPayment(lines: PayrollLineItem[]): boolean {
  const paidCount = lines.filter((l) => l.paid).length;
  return paidCount > 0 && paidCount < lines.length;
}

export type PayrollPaymentPhase = "none" | "partial" | "full";

export function payrollPaymentPhase(lines: PayrollLineItem[]): PayrollPaymentPhase {
  if (lines.length === 0) return "none";
  if (isPayrollFullyPaid(lines)) return "full";
  if (lines.some((l) => l.paid)) return "partial";
  return "none";
}

/** Kısa durum metni: "Maaş ödendi · Kira bekliyor" */
export function formatPayrollLineStatusSummary(lines: PayrollLineItem[]): string {
  const unpaid = lines.filter((l) => !l.paid);
  const paid = lines.filter((l) => l.paid);
  if (lines.length === 0) return "Bordro kalemi yok";
  if (unpaid.length === 0) return "Tüm kalemler ödendi";
  if (paid.length === 0) return "Ödeme bekliyor";
  const paidLabels = paid.map((l) => shortLineLabel(l)).join(", ");
  const unpaidLabels = unpaid.map((l) => shortLineLabel(l)).join(", ");
  return `${paidLabels} ödendi · ${unpaidLabels} bekliyor`;
}

export function shortPayrollLineLabel(line: Pick<PayrollLineItem, "kind" | "label">): string {
  if (line.kind === "base_salary") return "Maaş";
  if (line.kind === "rent") return "Kira";
  if (line.kind === "content_payroll") return "İçerik";
  if (line.kind === "bonus") return "Prim";
  return line.label.split("·")[0]?.trim() || line.label;
}

function shortLineLabel(line: PayrollLineItem): string {
  return shortPayrollLineLabel(line);
}

export function linePaymentsToRecords(lines: PayrollLineItem[]): PayrollLinePaidRecord[] {
  return lines
    .filter((l) => l.paid)
    .map((l) => ({
      lineId: l.lineId,
      kind: l.kind,
      label: l.label,
      amountUsd: l.amountUsd,
      refId: l.refId,
      paid: true,
      paidDate: l.paidDate,
      paidBy: l.paidBy,
      kasaTxId: l.kasaTxId,
    }));
}

export function markAllLinesPaid(
  lines: PayrollLineItem[],
  meta: { paidDate: string; paidBy?: string; kasaTxId?: string },
): PayrollLinePaidRecord[] {
  return lines.map((l) => ({
    lineId: l.lineId,
    kind: l.kind,
    label: l.label,
    amountUsd: l.amountUsd,
    refId: l.refId,
    paid: true,
    paidDate: meta.paidDate,
    paidBy: meta.paidBy,
    kasaTxId: meta.kasaTxId,
  }));
}

export function upsertLinePaidRecord(
  existing: PayrollLinePaidRecord[] | undefined,
  record: PayrollLinePaidRecord,
): PayrollLinePaidRecord[] {
  const list = [...(existing ?? [])];
  const idx = list.findIndex((r) => r.lineId === record.lineId);
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  return list;
}

export function removeLinePaidRecord(
  existing: PayrollLinePaidRecord[] | undefined,
  lineId: string,
): PayrollLinePaidRecord[] {
  return (existing ?? []).filter((r) => r.lineId !== lineId);
}
