import { buildBrandAggregatedActivity, scopeBrandActivityData } from "@/lib/brand-activity-dates";
import type { MarkaStoreSlice } from "@/lib/marka-brand-insights";
import { todayDateLocal } from "@/lib/data";
import type { BrandDeal, WeeklyPlan } from "@/store/store";

export type PlanShareGap = {
  date: string;
  employeeId: string;
  employeeName?: string;
  planCount: number;
};

/** Bu hafta plan var ama paylaşım yok — gün bazlı. */
export function planDaysWithoutShare(
  brandId: string,
  weekDays: string[],
  weekPlans: WeeklyPlan[],
  partnerIds: string[],
  data: MarkaStoreSlice,
  employeeNames: Map<string, string>
): PlanShareGap[] {
  const scope = scopeBrandActivityData(brandId, data);
  const { byDate } = buildBrandAggregatedActivity(scope, partnerIds);
  const gaps: PlanShareGap[] = [];
  const today = todayDateLocal();

  for (const date of weekDays) {
    if (date > today) continue;
    const dayPlans = weekPlans.filter((p) => p.date === date);
    if (dayPlans.length === 0) continue;
    if (byDate.has(date)) continue;
    const byEmp = new Map<string, number>();
    for (const p of dayPlans) {
      byEmp.set(p.employeeId, (byEmp.get(p.employeeId) ?? 0) + 1);
    }
    for (const [employeeId, planCount] of byEmp) {
      gaps.push({
        date,
        employeeId,
        employeeName: employeeNames.get(employeeId),
        planCount,
      });
    }
  }
  return gaps;
}

export type DeliverableGap = {
  type: string;
  platform: string | null;
  target: number;
  matched: number;
  missing: number;
  overdue: boolean;
};

export function deliverableGaps(
  deal: BrandDeal,
  rows: { type: string; platform: string | null; target: number; matched: number }[]
): DeliverableGap[] {
  const today = todayDateLocal();
  const overdueDeal =
    !!deal.endDate && deal.endDate < today && ["active", "disputed"].includes(deal.status);

  return rows
    .filter((r) => r.target > 0 && r.matched < r.target)
    .map((r) => ({
      type: r.type,
      platform: r.platform,
      target: r.target,
      matched: r.matched,
      missing: r.target - r.matched,
      overdue: overdueDeal,
    }));
}

/** Yayıncının bu markada son paylaşım günü (ISO date). */
export function streamerLastShareDate(
  brandId: string,
  employeeId: string,
  data: MarkaStoreSlice
): string | null {
  const scope = scopeBrandActivityData(brandId, data);
  const { byDate } = buildBrandAggregatedActivity(scope, [employeeId]);
  const dates = [...byDate.keys()].sort();
  return dates.at(-1) ?? null;
}
