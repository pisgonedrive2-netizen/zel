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
import { sumKasaDisplayBalances } from "@/lib/kasa-tron-metrics";
import { totalViewsForMonth } from "@/lib/brand-month-metrics";
import { toYearMonthLocal } from "@/lib/data";
import { useAuth } from "@/store/auth";
import type { InternalTask } from "@/types/internal-task";

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

export function computePendingContentExpenseMetrics(
  contentExpenses: ContentExpense[],
): PendingContentExpenseMetrics {
  const pending = contentExpenses.filter((c) => c.reviewStatus === "pending");
  return {
    pendingContentExpenseCount: pending.length,
    pendingContentExpenseTotal: pending.reduce((s, e) => s + e.amountUsd, 0),
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
  kasaMetrics?: { operatingTotal: number } | null,
  threshold = LOW_KASA_WARNING_THRESHOLD,
): LowKasaWarning {
  const balance = kasaMetrics
    ? kasaMetrics.operatingTotal
    : sumKasaDisplayBalances(kasas, kasaTransactions);
  return {
    balance,
    threshold,
    isLow: balance <= threshold,
  };
}

export type AdminDashboardMetrics = PendingContentExpenseMetrics &
  UnpaidPayrollMetrics &
  LowKasaWarning & {
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
    const pendingExpenses = contentExpenses.filter(
      (c) => c.reviewStatus === "pending",
    );
    const pending = computePendingContentExpenseMetrics(contentExpenses);
    const payroll = computeUnpaidPayrollMetrics(
      employees,
      currentMonth,
      advances,
      salaryExtras,
      contentExpenses,
      paymentStatuses,
    );
    const kasa = computeLowKasaWarning(kasas, kasaTransactions, kasaMetrics);
    const aktifMarka = brands.filter((b) => b.status === "active").length;
    const toplamIzlenme = totalViewsForMonth(
      brandLinks,
      brandViewership,
      currentMonth,
      linkSnapshots,
      currentMonth,
    );

    return {
      ...pending,
      ...payroll,
      ...kasa,
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
    user?.id,
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
