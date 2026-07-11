"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clapperboard,
  Eye,
  FileSpreadsheet,
  LayoutDashboard,
  Users,
  Wallet,
  CalendarDays,
} from "lucide-react";
import { useAuth, landingFor } from "@/store/auth";
import { isMainAdmin } from "@/lib/user-guards";
import { monthLabelTr } from "@/lib/month-label";
import { fmt, toYearMonthLocal } from "@/lib/data";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import { fmtDateShort } from "@/lib/fmt-date";
import { PageShell, PageHeader } from "@/components/page-shell";
import { AdminActionInbox } from "@/components/admin/admin-action-inbox";
import { SystemBackupStatusCard } from "@/components/admin/system-backup-status-card";
import { AdminWeekPlanOverview } from "@/components/admin/admin-week-plan-overview";
import { useAdminDashboardMetrics } from "@/lib/admin-dashboard-metrics";
import { useStore, weekStartOf } from "@/store/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PanelPage() {
  const { user } = useAuth();
  const router = useRouter();
  const allowed = user?.role === "admin";
  const metrics = useAdminDashboardMetrics();
  const { employees, weeklyPlans } = useStore();
  const [planWeek, setPlanWeek] = useState(() => weekStartOf());
  const currentMonth = toYearMonthLocal(new Date());
  const showOzetLink = user ? isMainAdmin(user) : false;

  useEffect(() => {
    if (user && !allowed) {
      router.replace(landingFor(user.role, user));
    }
  }, [user, allowed, router]);

  if (!user || !allowed) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground py-8 text-center">Yükleniyor…</p>
      </PageShell>
    );
  }

  const greetingName = user.name?.split(" ")[0] ?? user.username;

  return (
    <PageShell size="lg">
      <PageHeader
        title="Kontrol Paneli"
        description={`${greetingName}, ${monthLabelTr(currentMonth)} · günlük operasyon özeti`}
        icon={
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FF6B00]/20 to-sky-500/20 text-[#FF6B00] flex items-center justify-center shrink-0">
            <LayoutDashboard size={18} />
          </div>
        }
        actions={
          metrics.unreadNotificationCount > 0 ? (
            <Badge variant="outline" className="gap-1 text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-300 dark:border-blue-500/40 dark:bg-blue-950/30">
              <Bell size={12} />
              {metrics.unreadNotificationCount} yeni bildirim
            </Badge>
          ) : undefined
        }
      />

      <div className="mb-5">
        <AdminActionInbox />
      </div>

      <AdminWeekPlanOverview
        weekStart={planWeek}
        onWeekChange={setPlanWeek}
        plans={weeklyPlans}
        employees={employees}
        compact
        href="/takvim"
      />

      {showOzetLink && (
        <div className="mb-5">
          <SystemBackupStatusCard compact />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          title="Bekleyen Onay"
          value={String(metrics.pendingContentExpenseCount)}
          sub={
            metrics.pendingContentExpenseCount > 0
              ? `${fmt(metrics.pendingContentExpenseTotal)} toplam`
              : "İnceleme bekleyen yok"
          }
          accent={metrics.pendingContentExpenseCount > 0}
          icon={Clapperboard}
        />
        <KpiCard
          title="Ödenmemiş Bordro"
          value={String(metrics.unpaidPayrollCount)}
          sub={
            metrics.unpaidPayrollCount > 0
              ? `${fmt(metrics.unpaidPayrollTotal)} · ${monthLabelTr(currentMonth)}`
              : "Bu ay tamamlandı"
          }
          accent={metrics.unpaidPayrollCount > 0}
          icon={Users}
        />
        <KpiCard
          title="Aktif Marka"
          value={String(metrics.activeBrandCount)}
          sub="İzlenme takibinde"
          icon={Eye}
        />
        <KpiCard
          title="Aylık İzlenme"
          value={fmtCompactViews(metrics.monthlyViews)}
          sub={`${metrics.monthlyViews.toLocaleString("tr-TR")} · ${monthLabelTr(currentMonth)}`}
          icon={Eye}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-2 mb-6">
        <QuickBtn href="/takvim" label="Haftalık Takvim" icon={CalendarDays} accent />
        <QuickBtn href="/onaylar" label="Onay Merkezi" icon={AlertCircle} accent={metrics.pendingContentExpenseCount + metrics.unpaidPayrollCount > 0} />
        <QuickBtn href="/icerik-harcamalari" label="İçerik Harcamaları" icon={Clapperboard} />
        <QuickBtn href="/maaslar" label="Maaş Bordrosu" icon={Users} />
        <QuickBtn href="/kasa" label="Kasa" icon={Wallet} accent={metrics.isLow} />
        <QuickBtn href="/gorevler" label="Görevler" icon={LayoutDashboard} />
        <QuickBtn href="/bildirimler" label="Bildirimler" icon={Bell} />
        <QuickBtn href="/rapor" label="Ödeme Raporu" icon={FileSpreadsheet} />
        <QuickBtn href="/izlenme" label="İzlenme Panosu" icon={Eye} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell size={14} />
              Son Bildirimler
            </CardTitle>
            <CardDescription>Admin bildirim akışından son 6 kayıt</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.recentNotifications.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4 text-center">
                Henüz bildirim yok.
              </p>
            ) : (
              <div className="space-y-1.5">
                {metrics.recentNotifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.href ?? "/bildirimler"}
                    className={`block px-3 py-2 rounded-lg border transition-colors hover:bg-muted/40 ${
                      n.read
                        ? "border-border bg-card"
                        : "border-blue-200 bg-blue-50/30 dark:border-blue-500/40 dark:bg-blue-950/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{n.message}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {fmtDateShort(n.createdAt)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Link
                href="/bildirimler"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Tüm bildirimler
                <ArrowRight size={14} className="ml-1" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {showOzetLink && (
          <Card className="lg:max-w-xs h-fit border-violet-200 bg-violet-50/30 dark:border-violet-500/40 dark:bg-violet-950/20">
            <CardHeader>
              <CardTitle className="text-base">Tam Özet Paneli</CardTitle>
              <CardDescription>
                Gelir/gider grafikleri, kasa detayı ve yıllık KPI&apos;lar yalnızca ana yönetici özetinde.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/ozet"
                className={cn(buttonVariants(), "w-full")}
              >
                Özet paneline git
                <ArrowRight size={14} className="ml-1.5" />
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {metrics.pendingContentExpenseCount === 0 &&
        metrics.unpaidPayrollCount === 0 &&
        !metrics.isLow && (
          <p className="mt-4 text-sm text-muted-foreground text-center flex items-center justify-center gap-1.5">
            <CheckCircle2 size={14} className="text-green-600 dark:text-green-400" />
            Bekleyen kritik aksiyon yok — iyi gidiyorsunuz.
          </p>
        )}
    </PageShell>
  );
}

function KpiCard({
  title,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  title: string;
  value: string;
  sub: string;
  accent?: boolean;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}) {
  return (
    <Card className={`gap-2 py-5 ${accent ? "border-amber-300 bg-amber-50/30 dark:border-amber-500/40 dark:bg-amber-950/30" : ""}`}>
      <CardHeader className="pb-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Icon size={11} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-0">
        <p className={`text-2xl font-bold tabular-nums ${accent ? "text-amber-700 dark:text-amber-300" : ""}`}>
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{sub}</p>
      </CardContent>
    </Card>
  );
}

function QuickBtn({
  href,
  label,
  icon: Icon,
  accent,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "h-auto py-2 justify-start",
        accent && "border-amber-300 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-950/30",
      )}
    >
      <Icon size={14} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
