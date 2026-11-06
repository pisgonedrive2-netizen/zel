import type { Employee, SalaryExtra } from "@/store/store";

/** Otomatik üretilen avans kesintisi id öneki. */
export const AUTO_ADVANCE_CUT_PREFIX = "se-advcut-";

/** Personel notuna gömülen plan: [adv-plan:cut=100;start=2026-10] */
export const ADV_PLAN_RE = /\[adv-plan:cut=(\d+(?:\.\d+)?);start=(\d{4}-\d{2})\]/;

/** Tek ay istisna kesinti: [adv-override:2026-10=400] */
export const ADV_OVERRIDE_RE = /\[adv-override:(\d{4}-\d{2})=(\d+(?:\.\d+)?)\]/g;

export function parseAdvancePlanFromNotes(notes: string | undefined | null): {
  cut?: number;
  start?: string;
} {
  const m = String(notes ?? "").match(ADV_PLAN_RE);
  if (!m) return {};
  const cut = Number(m[1]);
  return {
    cut: Number.isFinite(cut) && cut > 0 ? cut : undefined,
    start: m[2],
  };
}

export function parseAdvanceOverridesFromNotes(
  notes: string | undefined | null,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of String(notes ?? "").matchAll(ADV_OVERRIDE_RE)) {
    const month = m[1];
    const amount = Number(m[2]);
    if (/^\d{4}-\d{2}$/.test(month) && Number.isFinite(amount) && amount > 0) {
      out.set(month, amount);
    }
  }
  return out;
}

