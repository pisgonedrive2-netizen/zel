"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Eye,
  Link2,
  Megaphone,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import {
  useStore,
  visibleNotificationsForRole,
  weekStartOf,
  type InternalProjectPayment,
} from "@/store/store";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { markaHref } from "@/lib/use-marka-view-month";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { BrandHomeHero } from "@/components/marka-home/brand-home-hero";
import { BrandKpiCard } from "@/components/marka-home/brand-kpi-card";
import { BrandActivityFeed } from "@/components/marka-home/brand-activity-feed";
import { BrandQuickActions } from "@/components/marka-home/brand-quick-actions";
import { BrandMonthlyTrend } from "@/components/brand-monthly-trend";
import { BrandGettingStarted, type GettingStartedStep } from "@/components/marka-home/brand-getting-started";
import { BrandModuleGrid } from "@/components/marka-home/brand-module-grid";
import { BrandAuditorWelcome } from "@/components/marka-home/brand-auditor-welcome";
import { clientHasOrgCapability } from "@/lib/org-capability";
import {
  findBrandMonthlyStats,
  fmtBrandCount,
  fmtBrandMoney,
} from "@/lib/brand-monthly-stats";
import { totalLinkViewsForMonth, fmtCompactViews } from "@/lib/brand-month-metrics";
import { filterWeeklyPlansForBrand } from "@/lib/weekly-plan-brand-match";
import { toYearMonthLocal, todayDateLocal } from "@/lib/data";
import {
  buildBrandAggregatedActivity,
  countActivityDaysInMonth,
  scopeBrandActivityData,
} from "@/lib/brand-activity-dates";
import { MarkaContentOverviewCard } from "@/components/marka/marka-content-overview-card";
import { BrandExecutiveKpis } from "@/components/marka-igaming/brand-executive-kpis";
import { BrandAffiliateFunnel } from "@/components/marka-igaming/brand-affiliate-funnel";
import { BrandKpiTargetsBar } from "@/components/marka-igaming/brand-kpi-targets-bar";
import {
  BrandActionQueue,
  buildActionQueueItems,
} from "@/components/marka-igaming/brand-action-queue";
import { BrandLinkViewershipSummary } from "@/components/brand-link-viewership-summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandPackageGuaranteeCard } from "@/components/marka/brand-package-guarantee-card";
import { useBrandIgaming } from "@/hooks/use-brand-igaming";
import { deriveLiveDemoUsage } from "@/lib/brand-monthly-stats";
import type { ExecutiveKpiSnapshot } from "@/types/brand-igaming";

function monthDayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}

