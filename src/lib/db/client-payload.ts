import {
  brandLinkFromRow,
  contentExpenseFromRow,
  linkSnapshotFromRow,
  scheduleSlotFromRow,
  streamerAccountFromRow,
  viewershipFromRow,
  weekBrandReelFromRow,
  weeklyPlanFromRow,
} from "@/lib/db/mappers";
import type {
  BrandLink,
  BrandViewership,
  ContentExpense,
  LinkSnapshot,
  ScheduleSlot,
  StreamerAccount,
  WeekBrandReel,
  WeeklyPlan,
} from "@/store/store";

/** Store / persistRowImmediate camelCase gönderir; DB satırları snake_case. */

export function brandLinkFromPayload(row: Record<string, unknown>): BrandLink {
  if (row.brandId != null) return row as unknown as BrandLink;
  return brandLinkFromRow(row);
}

export function contentExpenseFromPayload(row: Record<string, unknown>): ContentExpense {
  if (row.employeeId != null) return row as unknown as ContentExpense;
  return contentExpenseFromRow(row);
}

export function linkSnapshotFromPayload(row: Record<string, unknown>): LinkSnapshot {
  if (row.linkId != null) return row as unknown as LinkSnapshot;
  return linkSnapshotFromRow(row);
}

export function viewershipFromPayload(row: Record<string, unknown>): BrandViewership {
  if (row.brandId != null && row.month != null) return row as unknown as BrandViewership;
  return viewershipFromRow(row);
}

export function weeklyPlanFromPayload(row: Record<string, unknown>): WeeklyPlan {
  if (row.employeeId != null) return row as unknown as WeeklyPlan;
  return weeklyPlanFromRow(row);
}

export function weekBrandReelFromPayload(row: Record<string, unknown>): WeekBrandReel {
  if (row.employeeId != null) return row as unknown as WeekBrandReel;
  return weekBrandReelFromRow(row);
}

export function streamerAccountFromPayload(row: Record<string, unknown>): StreamerAccount {
  if (row.employeeId != null) return row as unknown as StreamerAccount;
  return streamerAccountFromRow(row);
}

export function scheduleSlotFromPayload(row: Record<string, unknown>): ScheduleSlot {
  if (row.employeeId != null) return row as unknown as ScheduleSlot;
  return scheduleSlotFromRow(row);
}
