import {
  weekDayIsosFromStart,
  weekStartFromDateIso,
  normalizeWeekAnchorIso,
  planDateInWeek,
} from "@/lib/data";
import type { WeeklyPlan } from "@/store/store";

/** Kaynak haftadaki planları hedef haftanın aynı günlerine kopyala (iptal hariç). */
export function buildWeeklyPlansRepeat(
  sourcePlans: WeeklyPlan[],
  sourceWeekStart: string,
  targetWeekStart: string,
  employeeId: string,
  createdBy?: string
): Omit<WeeklyPlan, "id">[] {
  const src = normalizeWeekAnchorIso(sourceWeekStart);
  const tgt = normalizeWeekAnchorIso(targetWeekStart);
  if (src === tgt) return [];

  const srcDays = weekDayIsosFromStart(src);
  const tgtDays = weekDayIsosFromStart(tgt);

  return sourcePlans
    .filter(
      (p) =>
        p.employeeId === employeeId &&
        p.status !== "cancelled" &&
        planDateInWeek(p.date, src)
    )
    .map((p) => {
      const idx = srcDays.indexOf(p.date.slice(0, 10));
      const date = idx >= 0 ? tgtDays[idx] : tgtDays[0];
      const weekStart = weekStartFromDateIso(date);
      return {
        employeeId,
        weekStart,
        date,
        startTime: p.startTime,
        endTime: p.endTime,
        activity: p.activity,
        brandName: p.brandName,
        notes: p.notes ? `${p.notes}`.trim() : "",
        status: "planned" as const,
        streamerAccountId: p.streamerAccountId,
        createdBy,
        createdAt: new Date().toISOString(),
      };
    });
}
