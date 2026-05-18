import type { PlannedCategory } from "@/store/store";

export const PLANNED_CATEGORIES: { value: PlannedCategory; label: string }[] = [
  { value: "capex", label: "Yatırım (CapEx)" },
  { value: "opex", label: "Operasyon (OpEx)" },
  { value: "revenue", label: "Gelir hedefi" },
  { value: "growth", label: "Büyüme" },
  { value: "other", label: "Diğer" },
];

export function plannedCategoryLabel(c: PlannedCategory): string {
  return PLANNED_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}
