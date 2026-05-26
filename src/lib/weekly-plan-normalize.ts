import { weekStartFromDateIso } from "@/lib/data";
import type { Employee, StreamerAccount, WeeklyPlan } from "@/store/store";

/** Geçerli employees listesinde yayıncı id doğrula. */
export function resolveWeeklyPlanEmployeeId(
  employeeId: string | undefined,
  employees: Employee[],
  fallbackId?: string
): string | null {
  const candidates = [employeeId, fallbackId].filter(Boolean) as string[];
  for (const id of candidates) {
    if (employees.some((e) => e.id === id)) return id;
  }
  const streamer = employees.find(
    (e) => e.status === "active" && (e.kind === "streamer" || e.kind === "moderator")
  );
  return streamer?.id ?? null;
}

export function normalizeWeeklyPlanInput(
  input: Omit<WeeklyPlan, "id">,
  opts: {
    employees: Employee[];
    fallbackEmployeeId?: string;
    streamerAccounts?: StreamerAccount[];
  }
): Omit<WeeklyPlan, "id"> | null {
  const employeeId = resolveWeeklyPlanEmployeeId(
    input.employeeId,
    opts.employees,
    opts.fallbackEmployeeId
  );
  if (!employeeId) return null;

  const date = (input.date?.trim() || input.weekStart?.trim() || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const weekStart = weekStartFromDateIso(date) || input.weekStart?.slice(0, 10) || date;

  let streamerAccountId = input.streamerAccountId?.trim() || undefined;
  if (streamerAccountId && opts.streamerAccounts) {
    const acc = opts.streamerAccounts.find(
      (a) => a.id === streamerAccountId && a.employeeId === employeeId
    );
    if (!acc) streamerAccountId = undefined;
  }

  return {
    ...input,
    employeeId,
    date,
    weekStart,
    streamerAccountId,
    startTime: input.startTime?.trim() || undefined,
    endTime: input.endTime?.trim() || undefined,
  };
}
