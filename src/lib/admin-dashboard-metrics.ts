import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Advance,
  AppNotification,
  ContentExpense,
  Employee,
  Kasa,
  KasaTransaction,
  MonthPaymentStatus,
  SalaryExtra,
} from "@/store/store";
import {
  useStore,
  calcNetPayable,
  isPayrollActive,
  unreadNotificationCount,
  visibleNotificationsForRole,
} from "@/store/store";
import {
  buildPayrollPaymentLines,
  isPayrollFullyPaid,
  sumUnpaidPayrollLines,
} from "@/lib/payroll-lines";
import {
  findGenelKasa,
  sumOperatingKasaLedgerBalance,
  computeTronPanelMetrics,
  getKasaDisplayBalance,
} from "@/lib/kasa-tron-metrics";
import { totalViewsForMonth } from "@/lib/brand-month-metrics";
import { toYearMonthLocal } from "@/lib/data";
import { isYeniHesaplarBrandId } from "@/lib/yeni-hesaplar";
import { useAuth } from "@/store/auth";
import type { InternalTask } from "@/types/internal-task";
import {
  expenseReviewStatus,
  isAwaitingContentExpenseReview,
  isActiveContentExpense,
  isContentSettled,
  isExceptionWriteOff,
  isKasaSettled,
  isPayrollSettled,
  isUnsettledApprovedContent,
  filterContentExpensesForViewer,
} from "@/lib/content-expense";
import { isMainAdmin } from "@/lib/user-guards";

export const LOW_KASA_WARNING_THRESHOLD = 5000;

export type PendingContentExpenseMetrics = {
  pendingContentExpenseCount: number;
  pendingContentExpenseTotal: number;
};

export type UnpaidPayrollMetrics = {
  unpaidPayrollCount: number;
  unpaidPayrollTotal: number;
  unpaidEmployees: Employee[];
};

export type LowKasaWarning = {
  balance: number;
  threshold: number;
  isLow: boolean;
};

export type ContentMonthMetrics = {
  monthContentTotal: number;
  monthContentCount: number;
  awaitingSettlementCount: number;
  awaitingSettlementTotal: number;
  kasaSettledMonthTotal: number;
  kasaSettledMonthCount: number;
  payrollSettledMonthTotal: number;
  payrollSettledMonthCount: number;
};

export function computePendingContentExpenseMetrics(
  contentExpenses: ContentExpense[],
  salaryExtras: { contentExpenseId?: string }[] = [],
): PendingContentExpenseMetrics {
  const pending = contentExpenses.filter((c) =>
    isAwaitingContentExpenseReview(c, salaryExtras),
  );
  return {
    pendingContentExpenseCount: pending.length,
    pendingContentExpenseTotal: pending.reduce((s, e) => s + e.amountUsd, 0),
  };
}

export function computeContentMonthMetrics(
  contentExpenses: ContentExpense[],
  month: string,
): ContentMonthMetrics {
  const monthRows = contentExpenses.filter((e) => e.month === month);
  const active = monthRows.filter(isActiveContentExpense);
  const awaiting = monthRows.filter(isUnsettledApprovedContent);
  const kasa = monthRows.filter(
    (e) => isKasaSettled(e) && !isExceptionWriteOff(e) && expenseReviewStatus(e) !== "cancelled",
  );
  const payroll = monthRows.filter(
    (e) =>
      isPayrollSettled(e) &&
      !isKasaSettled(e) &&
      !isExceptionWriteOff(e) &&
      expenseReviewStatus(e) !== "cancelled",
  );
  const sum = (rows: ContentExpense[]) => rows.reduce((s, e) => s + e.amountUsd, 0);
  return {
    monthContentTotal: sum(active),
    monthContentCount: active.length,
    awaitingSettlementCount: awaiting.length,
    awaitingSettlementTotal: sum(awaiting),
    kasaSettledMonthTotal: sum(kasa),
    kasaSettledMonthCount: kasa.length,
    payrollSettledMonthTotal: sum(payroll),
    payrollSettledMonthCount: payroll.length,
  };
}

export function isOverdueInternalTask(t: InternalTask, todayKey?: string): boolean {
  if (!t.dueDate || t.status === "done") return false;
  const today = todayKey ?? new Date().toISOString().slice(0, 10);
  return t.dueDate < today;
}

export function computeOverdueInternalTaskCount(
  tasks: InternalTask[],
  todayKey?: string,
): number {
  return tasks.filter((t) => isOverdueInternalTask(t, todayKey)).length;
}

export function computeOverdueInternalTasks(
  tasks: InternalTask[],
  todayKey?: string,
): InternalTask[] {
  return tasks.filter((t) => isOverdueInternalTask(t, todayKey));
}

export function computeUnpaidPayrollMetrics(
  employees: Employee[],
  month: string,
  advances: Advance[],
  salaryExtras: SalaryExtra[],
  contentExpenses: ContentExpense[],
  paymentStatuses: MonthPaymentStatus[],
): UnpaidPayrollMetrics {
  const bordrolu = employees.filter(
    (e) => e.kind !== "coordinator" && isPayrollActive(e, month),
  );
  const unpaidEmployees = bordrolu.filter((e) => {
    const lines = buildPayrollPaymentLines(
      e,
      month,
      advances,
      salaryExtras,
      contentExpenses,
      paymentStatuses,
    );
    if (lines.length > 0) return !isPayrollFullyPaid(lines);
    const status = paymentStatuses.find(
      (p) => p.employeeId === e.id && p.month === month,
    );
    return !status?.paid;
  });
  const unpaidPayrollTotal = unpaidEmployees.reduce((s, e) => {
    const lines = buildPayrollPaymentLines(
      e,
      month,
      advances,
      salaryExtras,
      contentExpenses,
      paymentStatuses,
    );
    if (lines.length > 0) {
      const unpaid = sumUnpaidPayrollLines(lines);
      return (
        s +
        (unpaid > 0
          ? unpaid
          : calcNetPayable(e, month, advances, salaryExtras, paymentStatuses))
      );
    }
    return s + calcNetPayable(e, month, advances, salaryExtras, paymentStatuses);
  }, 0);
  return {
    unpaidPayrollCount: unpaidEmployees.length,
    unpaidPayrollTotal,
    unpaidEmployees,
  };
}