export function encodeAdvanceOverrideInNotes(
  notes: string | undefined | null,
  month: string,
  amount: number,
): string {
  const cleaned = String(notes ?? "")
    .replace(new RegExp(`\\[adv-override:${month}=\\d+(?:\\.\\d+)?\\]`, "g"), "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!(amount > 0 && /^\d{4}-\d{2}$/.test(month))) return cleaned;
  const tag = `[adv-override:${month}=${amount}]`;
  return cleaned ? `${cleaned}\n${tag}` : tag;
}

export function encodeAdvancePlanInNotes(
  notes: string | undefined | null,
  cut: number | undefined,
  start: string | undefined,
): string {
  const cleaned = String(notes ?? "")
    .replace(ADV_PLAN_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!(cut && cut > 0 && start && /^\d{4}-\d{2}$/.test(start))) {
    return cleaned;
  }
  const tag = `[adv-plan:cut=${cut};start=${start}]`;
  return cleaned ? `${cleaned}\n${tag}` : tag;
}

/** Bu ay için geçerli plan kesintisi (override varsa onu kullanır). */
export function effectiveAdvanceCutForMonth(
  employee: Pick<Employee, "advanceMonthlyCut" | "advanceRepayStartMonth" | "notes">,
  month: string,
): number | null {
  const plan = resolveAdvancePlan(employee);
  if (!plan || month < plan.start) return null;
  const overrides = parseAdvanceOverridesFromNotes(employee.notes);
  const cut = overrides.get(month) ?? plan.cut;
  return cut > 0 ? cut : null;
}

export function resolveAdvancePlan(employee: Pick<
  Employee,
  "advanceMonthlyCut" | "advanceRepayStartMonth" | "notes"
>): { cut: number; start: string } | null {
  const fromNotes = parseAdvancePlanFromNotes(employee.notes);
  const cut = Number(employee.advanceMonthlyCut ?? fromNotes.cut ?? 0);
  const start = (employee.advanceRepayStartMonth || fromNotes.start || "").trim();
  if (!(cut > 0 && /^\d{4}-\d{2}$/.test(start))) return null;
  return { cut, start };
}

function repaidThrough(
  employeeId: string,
  asOfMonth: string,
  salaryExtras: SalaryExtra[],
): number {
  return salaryExtras
    .filter(
      (e) =>
        e.employeeId === employeeId &&
        e.type === "deduction" &&
        /avans/i.test(e.description) &&
        e.month <= asOfMonth,
    )
    .reduce((s, e) => s + e.amount, 0);
}

export function autoAdvanceCutId(employeeId: string, month: string): string {
  const short = employeeId.replace(/^emp-/, "").slice(0, 12);
  return `${AUTO_ADVANCE_CUT_PREFIX}${short}-${month}`;
}

export function isAutoAdvanceCutExtra(e: SalaryExtra, employeeId?: string): boolean {
  if (e.type !== "deduction" || !e.id.startsWith(AUTO_ADVANCE_CUT_PREFIX)) return false;
  if (employeeId && e.employeeId !== employeeId) return false;
  return /avans/i.test(e.description);
}

function ymAdd(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ymPrev(ym: string): string {
  return ymAdd(ym, -1);
}

function listMonthsInclusive(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = ymAdd(cur, 1);
    if (out.length > 120) break;
  }
  return out;
}

export function advanceCutDescription(amount: number, remainingAfter: number): string {
  return `Açık avans geri ödemesi · $${amount}/ay · kalan $${remainingAfter}`;
}

/**
 * `advanceRepayStartMonth` + `advanceMonthlyCut` ile otomatik kesinti satırları üretir.
 * Başlangıç ayından önce otomatik satır oluşturmaz (ör. Eylül atlanır, Ekim’den başlar).
 * Manuel (prefix’siz) avans kesintilerine dokunmaz.
 */
export function propagateAdvanceCutsForEmployee(
  extras: SalaryExtra[],
  employee: Employee,
  throughMonth: string,
): SalaryExtra[] {
  const plan = resolveAdvancePlan(employee);
  if (!plan) {
    return extras.filter((e) => !isAutoAdvanceCutExtra(e, employee.id));
  }
  const { cut, start } = plan;
  const overrides = parseAdvanceOverridesFromNotes(employee.notes);

  const end = throughMonth >= start ? throughMonth : start;
  const months = listMonthsInclusive(start, end);

  let next = extras.filter(
    (e) => !(isAutoAdvanceCutExtra(e, employee.id) && e.month < start),
  );

  const manualOnly = next.filter((e) => !isAutoAdvanceCutExtra(e, employee.id));
  const repaidBeforeStart = repaidThrough(employee.id, ymPrev(start), manualOnly);
  let remaining = Math.max(0, employee.initialAdvance - repaidBeforeStart);

  const keptManual = manualOnly;
  const autoRows: SalaryExtra[] = [];

  for (const month of months) {
    if (remaining <= 0) break;
    const monthCut = overrides.get(month) ?? cut;
    const amount = Math.min(monthCut, remaining);
    remaining -= amount;
    autoRows.push({
      id: autoAdvanceCutId(employee.id, month),
      employeeId: employee.id,
      month,
      amount,
      description: advanceCutDescription(amount, remaining),
      type: "deduction",
    });
  }

  next = [...keptManual, ...autoRows];
  return next;
}

export function reconcileAdvanceCutsForAllEmployees(
  employees: Employee[],
  salaryExtras: SalaryExtra[],
  throughMonth?: string,
): SalaryExtra[] {
  const horizon =
    throughMonth && /^\d{4}-\d{2}$/.test(throughMonth)
      ? throughMonth
      : (() => {
          const now = new Date();
          return ymAdd(
            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
            18,
          );
        })();

  let next = salaryExtras;
  for (const emp of employees) {
    if (emp.status !== "active") {
      next = next.filter((e) => !isAutoAdvanceCutExtra(e, emp.id));
      continue;
    }
    if (!resolveAdvancePlan(emp)) continue;
    const start = resolveAdvancePlan(emp)!.start;
    const end = horizon >= start ? horizon : start;
    next = propagateAdvanceCutsForEmployee(next, emp, end);
  }
  return next;
}