export default function MarkaAnasayfaPage() {
  const portal = useMarkaPortal();
  const {
    user,
    brandId,
    brand,
    month,
    navMonth,
    canViewBrand,
    monthTitle,
    isAdminView,
  } = portal;
  // Admin marka görünümünde tüm modülleri görür; marka kullanıcısı org rolüne göre.
  const orgRole = isAdminView ? "admin" : user?.orgRole;
  const { users } = useAuth();
  const {
    brandMonthlyStats,
    brandLinks,
    linkSnapshots,
    weeklyPlans,
    weekBrandReels,
    projects,
    projectPayments,
    notifications,
    affiliatePartners,
    affiliateDailyStats,
    brandOffers,
    brandPosts,
    brandDeals,
  } = useStore();

  const todayYm = toYearMonthLocal();
  const currentWeek = weekStartOf(todayDateLocal());

  const statsRow = useMemo(
    () =>
      brandId
        ? findBrandMonthlyStats(brandMonthlyStats, brandId, month)
        : undefined,
    [brandMonthlyStats, brandId, month]
  );

  const currency = statsRow?.currency ?? "USD";

  const linksForBrand = useMemo(
    () => (brandId ? brandLinks.filter((l) => l.brandId === brandId) : []),
    [brandLinks, brandId]
  );

  const totalLinkViews = useMemo(
    () => totalLinkViewsForMonth(linksForBrand, month, linkSnapshots, todayYm),
    [linksForBrand, month, linkSnapshots, todayYm]
  );

  const brandWeeklyPlans = useMemo(() => {
    if (!brand) return [];
    return filterWeeklyPlansForBrand(weeklyPlans, brand);
  }, [weeklyPlans, brand]);

  const planEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of brandWeeklyPlans) ids.add(p.employeeId);
    return ids;
  }, [brandWeeklyPlans]);

  const brandProjects = useMemo(
    () => (brandId ? projects.filter((p) => p.brandId === brandId) : []),
    [projects, brandId]
  );

  const projectEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of brandProjects) for (const e of p.employeeIds) ids.add(e);
    return ids;
  }, [brandProjects]);

  const totalStreamers = useMemo(() => {
    const all = new Set<string>([...planEmployeeIds, ...projectEmployeeIds]);
    return all.size;
  }, [planEmployeeIds, projectEmployeeIds]);

  const plansThisWeek = useMemo(
    () => brandWeeklyPlans.filter((p) => weekStartOf(p.date) === currentWeek),
    [brandWeeklyPlans, currentWeek]
  );

  const reelsThisWeek = useMemo(() => {
    if (!brandId) return [];
    return weekBrandReels.filter(
      (r) => r.brandId === brandId && r.weekStart === currentWeek
    );
  }, [weekBrandReels, brandId, currentWeek]);

  const sharingDaysThisMonth = useMemo(() => {
    if (!brandId) return 0;
    const scope = scopeBrandActivityData(brandId, {
      weekBrandReels,
      brandPosts,
      brandLinks,
      brandDeals,
    });
    const { byDate } = buildBrandAggregatedActivity(scope);
    return countActivityDaysInMonth(byDate, month);
  }, [brandId, weekBrandReels, brandPosts, brandLinks, brandDeals, month]);

  const brandPayments = useMemo(() => {
    const projectIds = new Set(brandProjects.map((p) => p.id));
    return projectPayments.filter((pay) => projectIds.has(pay.projectId));
  }, [brandProjects, projectPayments]);

  const pendingPayments = useMemo(
    () =>
      brandPayments
        .filter((p) => p.status === "pending" || p.status === "overdue")
        .sort((a, b) => {
          const da = a.dueDate ?? a.month + "-01";
          const db = b.dueDate ?? b.month + "-01";
          return da.localeCompare(db);
        }),
    [brandPayments]
  );

  const nextPayment: InternalProjectPayment | undefined = pendingPayments[0];
  const totalPendingAmount = pendingPayments.reduce(
    (s, p) => s + p.amount,
    0
  );

  const totalPaidThisMonth = brandPayments
    .filter((p) => p.status === "paid" && p.month === month)
    .reduce((s, p) => s + p.amount, 0);

  // Faz C — Affiliate özet (anasayfa kartı için)
  const brandAffiliatePartners = useMemo(
    () => (brandId ? affiliatePartners.filter((p) => p.brandId === brandId) : []),
    [affiliatePartners, brandId]
  );
  const activeAffiliatePartners = brandAffiliatePartners.filter(
    (p) => p.status === "active"
  );
  const brandAffiliateStatsMonth = useMemo(() => {
    if (!brandId) return [];
    const prefix = `${month}-`;
    return affiliateDailyStats.filter(
      (s) => s.brandId === brandId && s.statDate.startsWith(prefix)
    );
  }, [affiliateDailyStats, brandId, month]);
  const affiliateMonthFtd = brandAffiliateStatsMonth.reduce(
    (sum, s) => sum + (s.ftdCount ?? 0),
    0
  );
  const affiliateMonthCommission = brandAffiliateStatsMonth.reduce(
    (sum, s) => sum + (s.commissionDue ?? 0),
    0
  );
  const affiliateMonthClicks = brandAffiliateStatsMonth.reduce(
    (sum, s) => sum + (s.clicks ?? 0),
    0
  );
  const affiliateMonthRegistrations = brandAffiliateStatsMonth.reduce(
    (sum, s) => sum + (s.registrations ?? 0),
    0
  );
  const hasAffiliateData =
    brandAffiliatePartners.length > 0 || brandAffiliateStatsMonth.length > 0;

  const igaming = useBrandIgaming(brandId, month);

  const executiveCurrent = useMemo((): ExecutiveKpiSnapshot => {
    if (igaming.dashboard) {
      return {
        ftd: igaming.dashboard.ftd,
        activePlayers: igaming.dashboard.activePlayers,
        depositAmount: igaming.dashboard.depositAmount,
        withdrawalAmount: igaming.dashboard.withdrawalAmount,
        ngr: igaming.dashboard.ngr,
        commission: igaming.dashboard.commission,
      };
    }
    return {
      ftd: statsRow?.firstTimeDepositors ?? 0,
      activePlayers: statsRow?.activePlayers ?? 0,
      depositAmount: statsRow?.depositAmount ?? 0,
      withdrawalAmount: statsRow?.withdrawalAmount ?? 0,
      ngr: statsRow?.ngr ?? 0,
      commission: affiliateMonthCommission,
    };
  }, [igaming.dashboard, statsRow, affiliateMonthCommission]);

  const executivePrevious = useMemo((): ExecutiveKpiSnapshot | null => {
    if (!igaming.prevDashboard) return null;
    return {
      ftd: igaming.prevDashboard.ftd,
      activePlayers: igaming.prevDashboard.activePlayers,
      depositAmount: igaming.prevDashboard.depositAmount,
      withdrawalAmount: igaming.prevDashboard.withdrawalAmount,
      ngr: igaming.prevDashboard.ngr,
      commission: igaming.prevDashboard.commission,
    };
  }, [igaming.prevDashboard]);

  const liveDemoUsage = statsRow ? deriveLiveDemoUsage(statsRow) : null;

  const operasyonHref = markaHref("/marka/operasyon", month);
  const takvimHref = markaHref("/marka/takvim", month);
  const odemelerHref = markaHref("/marka/odemeler", month);
  const izlenmeHref = markaHref("/marka/izlenmeler", month);
  const bildirimlerHref = markaHref("/marka/bildirimler", month);

  const actionQueueItems = useMemo(() => {
    const pendingOfferCount =
      igaming.dashboard?.pendingOffers ??
      (brandId
        ? brandOffers.filter(
            (o) =>
              o.brandId === brandId &&
              (o.status === "pending" || o.status === "negotiating")
          ).length
        : 0);
    const openCompliance =
      igaming.dashboard?.openCompliance ??
      igaming.compliance.filter((c) => c.status === "pending").length;
    const complianceOverdue = igaming.compliance.filter(
      (c) =>
        c.status === "pending" &&
        c.dueDate &&
        c.dueDate < new Date().toISOString().slice(0, 10)
    ).length;
    const affiliateAnomaly =
      affiliateMonthRegistrations > 0 &&
      affiliateMonthFtd / affiliateMonthRegistrations < 0.05 &&
      affiliateMonthRegistrations >= 20;

    return buildActionQueueItems({
      pendingOffers: pendingOfferCount,
      openCompliance,
      complianceOverdue,
      lowDemoBalance: liveDemoUsage?.low ?? false,
      demoRemaining: statsRow?.liveDemoRemaining,
      demoCurrency: currency,
      affiliateAnomaly,
      hrefs: {
        offers: "/marka/teklifler",
        compliance: "/marka/profil",
        operasyon: operasyonHref,
        affiliate: markaHref("/marka/affiliate", month),
      },
    });
  }, [
    igaming.dashboard,
    igaming.compliance,
    brandId,
    brandOffers,
    liveDemoUsage,
    statsRow,
    currency,
    operasyonHref,
    month,
    affiliateMonthRegistrations,
    affiliateMonthFtd,
  ]);

  // Bildirimler (marka rolüne ait + brand kullanıcısı eşleşmesi)
  const targetUserId = useMemo(() => {
    if (!user) return null;
    if (user.role === "brand") return user.id;
    if (user.role === "admin" && brandId) {
      const linked = users.find(
        (u) => u.role === "brand" && u.brandId === brandId
      );
      return linked?.id ?? null;
    }
    return null;
  }, [user, users, brandId]);

  const brandNotifications = useMemo(() => {
    if (!targetUserId) return [];
    return visibleNotificationsForRole(
      notifications,
      "brand",
      targetUserId,
      brandId ? [brandId] : undefined
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [notifications, targetUserId, brandId]);

  // Başlangıç kontrol listesi adımları (yeni marka için)
  const gettingStartedSteps: GettingStartedStep[] = useMemo(() => {
    const hasProfile = !!(brand?.category?.trim() && (brand?.monthlyTarget ?? 0) > 0);
    const hasKpi = statsRow != null;
    const hasLinks = linksForBrand.length > 0;
    const hasOffers = brandId ? brandOffers.some((o) => o.brandId === brandId) : false;
    const hasAffiliate = brandAffiliatePartners.length > 0;
    const steps: GettingStartedStep[] = [
      { id: "profile", label: "Marka profilini tamamla", description: "Kategori ve aylık hedef belirle", href: "/marka/profil", done: hasProfile },
      { id: "kpi", label: "Aylık KPI gir", description: "Kayıt, FTD, yatırım — bu ay", href: markaHref("/marka/operasyon", month), done: hasKpi },
      { id: "links", label: "İzlenme linklerini ekle", description: "Sosyal/yayın platform linkleri", href: markaHref("/marka/izlenmeler", month), done: hasLinks },
      {
        id: "sharing-calendar",
        label: "Paylaşım takvimini senkronla",
        description: "Yayıncı takvimi ve achievement senkronu",
        href: markaHref("/marka/takvim", month),
        done: sharingDaysThisMonth > 0,
      },
      { id: "premium-discovery", label: "Premium keşif dene", description: "Trend, hashtag ve rakip arama", href: "/marka/kesif", done: false, optional: true },
      { id: "pool-offer", label: "Yayıncı havuzundan teklif gönder", description: "Doğru yayıncıyı bul ve teklif et", href: "/marka/havuz", done: hasOffers },
      { id: "affiliate", label: "Affiliate partner ekle", description: "Partner performansını takip et", href: markaHref("/marka/affiliate", month), done: hasAffiliate },
    ];

    // Org rolüne/capability'sine göre modül kurulum adımları (isteğe bağlı CTA'lar).
    // Veri sinyali kolayca erişilemediğinden "tamamlandı" zorlanmaz.
    if (clientHasOrgCapability(orgRole, "hr")) {
      steps.push({ id: "personel", label: "Personel ekle", description: "Ekibe ilk personeli tanımla", href: "/marka/personel", done: false, optional: true });
    }
    if (clientHasOrgCapability(orgRole, "crm")) {
      steps.push({ id: "crm", label: "CRM'e ilk lead'i gir", description: "Potansiyel müşteri ve fırsat takibi", href: "/marka/crm", done: false, optional: true });
    }
    if (clientHasOrgCapability(orgRole, "finance")) {
      steps.push({ id: "finance", label: "Muhasebeyi başlat", description: "Gelir/gider ve fatura takibi", href: "/marka/muhasebe", done: false, optional: true });
    }
    if (clientHasOrgCapability(orgRole, "team")) {
      steps.push({ id: "team", label: "Ekip üyesi davet et", description: "Rol ve yetkilerle ekip kur", href: "/marka/ekip", done: false, optional: true });
    }

    return steps;
  }, [
    brand,
    statsRow,
    linksForBrand,
    brandId,
    brandOffers,
    brandAffiliatePartners,
    month,
    orgRole,
    sharingDaysThisMonth,
  ]);

  const gettingStartedDone = gettingStartedSteps
    .filter((s) => !s.optional)
    .every((s) => s.done);

  return (
    <MarkaPageGuard
      user={user}
      canViewBrand={canViewBrand}
      brandId={brandId}
      brand={brand}
    >
      {brand && brandId && (
        <div className="mx-auto max-w-[1280px] space-y-5 pb-10">
          {user?.orgRole === "auditor" && (
            <BrandAuditorWelcome
              brandName={brand.name}
              brandId={brandId}
              month={month}
            />
          )}
          <BrandHomeHero
            brandId={brand.id}
            brandName={brand.name}
            shortName={brand.shortName}
            monthYm={month}
            monthTitle={monthTitle}
            onPrevMonth={() => navMonth(-1)}
            onNextMonth={() => navMonth(1)}
            target={brand.monthlyTarget}
            actual={
              statsRow?.depositAmount ??
              igaming.dashboard?.depositAmount ??
              0
            }
            ftd={
              statsRow?.firstTimeDepositors ??
              igaming.dashboard?.ftd ??
              0
            }
            currency={currency}
            kpiHref={operasyonHref}
            showEmptyHint={!statsRow && !igaming.dashboard && !igaming.loading}
          />

          {!gettingStartedDone && (
            <BrandGettingStarted brandName={brand.name} steps={gettingStartedSteps} />
          )}

          <MarkaContentOverviewCard
            brandId={brandId}
            brandName={brand.name}
            monthYm={month}
            monthTitle={monthTitle}
            storeSlice={{
              weekBrandReels,
              brandPosts,
              brandLinks,
              brandDeals,
            }}
            compact
          />

          {linksForBrand.length > 0 ? (
            <BrandLinkViewershipSummary
              links={linksForBrand}
              snapshots={linkSnapshots}
              viewMonth={month}
              todayYm={todayYm}
              title="Link izlenme metrikleri"
              compact
            />
          ) : (
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 size={15} className="text-muted-foreground" />
                  Link izlenme metrikleri
                </CardTitle>
                <CardDescription>
                  Henüz takip edilen marka linki yok.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Linkler yönetici veya yayıncı tarafından eklenir. Eklendikten sonra toplam,
                  aylık ve yeni link cohort izlenmeleri burada görünür.
                </p>
                <Link
                  href={izlenmeHref}
                  className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
                >
                  İzlenmeler sayfasına git →
                </Link>
              </CardContent>
            </Card>
          )}

          <BrandExecutiveKpis
            monthTitle={monthTitle}
            currency={currency}
            current={executiveCurrent}
            previous={executivePrevious}
            loading={igaming.loading}
          />

          <BrandPackageGuaranteeCard actualViews={totalLinkViews} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BrandAffiliateFunnel
              clicks={igaming.dashboard?.affiliateClicks ?? affiliateMonthClicks}
              registrations={
                igaming.dashboard?.affiliateRegistrations ?? affiliateMonthRegistrations
              }
              ftd={igaming.dashboard?.affiliateFtd ?? affiliateMonthFtd}
              monthTitle={monthTitle}
            />
            <BrandKpiTargetsBar
              monthTitle={monthTitle}
              currency={currency}
              targets={igaming.targets}
              actual={{
                ftd: executiveCurrent.ftd,
                ngr: executiveCurrent.ngr,
                depositAmount: executiveCurrent.depositAmount,
                registrations: statsRow?.newRegistrations ?? 0,
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <BrandKpiCard
                  color="green"
                  icon={BarChart3}
                  title="Operasyon"
                  subtitle={monthTitle}
                  metrics={[
                    {
                      label: "Kayıt",
                      value: fmtBrandCount(statsRow?.newRegistrations ?? 0),
                    },
                    {
                      label: "FTD",
                      value: fmtBrandCount(
                        statsRow?.firstTimeDepositors ?? 0
                      ),
                    },
                    {
                      label: "Yatırım",
                      value: fmtBrandMoney(
                        statsRow?.depositAmount ?? 0,
                        currency
                      ),
                    },
                    {
                      label: "Çekim",
                      value: fmtBrandMoney(
                        statsRow?.withdrawalAmount ?? 0,
                        currency
                      ),
                    },
                  ]}
                  href={operasyonHref}
                  linkLabel="Detay"
                />

                <BrandKpiCard
                  color="orange"
                  icon={Megaphone}
                  title="Yayıncı partner"
                  subtitle={`Bu hafta · ${monthDayLabel(currentWeek)}+`}
                  metrics={[
                    {
                      label: "İzlenme",
                      value: fmtCompactViews(totalLinkViews),
                      sub: monthTitle.split(" ")[0],
                    },
                    {
                      label: "Yayıncı",
                      value: fmtBrandCount(totalStreamers),
                    },
                    {
                      label: "Plan",
                      value: fmtBrandCount(plansThisWeek.length),
                    },
                    {
                      label: "Reel",
                      value: fmtBrandCount(reelsThisWeek.length),
                    },
                  ]}
                  href={markaHref("/marka/izlenmeler", month)}
                  linkLabel="İzlenme"
                />

                <BrandKpiCard
                  color="pink"
                  icon={TrendingUp}
                  title="Affiliate"
                  subtitle={hasAffiliateData ? monthTitle : "İlk affiliate partnerinizi ekleyin"}
                  empty={!hasAffiliateData}
                  metrics={[
                    {
                      label: "Aktif partner",
                      value: hasAffiliateData
                        ? fmtBrandCount(activeAffiliatePartners.length)
                        : "—",
                      sub: hasAffiliateData
                        ? `${brandAffiliatePartners.length} toplam`
                        : undefined,
                    },
                    {
                      label: "FTD",
                      value: hasAffiliateData
                        ? fmtBrandCount(affiliateMonthFtd)
                        : "—",
                    },
                    {
                      label: "Komisyon",
                      value: hasAffiliateData
                        ? fmtBrandMoney(affiliateMonthCommission, "USD")
                        : "—",
                    },
                    {
                      label: "Tıklama",
                      value: hasAffiliateData
                        ? fmtCompactViews(affiliateMonthClicks)
                        : "—",
                    },
                  ]}
                  href={markaHref("/marka/affiliate", month)}
                  linkLabel={hasAffiliateData ? "Detay" : "Partner ekleyin"}
                />

                <BrandKpiCard
                  color="blue"
                  icon={Wallet}
                  title="Ödeme"
                  subtitle={
                    nextPayment?.dueDate
                      ? `Sıradaki ${monthDayLabel(nextPayment.dueDate)}`
                      : pendingPayments.length === 0
                        ? "Bekleyen ödeme yok"
                        : "Sıradaki taksit"
                  }
                  metrics={[
                    {
                      label: "Sıradaki",
                      value: nextPayment
                        ? fmtBrandMoney(nextPayment.amount, "USD")
                        : "—",
                      sub: nextPayment?.dueDate ?? undefined,
                    },
                    {
                      label: "Bekleyen",
                      value: fmtBrandMoney(totalPendingAmount, "USD"),
                      sub: `${pendingPayments.length} taksit`,
                    },
                    {
                      label: "Ödenmiş",
                      value: fmtBrandMoney(totalPaidThisMonth, "USD"),
                      sub: monthTitle.split(" ")[0],
                    },
                    {
                      label: "Proje",
                      value: fmtBrandCount(brandProjects.length),
                    },
                  ]}
                  href={odemelerHref}
                  linkLabel="Detay"
                />
              </div>

              <BrandQuickActions
                actions={[
                  {
                    href: operasyonHref,
                    label: "Aylık KPI gir",
                    description: "Kayıt, FTD, yatırım — bu ay",
                    icon: BarChart3,
                    color: "green",
                  },
                  {
                    href: "/marka/havuz",
                    label: "Yayıncı havuzu",
                    description: "Doğru yayıncıyı bul, teklif gönder",
                    icon: Megaphone,
                    color: "orange",
                  },
                  {
                    href: izlenmeHref,
                    label: "İzlenme detayı",
                    description: "Linkler ve snapshotlar",
                    icon: Eye,
                    color: "blue",
                  },
                  {
                    href: bildirimlerHref,
                    label: "Bildirimler",
                    description: `${brandNotifications.filter((n) => !n.read).length} okunmamış`,
                    icon: Activity,
                    color: "pink",
                  },
                ]}
              />

              <BrandMonthlyTrend
                brandId={brandId}
                monthYm={month}
                months={6}
                todayYm={todayYm}
              />
            </div>

            <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:max-h-[760px] space-y-4">
              <BrandActionQueue items={actionQueueItems} monthTitle={monthTitle} />
              <BrandActivityFeed
                notifications={brandNotifications}
                href={bildirimlerHref}
                limit={10}
              />
            </div>
          </div>

          <BrandModuleGrid orgRole={orgRole} month={month} />
        </div>
      )}
    </MarkaPageGuard>
  );
}
