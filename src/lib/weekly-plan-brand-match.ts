import type { Brand, WeeklyPlan } from "@/store/store";

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Yayıncı planındaki marka etiketi bu markaya ait mi? (Padi / Padişahbet vb.) */
export function weeklyPlanMatchesBrand(
  plan: Pick<WeeklyPlan, "brandName">,
  brand: Pick<Brand, "name" | "shortName">
): boolean {
  const tag = norm(plan.brandName ?? "");
  if (!tag) return false;
  const short = norm(brand.shortName);
  const full = norm(brand.name);
  if (tag === short || tag === full) return true;
  if (short && (tag.includes(short) || short.includes(tag))) return true;
  if (full && (tag.includes(full) || full.includes(tag))) return true;
  return false;
}

export function filterWeeklyPlansForBrand(
  plans: WeeklyPlan[],
  brand: Pick<Brand, "name" | "shortName">,
  opts?: { includeCancelled?: boolean }
): WeeklyPlan[] {
  return plans.filter((p) => {
    if (!opts?.includeCancelled && p.status === "cancelled") return false;
    return weeklyPlanMatchesBrand(p, brand);
  });
}
