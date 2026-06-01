"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  Clapperboard,
  Eye,
  ExternalLink,
  Film,
  History,
  Link2,
  Receipt,
  Sparkles,
  TrendingUp,
  Video,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { PlatformGlyph } from "@/lib/platform-glyph";
import { BrandLinkThumb } from "@/components/brand-link-thumb";
import { LinkDetailsModal } from "@/components/link-details-modal";
import {
  enrichBrandLinksForMonth,
  sortBrandLinksDisplay,
  type EnrichedBrandLink,
} from "@/lib/brand-link-display";
import {
  fmtCompactViews,
  linkEngagementForMonth,
  linkViewsForMonth,
} from "@/lib/brand-month-metrics";
import { aggregateStreamersForMonth } from "@/lib/streamer-month-metrics";
import {
  brandExpenseShareUsd,
  expenseMatchesBrand,
  formatExpenseBrandLabel,
  resolveExpenseBrandIds,
} from "@/lib/content-expense-brands";
import {
  expenseReviewStatus,
  isActiveContentExpense,
  settlementLabel,
} from "@/lib/content-expense";
import { isAutoTrackable } from "@/lib/social-api/platform-detect";
import { fmt, isoToLocalDateOnly, planDateInWeek, todayDateLocal } from "@/lib/data";
import { weekRangeLabel } from "@/components/weekly-plan-ui";
import { fmtDateOnly } from "@/lib/fmt-date";
import {
  useStore,
  type Brand,
  type BrandLink,
  type ContentExpense,
  type LinkSnapshot,
  type WeekBrandReel,
} from "@/store/store";

const CONTENT_TYPE_LABEL: Record<string, string> = {
  reels: "Reels",
  post: "Post",
  story: "Story",
  video: "Video",
  live: "Canlı",
  other: "Diğer",
};

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-lg font-bold tabular-nums text-foreground mt-0.5">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
          <Icon size={16} />
        </span>
      </div>
    </div>
  );
}

function brandLabel(brands: Brand[], brandId?: string) {
  if (!brandId) return "Diğer";
  return (
    brands.find((b) => b.id === brandId)?.shortName ??
    brands.find((b) => b.id === brandId)?.name ??
    "—"
  );
}

function expenseUsdForFilter(
  e: ContentExpense,
  brandFilter: string,
  brands: Brand[]
): number {
  if (brandFilter === "all") return e.amountUsd;
  return brandExpenseShareUsd(e, brandFilter, brands);
}

function matchesBrandFilter(
  brandId: string | undefined,
  brandFilter: string,
  brands: Brand[],
  expense?: ContentExpense
): boolean {
  if (brandFilter === "all") return true;
  if (brandId === brandFilter) return true;
  if (expense) {
    const b = brands.find((x) => x.id === brandFilter);
    if (b && expenseMatchesBrand(expense, b, brands)) return true;
  }
  return false;
}