export function computeAdminUnreadNotificationCount(
  notifications: AppNotification[],
  userId?: string,
): number {
  return unreadNotificationCount(notifications, "admin", userId);
}

export function computeLowKasaWarning(
  kasas: Kasa[],
  kasaTransactions: KasaTransaction[],
  kasaMetrics?: { operatingTotal: number; genelDisplayBalance?: number | null } | null,
  threshold = LOW_KASA_WARNING_THRESHOLD,
): LowKasaWarning & { genelBalance: number } {
  const panel = computeTronPanelMetrics(kasas, kasaTransactions);
  const genel = findGenelKasa(kasas);
  const genelBalance =
    kasaMetrics?.genelDisplayBalance != null
      ? kasaMetrics.genelDisplayBalance
      : genel
        ? getKasaDisplayBalance(genel, kasas, kasaTransactions, panel).balance
        : 0;

  const balance =
    kasaMetrics?.operatingTotal != null
      ? kasaMetrics.operatingTotal
      : sumOperatingKasaLedgerBalance(kasas, kasaTransactions, panel);

  return {
    balance,
    genelBalance,
    threshold,
    isLow: balance <= threshold,
  };
}

export type AdminDashboardMetrics = PendingContentExpenseMetrics &
  UnpaidPayrollMetrics &
  LowKasaWarning &
  ContentMonthMetrics & {
    genelBalance: number;
    unreadNotificationCount: number;
    currentMonth: string;
    activeBrandCount: number;
    monthlyViews: number;
    recentNotifications: AppNotification[];
    pendingContentExpenses: ContentExpense[];
  };

export function useAdminDashboardMetrics(month?: string): AdminDashboardMetrics {
  const user = useAuth((s) => s.user);
  const contentExpenses = useStore((s) => s.contentExpenses);
  const employees = useStore((s) => s.employees);
  const advances = useStore((s) => s.advances);
  const salaryExtras = useStore((s) => s.salaryExtras);
  const paymentStatuses = useStore((s) => s.paymentStatuses);
  const notifications = useStore((s) => s.notifications);
  const kasas = useStore((s) => s.kasas);
  const kasaTransactions = useStore((s) => s.kasaTransactions);
  const kasaMetrics = useStore((s) => s.kasaMetrics);
  const brands = useStore((s) => s.brands);
  const brandLinks = useStore((s) => s.brandLinks);
  const brandViewership = useStore((s) => s.brandViewership);
  const linkSnapshots = useStore((s) => s.linkSnapshots);

  const currentMonth = month ?? toYearMonthLocal(new Date());

  return useMemo(() => {
    const visibleExpenses =
      user && !isMainAdmin(user)
        ? filterContentExpensesForViewer(contentExpenses, user)
        : contentExpenses;
    const pendingExpenses = visibleExpenses.filter((c) =>
      isAwaitingContentExpenseReview(c, salaryExtras),
    );
    const pending = computePendingContentExpenseMetrics(
      visibleExpenses,
      salaryExtras,
    );
    const contentMonth = computeContentMonthMetrics(visibleExpenses, currentMonth);
    const payroll = computeUnpaidPayrollMetrics(
      employees,
      currentMonth,
      advances,
      salaryExtras,
      visibleExpenses,
      paymentStatuses,
    );
    const kasa = computeLowKasaWarning(kasas, kasaTransactions, kasaMetrics);
    const sponsorBrands = brands.filter((b) => !isYeniHesaplarBrandId(b.id));
    const sponsorLinks = brandLinks.filter((l) => !isYeniHesaplarBrandId(l.brandId));
    const aktifMarka = sponsorBrands.filter((b) => b.status === "active").length;
    const toplamIzlenme = totalViewsForMonth(
      sponsorLinks,
      brandViewership,
      currentMonth,
      linkSnapshots,
      currentMonth,
    );

    return {
      ...pending,
      ...payroll,
      ...kasa,
      ...contentMonth,
      pendingContentExpenses: pendingExpenses,
      unreadNotificationCount: computeAdminUnreadNotificationCount(
        notifications,
        user?.id,
      ),
      currentMonth,
      activeBrandCount: aktifMarka,
      monthlyViews: toplamIzlenme,
      recentNotifications: user
        ? visibleNotificationsForRole(notifications, "admin", user.id).slice(
            0,
            6,
          )
        : [],
    };
  }, [
    contentExpenses,
    employees,
    advances,
    salaryExtras,
    paymentStatuses,
    notifications,
    kasas,
    kasaTransactions,
    kasaMetrics,
    brands,
    brandLinks,
    brandViewership,
    linkSnapshots,
    currentMonth,
    user,
  ]);
}

export function useAdminOverdueTasks(enabled = true) {
  const [tasks, setTasks] = useState<InternalTask[]>([]);
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks?hideExited=1", { cache: "no-store" });
      const json = (await res.json()) as { tasks?: InternalTask[] };
      if (res.ok) setTasks(json.tasks ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  const overdueTasks = useMemo(
    () => computeOverdueInternalTasks(tasks),
    [tasks],
  );
  const overdueTaskCount = overdueTasks.length;

  return { tasks, overdueTasks, overdueTaskCount, loading, reload: load };
}

export { isExpenseCountedPaid } from "@/lib/content-expense";
