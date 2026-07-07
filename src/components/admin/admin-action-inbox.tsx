"use client";

import Link from "next/link";
import {
  AlertCircle,
  ClipboardList,
  Clapperboard,
  Users,
  Wallet,
} from "lucide-react";
import { fmt } from "@/lib/data";
import { cn } from "@/lib/utils";
import {
  useAdminDashboardMetrics,
  useAdminOverdueTasks,
  LOW_KASA_WARNING_THRESHOLD,
} from "@/lib/admin-dashboard-metrics";

type InboxChip = {
  href: string;
  label: string;
  count: number;
  detail?: string;
  accent?: boolean;
  icon: React.ComponentType<{ className?: string; size?: number }>;
};

export function AdminActionInbox({ className }: { className?: string }) {
  const metrics = useAdminDashboardMetrics();
  const { overdueTaskCount } = useAdminOverdueTasks();

  const chips: InboxChip[] = [
    {
      href: "/onaylar",
      label: "Onay Merkezi",
      count:
        metrics.pendingContentExpenseCount + metrics.unpaidPayrollCount,
      detail: "Bekleyen onay & ödeme",
      accent:
        metrics.pendingContentExpenseCount + metrics.unpaidPayrollCount > 0,
      icon: AlertCircle,
    },
    {
      href: "/icerik-harcamalari",
      label: "İçerik Harcamaları",
      count: metrics.pendingContentExpenseCount,
      detail:
        metrics.pendingContentExpenseCount > 0
          ? fmt(metrics.pendingContentExpenseTotal)
          : "Bekleyen yok",
      accent: metrics.pendingContentExpenseCount > 0,
      icon: Clapperboard,
    },
    {
      href: "/maaslar",
      label: "Bordro Ödemeleri",
      count: metrics.unpaidPayrollCount,
      detail:
        metrics.unpaidPayrollCount > 0
          ? fmt(metrics.unpaidPayrollTotal)
          : "Tamamlandı",
      accent: metrics.unpaidPayrollCount > 0,
      icon: Users,
    },
    {
      href: "/kasa",
      label: "Kasa",
      count: metrics.isLow ? 1 : 0,
      detail: metrics.isLow
        ? `${fmt(metrics.balance)} · eşik ${fmt(metrics.threshold || LOW_KASA_WARNING_THRESHOLD)}`
        : fmt(metrics.balance),
      accent: metrics.isLow,
      icon: Wallet,
    },
    {
      href: "/gorevler",
      label: "Görevler",
      count: overdueTaskCount,
      detail: overdueTaskCount > 0 ? "Geciken görev" : "Gecikme yok",
      accent: overdueTaskCount > 0,
      icon: ClipboardList,
    },
  ];

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {chips.map((chip) => (
        <Link
          key={chip.href}
          href={chip.href}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-muted/60",
            chip.accent
              ? "border-amber-300 bg-amber-50/50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100"
              : "border-border bg-card text-foreground",
          )}
        >
          <chip.icon
            size={14}
            className={cn(
              "shrink-0",
              chip.accent
                ? "text-amber-700 dark:text-amber-300"
                : "text-muted-foreground",
            )}
          />
          <span className="font-medium">{chip.label}</span>
          {chip.count > 0 && (
            <span
              className={cn(
                "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                chip.accent
                  ? "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-50"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {chip.count}
            </span>
          )}
          {chip.detail && (
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              · {chip.detail}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
