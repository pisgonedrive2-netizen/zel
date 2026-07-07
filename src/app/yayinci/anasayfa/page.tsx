"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clapperboard,
  Clock,
  Eye,
  Link2,
  Lock,
  Send,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import { usePanelView } from "@/store/panel-view";
import {
  useStore,
  calcNetPayable,
  isPayrollActive,
  visibleNotificationsForRole,
  type StreamerPoolProfile,
} from "@/store/store";
import { fmt, toYearMonthLocal } from "@/lib/data";
import { monthLabelTr } from "@/lib/month-label";
import { fmtCompactViews } from "@/lib/brand-month-metrics";
import { aggregateStreamersForMonth } from "@/lib/streamer-month-metrics";
import {
  buildPayrollPaymentLines,
  formatPayrollLineStatusSummary,
  payrollPaymentPhase,
} from "@/lib/payroll-lines";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StreamerTodayTasksCard } from "@/components/yayinci/streamer-today-tasks-card";
import { StreamerQuickActions } from "@/components/yayinci/streamer-quick-actions";
import { StreamerGettingStarted,
  type StreamerGettingStartedStep,
} from "@/components/yayinci/streamer-getting-started";
import { refreshMyNotificationsFromServer } from "@/lib/notification-actions";

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function poolProfileComplete(
  employeeId: string,
  profiles: StreamerPoolProfile[]
): boolean {
  const profile = profiles.find((p) => p.employeeId === employeeId);
  if (!profile) return false;
  if (profile.status === "published") return true;
  return (
    profile.headline.trim().length > 0 &&
    profile.bio.trim().length > 0 &&
    profile.categories.length > 0
  );
}

