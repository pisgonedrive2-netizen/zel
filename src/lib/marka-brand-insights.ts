import {
  buildBrandAggregatedActivity,
  buildBrandStreamerActivity,
  countActivityDaysInMonth,
  scopeBrandActivityData,
} from "@/lib/brand-activity-dates";
import { isoToLocalDateOnly } from "@/lib/data";
import type { BrandDeal, BrandLink, BrandOffer, BrandPost, WeekBrandReel } from "@/store/store";
import type { CrmContact, CrmDeal } from "@/types/crm";
import type { BrandStaff, BrandDepartment } from "@/types/brand-personnel";
import type { OrgTeamMember } from "@/lib/db/org-team-repo";
import type { AffiliateDailyStat, AffiliatePartner, AffiliatePayout } from "@/store/store";

export type MarkaStoreSlice = {
  weekBrandReels: WeekBrandReel[];
  brandPosts: BrandPost[];
  brandLinks: BrandLink[];
  brandDeals: BrandDeal[];
  brandOffers?: BrandOffer[];
};

export type MarkaContentInsights = {
  sharingDaysMonth: number;
  partnerCount: number;
  postsMonth: number;
  reelsMonth: number;
  activeLinks: number;
  linksWithOwner: number;
};

export function computeMarkaContentInsights(
  brandId: string,
  monthYm: string,
  data: MarkaStoreSlice
): MarkaContentInsights {
  const scope = scopeBrandActivityData(brandId, data);
  const { byDate } = buildBrandAggregatedActivity(scope);
  const prefix = `${monthYm}-`;
  const postsMonth = scope.posts.filter((p) => {
    const d = isoToLocalDateOnly(p.postedAt ?? p.createdAt);
    return d.startsWith(prefix);
  }).length;
  const reelsMonth = scope.reels.filter((r) => {
    const d = isoToLocalDateOnly(r.publishedAt ?? r.createdAt);
    return d.startsWith(prefix);
  }).length;
  return {
    sharingDaysMonth: countActivityDaysInMonth(byDate, monthYm),
    partnerCount: new Set(
      scope.links.filter((l) => l.ownerId).map((l) => l.ownerId as string)
    ).size,
    postsMonth,
    reelsMonth,
    activeLinks: scope.links.filter((l) => l.status === "active").length,
    linksWithOwner: scope.links.filter((l) => l.ownerId && l.status === "active").length,
  };
}

export function streamerSharingDaysForBrand(
  brandId: string,
  employeeId: string,
  monthYm: string,
  data: MarkaStoreSlice
): number {
  const scope = scopeBrandActivityData(brandId, data);
  const { byDate } = buildBrandStreamerActivity(employeeId, scope);
  return countActivityDaysInMonth(byDate, monthYm);
}

export type StreamerBrandRelation = {
  offersActive: number;
  dealsActive: number;
  sharingDaysMonth: number;
};

export function streamerBrandRelation(
  brandId: string,
  employeeId: string,
  monthYm: string,
  data: MarkaStoreSlice & { brandOffers?: BrandOffer[] }
): StreamerBrandRelation {
  const offers = (data.brandOffers ?? []).filter(
    (o) => o.brandId === brandId && o.employeeId === employeeId
  );
  const offersActive = offers.filter((o) =>
    ["pending", "negotiating"].includes(o.status)
  ).length;
  const dealsActive = data.brandDeals.filter(
    (d) =>
      d.brandId === brandId &&
      d.employeeId === employeeId &&
      ["active", "disputed"].includes(d.status)
  ).length;
  return {
    offersActive,
    dealsActive,
    sharingDaysMonth: streamerSharingDaysForBrand(brandId, employeeId, monthYm, data),
  };
}

export type OfferStats = {
  pending: number;
  negotiating: number;
  accepted: number;
  rejected: number;
  activeBudgetUsd: number;
  acceptedThisMonth: number;
};

export function computeOfferStats(offers: BrandOffer[], brandId: string, monthYm: string): OfferStats {
  const mine = offers.filter((o) => o.brandId === brandId);
  const prefix = `${monthYm}-`;
  let activeBudgetUsd = 0;
  for (const o of mine) {
    if (["pending", "negotiating"].includes(o.status) && o.budgetUsd) {
      activeBudgetUsd += o.budgetUsd;
    }
  }
  return {
    pending: mine.filter((o) => o.status === "pending").length,
    negotiating: mine.filter((o) => o.status === "negotiating").length,
    accepted: mine.filter((o) => o.status === "accepted").length,
    rejected: mine.filter((o) => o.status === "rejected").length,
    activeBudgetUsd,
    acceptedThisMonth: mine.filter(
      (o) => o.status === "accepted" && o.updatedAt.startsWith(prefix)
    ).length,
  };
}

export type DealStats = {
  active: number;
  completed: number;
  budgetUsd: number;
  paidUsd: number;
  postsCount: number;
  totalViews: number;
};