export function StreamerOperationsHub({
  employeeId,
  employeeName,
  planWeek,
  planMonthYm,
}: {
  employeeId: string;
  employeeName: string;
  planWeek: string;
  planMonthYm: string;
}) {
  const {
    brandLinks,
    linkSnapshots,
    brandViewership,
    contentExpenses,
    weekBrandReels,
    brands,
    employees,
    weeklyPlans,
    salaryExtras,
  } = useStore();

  const todayYm = todayDateLocal().slice(0, 7);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [detailsLink, setDetailsLink] = useState<BrandLink | null>(null);
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);

  const relatedBrands = useMemo(() => {
    const ids = new Set<string>();
    for (const l of brandLinks) {
      if (l.ownerId === employeeId && l.brandId) ids.add(l.brandId);
    }
    for (const e of contentExpenses) {
      if (e.employeeId !== employeeId || e.month !== planMonthYm) continue;
      for (const id of resolveExpenseBrandIds(e, brands)) ids.add(id);
    }
    for (const r of weekBrandReels) {
      if (r.employeeId === employeeId && r.brandId) ids.add(r.brandId);
    }
    for (const p of weeklyPlans) {
      if (p.employeeId !== employeeId || !planDateInWeek(p.date, planWeek)) continue;
      const name = (p.brandName ?? "").trim().toLowerCase();
      if (!name) continue;
      const hit = brands.find(
        (b) =>
          b.shortName.trim().toLowerCase() === name ||
          b.name.trim().toLowerCase() === name
      );
      if (hit) ids.add(hit.id);
    }
    return brands
      .filter((b) => ids.has(b.id))
      .sort((a, b) => a.shortName.localeCompare(b.shortName, "tr"));
  }, [
    brandLinks,
    contentExpenses,
    weekBrandReels,
    weeklyPlans,
    brands,
    employeeId,
    planMonthYm,
    planWeek,
  ]);

  const myLinksAll = useMemo(() => {
    const enriched = enrichBrandLinksForMonth(
      brandLinks.filter((l) => l.ownerId === employeeId),
      planMonthYm,
      linkSnapshots,
      todayYm,
      employees
    );
    return sortBrandLinksDisplay(enriched, "views");
  }, [brandLinks, employeeId, planMonthYm, linkSnapshots, todayYm, employees]);

  const myLinks = useMemo(
    () =>
      brandFilter === "all"
        ? myLinksAll
        : myLinksAll.filter((l) => l.brandId === brandFilter),
    [myLinksAll, brandFilter]
  );

  const monthViewsFromLinks = useMemo(
    () =>
      myLinks.reduce((s, l) => {
        const v = linkViewsForMonth(l, planMonthYm, linkSnapshots, todayYm).lastViews;
        return s + v;
      }, 0),
    [myLinks, planMonthYm, linkSnapshots, todayYm]
  );

  const agg = useMemo(() => {
    const rows = aggregateStreamersForMonth({
      employees,
      brandLinks,
      brandViewership,
      monthYm: planMonthYm,
      linkSnapshots,
      todayYm,
    });
    return rows.find((r) => r.employeeId === employeeId) ?? null;
  }, [
    employees,
    brandLinks,
    brandViewership,
    planMonthYm,
    linkSnapshots,
    todayYm,
    employeeId,
  ]);

  const monthExpensesRaw = useMemo(
    () =>
      contentExpenses
        .filter(
          (e) =>
            e.employeeId === employeeId &&
            e.month === planMonthYm &&
            isActiveContentExpense(e)
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [contentExpenses, employeeId, planMonthYm]
  );

  const monthExpenses = useMemo(
    () =>
      monthExpensesRaw.filter((e) => {
        if (brandFilter === "all") return true;
        const b = brands.find((x) => x.id === brandFilter);
        return b ? expenseMatchesBrand(e, b, brands) : false;
      }),
    [monthExpensesRaw, brandFilter, brands]
  );

  const weekExpenses = useMemo(
    () => monthExpenses.filter((e) => planDateInWeek(e.date, planWeek)),
    [monthExpenses, planWeek]
  );

  const expenseTotals = useMemo(() => {
    let activeUsd = 0;
    let approvedUsd = 0;
    let pendingCount = 0;
    let payrollLinkedUsd = 0;
    const byBrand = new Map<string, number>();

    for (const e of monthExpensesRaw) {
      const usd = expenseUsdForFilter(e, brandFilter, brands);
      if (brandFilter !== "all") {
        const b = brands.find((x) => x.id === brandFilter);
        if (!b || !expenseMatchesBrand(e, b, brands)) continue;
      }
      activeUsd += usd;
      const st = expenseReviewStatus(e);
      if (st === "approved" || e.paid) approvedUsd += usd;
      if (st === "pending" || st === "needs_info") pendingCount += 1;

      if (e.salaryExtraId || e.settlementMode === "payroll") {
        payrollLinkedUsd += usd;
      }

      for (const bid of resolveExpenseBrandIds(e, brands)) {
        const share =
          brandFilter === "all"
            ? brandExpenseShareUsd(e, bid, brands)
            : bid === brandFilter
              ? usd
              : 0;
        if (share > 0) byBrand.set(bid, (byBrand.get(bid) ?? 0) + share);
      }
      if (resolveExpenseBrandIds(e, brands).length === 0 && e.brandName) {
        byBrand.set("_manual", (byBrand.get("_manual") ?? 0) + e.amountUsd);
      }
    }

    return { activeUsd, approvedUsd, pendingCount, payrollLinkedUsd, byBrand };
  }, [monthExpensesRaw, brandFilter, brands]);

  const payrollExtras = useMemo(
    () =>
      salaryExtras
        .filter(
          (se) =>
            se.employeeId === employeeId &&
            se.month === planMonthYm &&
            (se.type === "expense" || se.contentExpenseId)
        )
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
    [salaryExtras, employeeId, planMonthYm]
  );

  const payrollExtrasFiltered = useMemo(() => {
    if (brandFilter === "all") return payrollExtras;
    return payrollExtras.filter((se) => {
      if (!se.contentExpenseId) return false;
      const exp = contentExpenses.find((x) => x.id === se.contentExpenseId);
      if (!exp) return false;
      const b = brands.find((x) => x.id === brandFilter);
      return b ? expenseMatchesBrand(exp, b, brands) : false;
    });
  }, [payrollExtras, brandFilter, contentExpenses, brands]);

  const myReelsAll = useMemo(() => {
    return weekBrandReels
      .filter((r) => r.employeeId === employeeId)
      .map((r) => ({
        ...r,
        dayIso: isoToLocalDateOnly(r.publishedAt ?? r.createdAt ?? r.weekStart),
        inPlanWeek: planDateInWeek(
          isoToLocalDateOnly(r.publishedAt ?? r.createdAt ?? r.weekStart),
          planWeek
        ),
      }))
      .sort((a, b) => (b.dayIso > a.dayIso ? 1 : -1));
  }, [weekBrandReels, employeeId, planWeek]);

  const myReels = useMemo(
    () =>
      brandFilter === "all"
        ? myReelsAll
        : myReelsAll.filter((r) => r.brandId === brandFilter),
    [myReelsAll, brandFilter]
  );

  const manualViews = useMemo(
    () =>
      brandViewership.filter((v) => {
        if (v.employeeId !== employeeId || v.month !== planMonthYm) return false;
        return matchesBrandFilter(v.brandId, brandFilter, brands);
      }),
    [brandViewership, employeeId, planMonthYm, brandFilter, brands]
  );

  const plansWeekCount = useMemo(
    () =>
      weeklyPlans.filter((p) => {
        if (p.employeeId !== employeeId || !planDateInWeek(p.date, planWeek)) return false;
        if (brandFilter === "all") return true;
        const name = (p.brandName ?? "").trim().toLowerCase();
        const b = brands.find((x) => x.id === brandFilter);
        if (!b || !name) return false;
        return (
          name === b.shortName.trim().toLowerCase() ||
          name === b.name.trim().toLowerCase()
        );
      }).length,
    [weeklyPlans, employeeId, planWeek, brandFilter, brands]
  );

  const expensesHref = useMemo(() => {
    const q = new URLSearchParams({ month: planMonthYm, employee: employeeId });
    if (brandFilter !== "all") q.set("brand", brandFilter);
    return `/icerik-harcamalari?${q.toString()}`;
  }, [planMonthYm, employeeId, brandFilter]);

  const filterLabel =
    brandFilter === "all"
      ? "Tüm markalar"
      : brandLabel(brands, brandFilter);

  return (
    <Card
      id="plan-yayinci-hub"
      className="scroll-mt-28 border-[#FF6B00]/25 bg-gradient-to-br from-orange-50/40 to-card dark:from-orange-950/15"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp size={18} className="text-[#FF6B00]" />
              {employeeName} · operasyon & performans
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              {weekRangeLabel(planWeek)} · {planMonthYm}
              {brandFilter !== "all" && (
                <span className="font-medium text-foreground"> · {filterLabel}</span>
              )}
              {" "}
              — linkler, API metrikleri, içerik harcamaları ve paylaşımlar (salt okunur özet; veri silinmez).
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[140px]">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Marka filtresi</p>
              <Select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                options={[
                  { value: "all", label: "Tüm markalar" },
                  ...relatedBrands.map((b) => ({
                    value: b.id,
                    label: b.shortName || b.name,
                  })),
                ]}
              />
            </div>
            <Link
              href="/izlenme"
              className="inline-flex h-9 items-center rounded-md border border-border bg-card px-2.5 text-[11px] font-medium hover:bg-accent"
            >
              İzlenme panosu
            </Link>
            <Link
              href={expensesHref}
              className="inline-flex h-9 items-center rounded-md border border-border bg-card px-2.5 text-[11px] font-medium hover:bg-accent"
            >
              İçerik harcamaları
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label={`${planMonthYm} izlenme`}
            value={fmtCompactViews(
              brandFilter === "all" ? (agg?.totalViews ?? 0) : monthViewsFromLinks
            )}
            sub={
              brandFilter === "all"
                ? `${agg?.activeLinkCount ?? 0} aktif link`
                : `${myLinks.length} link · filtreli`
            }
            icon={Eye}
          />
          <KpiCard
            label="Link kaydı"
            value={String(myLinks.length)}
            sub={`${myLinks.filter((l) => l.url?.trim()).length} URL`}
            icon={Link2}
          />
          <KpiCard
            label="İçerik harcaması"
            value={fmt(expenseTotals.activeUsd)}
            sub={`${monthExpenses.length} kayıt · hafta ${fmt(weekExpenses.reduce((s, e) => s + expenseUsdForFilter(e, brandFilter, brands), 0))}`}
            icon={Film}
          />
          <KpiCard
            label="Onaylı / ödeme"
            value={fmt(expenseTotals.approvedUsd)}
            sub={
              expenseTotals.pendingCount > 0
                ? `${expenseTotals.pendingCount} incelemede`
                : "Bekleyen yok"
            }
            icon={Receipt}
          />
          <KpiCard
            label="Bordro masrafı"
            value={fmt(
              payrollExtrasFiltered.reduce((s, x) => s + Math.abs(x.amount), 0)
            )}
            sub={`${payrollExtrasFiltered.length} ekstra satır`}
            icon={Wallet}
          />
          <KpiCard
            label="Paylaşım"
            value={String(myReels.length)}
            sub={`${myReels.filter((r) => r.inPlanWeek).length} bu hafta · plan ${plansWeekCount}`}
            icon={Video}
          />
        </div>

        <CollapsibleSection
          title="İçerik harcamaları özeti"
          description={`${planMonthYm} ayı — ${filterLabel}. Tutarlar iptal/red hariç; çoklu markada pay eşit bölünür.`}
          defaultOpen
          trailing={
            <Badge variant="secondary" className="text-[10px]">
              {monthExpenses.length} kayıt
            </Badge>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <SummaryTile label="Ay toplamı (aktif)" value={fmt(expenseTotals.activeUsd)} />
            <SummaryTile label="Onaylı tutar" value={fmt(expenseTotals.approvedUsd)} />
            <SummaryTile
              label="Bordroya bağlı"
              value={fmt(expenseTotals.payrollLinkedUsd)}
              hint="salary_extra veya settlementMode=payroll"
            />
            <SummaryTile
              label={`Bu hafta (${weekRangeLabel(planWeek)})`}
              value={fmt(
                weekExpenses.reduce(
                  (s, e) => s + expenseUsdForFilter(e, brandFilter, brands),
                  0
                )
              )}
              hint={`${weekExpenses.length} harcama`}
            />
          </div>

          {brandFilter === "all" && expenseTotals.byBrand.size > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">
                Marka kırılımı (ay)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[...expenseTotals.byBrand.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([bid, usd]) => (
                    <button
                      key={bid}
                      type="button"
                      onClick={() => bid !== "_manual" && setBrandFilter(bid)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2 py-1 text-[11px] hover:bg-accent transition-colors"
                    >
                      {bid === "_manual" ? "Manuel etiket" : brandLabel(brands, bid)}
                      <span className="font-semibold tabular-nums">{fmt(usd)}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {payrollExtrasFiltered.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200/80 bg-amber-50/30 dark:border-amber-500/30 dark:bg-amber-950/20 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-amber-900 dark:text-amber-200 mb-1.5">
                Bordroya eklenen içerik masrafları
              </p>
              <ul className="space-y-1 text-[11px]">
                {payrollExtrasFiltered.map((se) => (
                  <li key={se.id} className="flex justify-between gap-2">
                    <span className="truncate text-foreground">{se.description}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{fmt(se.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ExpenseTable
            rows={monthExpenses}
            brands={brands}
            planWeek={planWeek}
            brandFilter={brandFilter}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="İzlenme linkleri & API"
          description="Snapshot geçmişi, engagement ve izlenme sayfasındaki gibi API detay modalı (yalnızca modal açılınca kota kullanır)."
          defaultOpen={myLinks.length <= 8}
          trailing={
            <Badge variant="outline" className="text-[10px]">
              {myLinks.length} link
            </Badge>
          }
        >
          {myLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">
              Bu filtrede atanmış marka linki yok. İzlenme sayfasından link ekleyin veya owner atayın.
            </p>
          ) : (
            <div className="space-y-2">
              {myLinks.map((link) => (
                <LinkAccordionRow
                  key={link.id}
                  link={link}
                  brands={brands}
                  planMonthYm={planMonthYm}
                  linkSnapshots={linkSnapshots}
                  todayYm={todayYm}
                  expanded={expandedLinkId === link.id}
                  onToggle={() =>
                    setExpandedLinkId((id) => (id === link.id ? null : link.id))
                  }
                  onApiDetails={() => setDetailsLink(link)}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Paylaşımlar & check-in"
          description="Haftalık reel/post URL’leri ve kayıtlı izlenme metrikleri."
          defaultOpen={false}
          trailing={
            <Badge variant="outline" className="text-[10px]">
              {myReels.length}
            </Badge>
          }
        >
          <ReelsTable reels={myReels} brands={brands} planWeek={planWeek} />
        </CollapsibleSection>

        {manualViews.length > 0 && (
          <CollapsibleSection
            title={`Manuel marka izlenme (${planMonthYm})`}
            defaultOpen={false}
          >
            <div className="flex flex-wrap gap-2">
              {manualViews.map((v) => (
                <span
                  key={v.id}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px]"
                >
                  {v.brandName || brandLabel(brands, v.brandId)}
                  <span className="font-semibold tabular-nums">
                    {fmtCompactViews(v.views)}
                  </span>
                  {v.url && (
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <ExternalLink size={10} />
                    </a>
                  )}
                </span>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {brandFilter === "all" && (
          <CollapsibleSection
            title="Hızlı özet — son kayıtlar"
            defaultOpen={false}
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <MiniList
                title="En çok izlenen linkler"
                empty="Bu ay link izlenmesi yok."
                rows={myLinksAll.slice(0, 5).map((l) => ({
                  key: l.id,
                  primary: `${l.platform} · ${brandLabel(brands, l.brandId)}`,
                  secondary: fmtCompactViews(l.lastViews),
                  href: l.url || undefined,
                }))}
              />
              <MiniList
                title="Son harcamalar"
                empty="Kayıt yok."
                rows={monthExpensesRaw.slice(0, 5).map((e) => ({
                  key: e.id,
                  primary: `${formatExpenseBrandLabel(e, brands)} · ${e.category}`,
                  secondary: `${fmt(expenseUsdForFilter(e, "all", brands))} · ${fmtDateOnly(e.date)}`,
                }))}
              />
              <MiniList
                title="Son paylaşımlar"
                empty="Check-in yok."
                rows={myReelsAll.slice(0, 5).map((r) => ({
                  key: r.id,
                  primary: `${brandLabel(brands, r.brandId)} · ${CONTENT_TYPE_LABEL[r.contentType ?? ""] ?? r.platform}`,
                  secondary: r.dayIso,
                  href: r.contentUrl,
                }))}
              />
            </div>
          </CollapsibleSection>
        )}
      </CardContent>

      <LinkDetailsModal
        link={detailsLink}
        open={detailsLink !== null}
        onClose={() => setDetailsLink(null)}
      />
    </Card>
  );
}

function SummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/80 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-bold tabular-nums mt-0.5">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function LinkAccordionRow({
  link,
  brands,
  planMonthYm,
  linkSnapshots,
  todayYm,
  expanded,
  onToggle,
  onApiDetails,
}: {
  link: EnrichedBrandLink;
  brands: Brand[];
  planMonthYm: string;
  linkSnapshots: LinkSnapshot[];
  todayYm: string;
  expanded: boolean;
  onToggle: () => void;
  onApiDetails: () => void;
}) {
  const meta = linkViewsForMonth(link, planMonthYm, linkSnapshots, todayYm);
  const eng = linkEngagementForMonth(link, planMonthYm, linkSnapshots, todayYm);
  const trackable = isAutoTrackable(link.url, link.platform, link.handle);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={expanded}
      >
        <BrandLinkThumb link={link} className="h-10 w-10 shrink-0 rounded-md" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <PlatformGlyph platform={link.platform} size={14} />
            <span className="font-medium text-sm truncate">
              {brandLabel(brands, link.brandId)} · {link.handle || "—"}
            </span>
            {trackable && (
              <Badge variant="outline" className="text-[8px] py-0">
                API
              </Badge>
            )}
            {link.stale && (
              <Badge variant="secondary" className="text-[8px] py-0">
                snapshot yok
              </Badge>
            )}
          </div>
          {link.url && (
            <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
              {link.url}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums">
            {meta.lastViews > 0 ? fmtCompactViews(meta.lastViews) : "—"}
          </p>
          {meta.refDate && (
            <p className="text-[9px] text-muted-foreground">{fmtDateOnly(meta.refDate)}</p>
          )}
        </div>
        <ChevronRight
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-border/60 px-3 py-3 space-y-3 bg-muted/10">
          <div className="flex flex-wrap gap-2 text-[11px]">
            <MetricChip label="Beğeni" value={eng.likes} />
            <MetricChip label="Yorum" value={eng.comments} />
            <MetricChip label="Paylaşım" value={eng.shares} />
            {link.lastCheckedAt && (
              <span className="text-muted-foreground">
                Son kontrol: {fmtDateOnly(link.lastCheckedAt.slice(0, 10))}
              </span>
            )}
            {link.lastRefreshStatus && (
              <Badge variant="outline" className="text-[9px]">
                {link.lastRefreshStatus}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="default" className="h-7 text-[11px]" onClick={onApiDetails}>
              <Sparkles size={12} className="mr-1" />
              API detay (modal)
            </Button>
            {link.brandId && (
              <Link
                href={`/izlenme/marka/${link.brandId}`}
                className="inline-flex h-7 items-center rounded-md border border-border px-2 text-[11px] hover:bg-accent"
              >
                Marka sayfası
              </Link>
            )}
            {link.url && (
              <a
                href={link.url}
                target="_blank"
                rel="noopener"
                className="inline-flex h-7 items-center rounded-md border border-border px-2 text-[11px] hover:bg-accent gap-1"
              >
                URL <ExternalLink size={10} />
              </a>
            )}
          </div>

          {meta.snapsInMonth.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                <History size={12} /> Snapshot geçmişi ({planMonthYm})
              </p>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-muted/40 text-left text-muted-foreground">
                      <th className="px-2 py-1.5">Tarih</th>
                      <th className="px-2 py-1.5 text-right">İzlenme</th>
                      <th className="px-2 py-1.5 text-right">Beğeni</th>
                      <th className="px-2 py-1.5 text-right">Yorum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meta.snapsInMonth.slice(0, 12).map((s) => (
                      <tr key={s.id} className="border-t border-border/50">
                        <td className="px-2 py-1 tabular-nums">{fmtDateOnly(s.date)}</td>
                        <td className="px-2 py-1 text-right tabular-nums font-medium">
                          {fmtCompactViews(s.views)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {s.likes != null ? fmtCompactViews(s.likes) : "—"}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {s.comments != null ? fmtCompactViews(s.comments) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              Bu ay için kayıtlı snapshot yok
              {planMonthYm === todayYm ? " — canlı link alanları veya API yenileme kullanılabilir." : "."}
            </p>
          )}

          {link.notes?.trim() && (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium">Not:</span> {link.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value?: number }) {
  return (
    <span className="rounded-md border border-border bg-card px-2 py-0.5 tabular-nums">
      {label}: {value != null && value > 0 ? fmtCompactViews(value) : "—"}
    </span>
  );
}

function ExpenseTable({
  rows,
  brands,
  planWeek,
  brandFilter,
}: {
  rows: ContentExpense[];
  brands: Brand[];
  planWeek: string;
  brandFilter: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-2">
        Seçili filtrede içerik harcaması yok.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">Tarih</th>
            <th className="px-3 py-2">Marka</th>
            <th className="px-3 py-2">Kategori</th>
            <th className="px-3 py-2">Açıklama</th>
            <th className="px-3 py-2 text-right">USD</th>
            <th className="px-3 py-2">Durum</th>
            <th className="px-3 py-2">Ödeme</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr
              key={e.id}
              className={`border-b border-border/60 hover:bg-muted/30 ${
                planDateInWeek(e.date, planWeek)
                  ? "bg-violet-50/50 dark:bg-violet-950/20"
                  : ""
              }`}
            >
              <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                {fmtDateOnly(e.date)}
              </td>
              <td className="px-3 py-2">{formatExpenseBrandLabel(e, brands)}</td>
              <td className="px-3 py-2">{e.category}</td>
              <td className="px-3 py-2 max-w-[220px] truncate" title={e.description}>
                {e.description}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">
                {fmt(expenseUsdForFilter(e, brandFilter, brands))}
                {brandFilter !== "all" &&
                  resolveExpenseBrandIds(e, brands).length > 1 && (
                    <span className="block text-[9px] text-muted-foreground font-normal">
                      pay
                    </span>
                  )}
              </td>
              <td className="px-3 py-2">
                <Badge variant="outline" className="text-[9px]">
                  {expenseReviewStatus(e)}
                </Badge>
              </td>
              <td className="px-3 py-2 text-[10px] text-muted-foreground max-w-[100px] truncate">
                {settlementLabel(e)}
                {e.salaryExtraId && (
                  <span className="block text-[9px]">bordro #{e.salaryExtraId.slice(0, 8)}…</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border/60">
        Mor satırlar: {weekRangeLabel(planWeek)} içindeki harcamalar.
      </p>
    </div>
  );
}

function MiniList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { key: string; primary: string; secondary: string; href?: string }[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card/80 p-3">
      <p className="text-xs font-semibold text-foreground mb-2">{title}</p>
      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate text-foreground">
                {r.href ? (
                  <a
                    href={r.href}
                    target="_blank"
                    rel="noopener"
                    className="hover:underline inline-flex items-center gap-0.5"
                  >
                    {r.primary}
                    <ExternalLink size={10} className="shrink-0 opacity-50" />
                  </a>
                ) : (
                  r.primary
                )}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{r.secondary}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReelsTable({
  reels,
  brands,
  planWeek,
}: {
  reels: (WeekBrandReel & { dayIso: string; inPlanWeek: boolean })[];
  brands: Brand[];
  planWeek: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">Tarih</th>
            <th className="px-3 py-2">Marka</th>
            <th className="px-3 py-2">Tür</th>
            <th className="px-3 py-2">Platform</th>
            <th className="px-3 py-2">URL</th>
            <th className="px-3 py-2 text-right">İzlenme</th>
            <th className="px-3 py-2 text-right">Etkileşim</th>
          </tr>
        </thead>
        <tbody>
          {reels.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                Paylaşım kaydı yok — Check-in bölümünden URL ile ekleyin.
              </td>
            </tr>
          ) : (
            reels.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-border/60 hover:bg-muted/30 ${
                  r.inPlanWeek ? "bg-emerald-50/40 dark:bg-emerald-950/15" : ""
                }`}
              >
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  {r.dayIso}
                  {r.inPlanWeek && (
                    <Badge variant="outline" className="ml-1 text-[8px] py-0">
                      hafta
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2">{brandLabel(brands, r.brandId)}</td>
                <td className="px-3 py-2">
                  {CONTENT_TYPE_LABEL[r.contentType ?? "other"] ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1">
                    <PlatformGlyph platform={r.platform} size={12} />
                    {r.platform}
                  </span>
                </td>
                <td className="px-3 py-2 max-w-[200px]">
                  <a
                    href={r.contentUrl}
                    target="_blank"
                    rel="noopener"
                    className="truncate block font-mono text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {r.contentUrl}
                  </a>
                  {r.notes && (
                    <p className="truncate text-[10px] text-muted-foreground mt-0.5">{r.notes}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.lastViews != null && r.lastViews > 0 ? fmtCompactViews(r.lastViews) : "—"}
                </td>
                <td className="px-3 py-2 text-right text-[10px] text-muted-foreground tabular-nums">
                  {r.lastLikes != null ? `♥ ${fmtCompactViews(r.lastLikes)}` : "—"}
                  {r.lastComments != null ? ` · 💬 ${r.lastComments}` : ""}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border/60">
        Yeşil satırlar: {weekRangeLabel(planWeek)} içindeki paylaşımlar.
      </p>
    </div>
  );
}
