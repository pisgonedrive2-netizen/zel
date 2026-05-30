"use client";

import { useMemo } from "react";
import {
  Activity,
  BarChart3,
  Eye,
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
import { clientHasOrgCapability } from "@/lib/org-capability";
import {
  findBrandMonthlyStats,
  fmtBrandCount,
  fmtBrandMoney,
} from "@/lib/brand-monthly-stats";
import { totalLinkViewsForMonth, fmtCompactViews } from "@/lib/brand-month-metrics";
import { filterWeeklyPlansForBrand } from "@/lib/weekly-plan-brand-match";
import { toYearMonthLocal, todayDateLocal } from "@/lib/data";

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
  const hasAffiliateData =
    brandAffiliatePartners.length > 0 || brandAffiliateStatsMonth.length > 0;

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
    return visibleNotificationsForRole(notifications, "brand", targetUserId).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    );
  }, [notifications, targetUserId]);

  // Başlangıç kontrol listesi adımları (yeni marka için)
  const gettingStartedSteps: GettingStartedStep[] = useMemo(() => {
    const hasProfile = !!(brand?.category?.trim() && (brand?.monthlyTarget ?? 0) > 0);
    const hasKpi = statsRow != null;
    const hasLinks = linksForBrand.length > 0;
    const hasOffers = brandId ? brandOffers.some((o) => o.brandId === brandId) : false;
    const hasAffiliate = brandAffiliatePartners.length > 0;
    const steps: GettingStartedStep[] = [
      { label: "Marka profilini tamamla", description: "Kategori ve aylık hedef belirle", href: "/marka/profil", done: hasProfile },
      { label: "Aylık KPI gir", description: "Kayıt, FTD, yatırım — bu ay", href: markaHref("/marka/operasyon", month), done: hasKpi },
      { label: "İzlenme linklerini ekle", description: "Sosyal/yayın platform linkleri", href: markaHref("/marka/izlenmeler", month), done: hasLinks },
      { label: "Yayıncı havuzundan teklif gönder", description: "Doğru yayıncıyı bul ve teklif et", href: "/marka/havuz", done: hasOffers },
      { label: "Affiliate partner ekle", description: "Partner performansını takip et", href: markaHref("/marka/affiliate", month), done: hasAffiliate },
    ];

    // Org rolüne/capability'sine göre modül kurulum adımları (isteğe bağlı CTA'lar).
    // Veri sinyali kolayca erişilemediğinden "tamamlandı" zorlanmaz.
    if (clientHasOrgCapability(orgRole, "hr")) {
      steps.push({ label: "Personel ekle", description: "Ekibe ilk personeli tanımla", href: "/marka/personel", done: false, optional: true });
    }
    if (clientHasOrgCapability(orgRole, "crm")) {
      steps.push({ label: "CRM'e ilk lead'i gir", description: "Potansiyel müşteri ve fırsat takibi", href: "/marka/crm", done: false, optional: true });
    }
    if (clientHasOrgCapability(orgRole, "finance")) {
      steps.push({ label: "Muhasebeyi başlat", description: "Gelir/gider ve fatura takibi", href: "/marka/muhasebe", done: false, optional: true });
    }
    if (clientHasOrgCapability(orgRole, "team")) {
      steps.push({ label: "Ekip üyesi davet et", description: "Rol ve yetkilerle ekip kur", href: "/marka/ekip", done: false, optional: true });
    }

    return steps;
  }, [brand, statsRow, linksForBrand, brandId, brandOffers, brandAffiliatePartners, month, orgRole]);

  const gettingStartedDone = gettingStartedSteps
    .filter((s) => !s.optional)
    .every((s) => s.done);

  const operasyonHref = markaHref("/marka/operasyon", month);
  const takvimHref = markaHref("/marka/takvim", month);
  const odemelerHref = markaHref("/marka/odemeler", month);
  const izlenmeHref = markaHref("/marka/izlenmeler", month);
  const bildirimlerHref = markaHref("/marka/bildirimler", month);

  return (
    <MarkaPageGuard
      user={user}
      canViewBrand={canViewBrand}
      brandId={brandId}
      brand={brand}
    >
      {brand && brandId && (
        <div className="mx-auto max-w-[1280px] space-y-5 pb-10">
          <BrandHomeHero
            brandId={brand.id}
            brandName={brand.name}
            shortName={brand.shortName}
            monthYm={month}
            monthTitle={monthTitle}
            onPrevMonth={() => navMonth(-1)}
            onNextMonth={() => navMonth(1)}
            target={brand.monthlyTarget}
            actual={statsRow?.depositAmount ?? 0}
            ftd={statsRow?.firstTimeDepositors ?? 0}
            currency={currency}
            kpiHref={operasyonHref}
          />

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
                    {
                      label: "İzlenme",
                      value: fmtCompactViews(totalLinkViews),
                      sub: monthTitle.split(" ")[0],
                    },
                  ]}
                  href={takvimHref}
                  linkLabel="Takvim"
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

            <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:max-h-[760px]">
              <BrandActivityFeed
                notifications={brandNotifications}
                href={bildirimlerHref}
                limit={10}
              />
            </div>
          </div>

          {!gettingStartedDone && (
            <BrandGettingStarted brandName={brand.name} steps={gettingStartedSteps} />
          )}

          <BrandModuleGrid orgRole={orgRole} month={month} />
        </div>
      )}
    </MarkaPageGuard>
  );
}