export default function YayinciAnasayfaPage() {
  const { user } = useAuth();
  const panelViewAs = usePanelView((s) => s.panelViewAs);
  const employees = useStore((s) => s.employees);
  const contentExpenses = useStore((s) => s.contentExpenses);
  const notifications = useStore((s) => s.notifications);
  const salaryExtras = useStore((s) => s.salaryExtras);
  const advances = useStore((s) => s.advances);
  const paymentStatuses = useStore((s) => s.paymentStatuses);
  const streamerAccounts = useStore((s) => s.streamerAccounts);
  const brandLinks = useStore((s) => s.brandLinks);
  const brandViewership = useStore((s) => s.brandViewership);
  const linkSnapshots = useStore((s) => s.linkSnapshots);
  const weeklyPlans = useStore((s) => s.weeklyPlans);
  const streamerPoolProfiles = useStore((s) => s.streamerPoolProfiles);
  const brandOffers = useStore((s) => s.brandOffers);

  const targetEmployeeId = panelViewAs?.employeeId ?? user?.employeeId;
  const me = employees.find((e) => e.id === targetEmployeeId);
  const isAdminView = user?.role === "admin" && !!panelViewAs;
  const month = toYearMonthLocal();
  const todayYm = month;

  const myExpenses = useMemo(
    () => (me ? contentExpenses.filter((e) => e.employeeId === me.id) : []),
    [contentExpenses, me]
  );

  const streamerNotifs = user
    ? visibleNotificationsForRole(notifications, "streamer", user.id)
    : [];

  useEffect(() => {
    if (!user?.id) return;
    void refreshMyNotificationsFromServer("streamer", user.id);
    const t = setInterval(() => {
      void refreshMyNotificationsFromServer("streamer", user.id);
    }, 60_000);
    return () => clearInterval(t);
  }, [user?.id]);

  const pendingCount = myExpenses.filter((e) => e.reviewStatus === "pending").length;
  const needsInfoCount = myExpenses.filter((e) => e.reviewStatus === "needs_info").length;
  const unreadExpenseNotifs = streamerNotifs.filter(
    (n) =>
      !n.read &&
      (n.href?.includes("/yayinci/harcamalar") ||
        n.type === "expense_approved" ||
        n.type === "expense_rejected" ||
        n.type === "expense_paid" ||
        (n.type === "general" && n.title.toLowerCase().includes("harcama")))
  ).length;
  const harcamalarBadge = Math.max(needsInfoCount, unreadExpenseNotifs, pendingCount);

  const unreadOffers = useMemo(() => {
    if (!me) return 0;
    return brandOffers.filter(
      (o) =>
        o.employeeId === me.id &&
        (o.status === "pending" || o.status === "negotiating")
    ).length;
  }, [brandOffers, me]);

  const payrollSummary = useMemo(() => {
    if (!me) return null;
    const active = isPayrollActive(me, month);
    const net = calcNetPayable(me, month, advances, salaryExtras, paymentStatuses);
    const payrollLines = active
      ? buildPayrollPaymentLines(
          me,
          month,
          advances,
          salaryExtras,
          contentExpenses,
          paymentStatuses
        )
      : [];
    const phase = payrollPaymentPhase(payrollLines);
    return { active, net, payrollLines, phase };
  }, [me, month, advances, salaryExtras, paymentStatuses, contentExpenses]);

  const viewershipSummary = useMemo(() => {
    if (!me) return null;
    const rows = aggregateStreamersForMonth({
      employees,
      brandLinks,
      brandViewership,
      monthYm: month,
      linkSnapshots,
      todayYm,
    });
    const row = rows.find((r) => r.employeeId === me.id);
    if (!row || (row.totalViews <= 0 && row.linkCount <= 0)) return null;
    return row;
  }, [me, employees, brandLinks, brandViewership, month, linkSnapshots, todayYm]);

  const gettingStartedSteps: StreamerGettingStartedStep[] = useMemo(() => {
    if (!me) return [];
    const myAccounts = streamerAccounts.filter((a) => a.employeeId === me.id);
    const myLinks = brandLinks.filter((l) => l.ownerId === me.id);
    const myPlans = weeklyPlans.filter((p) => p.employeeId === me.id);
    return [
      {
        id: "onboarding",
        label: "Havuz profilini kur",
        description: "Sihirbaz ile başlık, bio ve ücret",
        href: "/yayinci/onboarding",
        done: poolProfileComplete(me.id, streamerPoolProfiles),
      },
      {
        id: "hesaplar",
        label: "Sosyal hesap ekle",
        description: "Instagram, YouTube, Twitch vb.",
        href: "/yayinci/hesaplar",
        done: myAccounts.length > 0,
      },
      {
        id: "marka-linkleri",
        label: "Marka linki ekle",
        description: "İzlenme takibi için marka URL'leri",
        href: "/yayinci/marka-linkleri",
        done: myLinks.length > 0,
      },
      {
        id: "harcamalar",
        label: "İlk harcama gönder",
        description: "İçerik masrafını onaya gönder",
        href: "/yayinci/harcamalar",
        done: myExpenses.length > 0,
      },
      {
        id: "takvim",
        label: "Haftalık plan oluştur",
        description: "Yayın ve paylaşım takvimini doldur",
        href: "/yayinci/takvim",
        done: myPlans.length > 0,
      },
    ];
  }, [
    me,
    streamerAccounts,
    brandLinks,
    weeklyPlans,
    myExpenses,
    streamerPoolProfiles,
  ]);

  const gettingStartedDone = gettingStartedSteps.every((s) => s.done);

  if (!user) {
    return (
      <div className="p-8">
        <div className="mx-auto mt-20 max-w-md text-center">
          <Lock className="mx-auto mb-3 text-muted-foreground" size={32} />
          <h2 className="text-lg font-medium">Erişim Yok</h2>
          <p className="mt-1 text-sm text-muted-foreground">Oturum gerekli.</p>
        </div>
      </div>
    );
  }

  if (isAdminView && !me) {
    return (
      <div className="p-8">
        <div className="mx-auto mt-20 max-w-md text-center">
          <h2 className="text-lg font-medium">Çalışan bulunamadı</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {panelViewAs?.employeeName} kaydı silinmiş olabilir.
          </p>
        </div>
      </div>
    );
  }

  if (!isAdminView && (user.role !== "streamer" || !me)) {
    return (
      <div className="p-8">
        <div className="mx-auto mt-20 max-w-md text-center">
          <Lock className="mx-auto mb-3 text-muted-foreground" size={32} />
          <h2 className="text-lg font-medium">Erişim Yok</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bu sayfa yalnızca yayıncı kullanıcılara açıktır.
          </p>
        </div>
      </div>
    );
  }

  if (!me) return null;

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 pb-10">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-blue-500/5 to-emerald-500/10 opacity-80"
        />
        <div className="relative z-10 p-5 lg:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
            Yayıncı paneli
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">
            {timeGreeting()}, {firstName(me.name)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthLabelTr(month)} özeti — maaş, harcama ve günlük görevlerin tek ekranda
          </p>
        </div>
      </div>

      <StreamerTodayTasksCard userId={user.id} />

      <StreamerQuickActions
        actions={[
          {
            href: "/yayinci/harcamalar",
            label: "Harcama ekle",
            description: "İçerik masrafı gönder",
            icon: Clapperboard,
            color: "orange",
            badge: harcamalarBadge,
          },
          {
            href: "/yayinci/takvim",
            label: "Plan aç",
            description: "Haftalık yayın takvimi",
            icon: CalendarDays,
            color: "green",
          },
          {
            href: "/yayinci/marka-linkleri",
            label: "Link ekle",
            description: "Marka izlenme linki",
            icon: Link2,
            color: "blue",
          },
          {
            href: "/yayinci/teklifler",
            label: "Teklifler",
            description:
              unreadOffers > 0
                ? `${unreadOffers} bekleyen teklif`
                : "Marka iş birlikleri",
            icon: Send,
            color: "pink",
            badge: unreadOffers,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50/60 to-blue-50/10 dark:border-blue-500/40 dark:from-blue-950/55 dark:to-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet size={14} className="text-blue-700 dark:text-blue-300" />
              Maaş özeti — {monthLabelTr(month)}
            </CardTitle>
            <CardDescription>Bu ay net ödeme ve durum</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-blue-900 dark:text-blue-100">
              {payrollSummary?.active ? fmt(payrollSummary.net) : "—"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {payrollSummary?.phase === "full" ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 size={12} /> Tüm kalemler ödendi
                </span>
              ) : payrollSummary?.phase === "partial" ? (
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} />
                  {formatPayrollLineStatusSummary(payrollSummary.payrollLines)}
                </span>
              ) : payrollSummary?.active ? (
                "Maaş ödemesi bekliyor"
              ) : (
                "Bordro bu ay aktif değil"
              )}
            </p>
            <Link
              href="/yayinci/maas"
              className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
            >
              Maaş detayı →
            </Link>
          </CardContent>
        </Card>

        {viewershipSummary ? (
          <Card className="border-emerald-200/70 bg-emerald-50/25 dark:border-emerald-500/40 dark:bg-emerald-950/35">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Eye size={14} className="text-emerald-800 dark:text-emerald-300" />
                İzlenme özeti — {monthLabelTr(month)}
              </CardTitle>
              <CardDescription>Marka linkleri ve manuel kayıtlar</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                {fmtCompactViews(viewershipSummary.totalViews)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {viewershipSummary.activeLinkCount} aktif link ·{" "}
                {viewershipSummary.brandIds.size} marka
              </p>
              <Link
                href="/yayinci/izlenmeler"
                className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
              >
                İzlenme detayı →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Link2 size={14} className="text-muted-foreground" />
                İzlenme özeti
              </CardTitle>
              <CardDescription>Henüz izlenme verisi yok</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Marka linkleri ekledikten sonra aylık izlenmeler burada görünür.
              </p>
              <Link
                href="/yayinci/marka-linkleri"
                className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
              >
                Marka linki ekle →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {!gettingStartedDone && (
        <StreamerGettingStarted streamerName={me.name} steps={gettingStartedSteps} />
      )}
    </div>
  );
}