export function computeDealStats(deals: BrandDeal[], brandId: string): DealStats {
  const mine = deals.filter((d) => d.brandId === brandId);
  const active = mine.filter((d) => ["active", "disputed"].includes(d.status));
  return {
    active: active.length,
    completed: mine.filter((d) => d.status === "completed").length,
    budgetUsd: active.reduce((s, d) => s + d.budgetUsd, 0),
    paidUsd: active.reduce((s, d) => s + d.paidUsd, 0),
    postsCount: active.reduce((s, d) => s + d.postsCount, 0),
    totalViews: active.reduce((s, d) => s + Number(d.totalViews), 0),
  };
}

export type CrmInsights = {
  contactCount: number;
  activeContacts: number;
  lostDeals: number;
  openDeals: number;
  weightedPipelineUsd: number;
  winRatePct: number | null;
};

export function computeCrmInsights(contacts: CrmContact[], deals: CrmDeal[]): CrmInsights {
  const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const won = deals.filter((d) => d.stage === "won");
  const lost = deals.filter((d) => d.stage === "lost");
  const closed = won.length + lost.length;
  const weightedPipelineUsd = open.reduce(
    (s, d) => s + d.value * (Math.min(100, Math.max(0, d.probability)) / 100),
    0
  );
  return {
    contactCount: contacts.length,
    activeContacts: contacts.filter((c) => c.status === "active" || c.status === "vip").length,
    lostDeals: lost.length,
    openDeals: open.length,
    weightedPipelineUsd,
    winRatePct: closed > 0 ? Math.round((won.length / closed) * 100) : null,
  };
}

export type DepartmentInsights = {
  departmentCount: number;
  totalStaff: number;
  unassigned: number;
  assignedPct: number;
};

export function computeDepartmentInsights(
  departments: BrandDepartment[],
  staff: BrandStaff[],
  memberCount: Map<string, number>
): DepartmentInsights {
  const assigned = staff.filter((s) => s.departmentId).length;
  const totalStaff = staff.length;
  return {
    departmentCount: departments.length,
    totalStaff,
    unassigned: staff.filter((s) => !s.departmentId).length,
    assignedPct: totalStaff > 0 ? Math.round((assigned / totalStaff) * 100) : 0,
  };
}

export type TeamInsights = {
  total: number;
  active: number;
  readOnly: number;
  roleCounts: Record<string, number>;
};

export function computeTeamInsights(members: OrgTeamMember[]): TeamInsights {
  const roleCounts: Record<string, number> = {};
  let readOnly = 0;
  let active = 0;
  for (const m of members) {
    roleCounts[m.orgRole] = (roleCounts[m.orgRole] ?? 0) + 1;
    if (m.orgRole === "auditor" || m.orgRole === "viewer") readOnly += 1;
    if (m.user?.active !== false) active += 1;
  }
  return { total: members.length, active, readOnly, roleCounts };
}

export type AffiliateMonthInsights = {
  partnerCount: number;
  activePartners: number;
  clicks: number;
  registrations: number;
  ftd: number;
  commission: number;
  pendingPayouts: number;
  dailyFtd: { date: string; ftd: number }[];
};

export function computeAffiliateMonthInsights(
  partners: AffiliatePartner[],
  stats: AffiliateDailyStat[],
  payouts: AffiliatePayout[],
  brandId: string,
  monthYm: string
): AffiliateMonthInsights {
  const prefix = `${monthYm}-`;
  const monthStats = stats.filter((s) => s.brandId === brandId && s.statDate.startsWith(prefix));
  const byDay = new Map<string, number>();
  for (const s of monthStats) {
    const day = s.statDate.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + (s.ftdCount ?? 0));
  }
  const dailyFtd = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, ftd]) => ({ date, ftd }));

  const brandPartners = partners.filter((p) => p.brandId === brandId);
  const totals = monthStats.reduce(
    (acc, s) => {
      acc.clicks += s.clicks ?? 0;
      acc.registrations += s.registrations ?? 0;
      acc.ftd += s.ftdCount ?? 0;
      acc.commission += s.commissionDue ?? 0;
      return acc;
    },
    { clicks: 0, registrations: 0, ftd: 0, commission: 0 }
  );

  return {
    partnerCount: brandPartners.length,
    activePartners: brandPartners.filter((p) => p.status === "active").length,
    ...totals,
    pendingPayouts: payouts.filter(
      (p) => p.brandId === brandId && (p.status === "pending" || p.status === "approved")
    ).length,
    dailyFtd,
  };
}

export type PostListInsights = {
  total: number;
  totalViews: number;
  totalLikes: number;
  byPlatform: Record<string, number>;
};

export function computePostListInsights(posts: BrandPost[]): PostListInsights {
  const byPlatform: Record<string, number> = {};
  let totalViews = 0;
  let totalLikes = 0;
  for (const p of posts) {
    byPlatform[p.platform] = (byPlatform[p.platform] ?? 0) + 1;
    totalViews += Number(p.views) || 0;
    totalLikes += Number(p.likes) || 0;
  }
  return { total: posts.length, totalViews, totalLikes, byPlatform };
}
