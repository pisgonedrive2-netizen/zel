import type { Brand, ContentExpense } from "@/store/store";
import { expenseReviewStatus } from "@/lib/content-expense";

function isCountableContentExpense(e: ContentExpense): boolean {
  const st = expenseReviewStatus(e);
  return st !== "cancelled" && st !== "rejected";
}

/** Harcamaya bağlı marka id listesi (yeni kayıt veya geriye dönük çözümleme). */
export function resolveExpenseBrandIds(expense: ContentExpense, brands: Brand[]): string[] {
  if (expense.brandIds?.length) {
    return [...new Set(expense.brandIds.filter(Boolean))];
  }
  if (expense.brandId) return [expense.brandId];

  const raw = expense.brandName.trim();
  if (!raw) return [];

  const parts = raw
    .split(/[,;/|+&]|\s+\/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const matchPart = (part: string): string | null => {
    const n = part.toLowerCase();
    const hit =
      brands.find((b) => b.shortName.trim().toLowerCase() === n) ??
      brands.find((b) => b.name.trim().toLowerCase() === n) ??
      brands.find((b) => b.shortName.trim().toLowerCase().startsWith(n)) ??
      brands.find((b) => n.includes(b.shortName.trim().toLowerCase()));
    return hit?.id ?? null;
  };

  if (parts.length <= 1) {
    const id = matchPart(raw);
    return id ? [id] : [];
  }

  const ids = parts.map(matchPart).filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

export function expenseMatchesBrand(
  expense: ContentExpense,
  brand: Brand,
  brands: Brand[]
): boolean {
  const ids = resolveExpenseBrandIds(expense, brands);
  if (ids.length > 0) return ids.includes(brand.id);

  if (expense.brandId && expense.brandId === brand.id) return true;
  if (!expense.brandId && expense.brandName) {
    const n = expense.brandName.trim().toLowerCase();
    return (
      n === brand.shortName.trim().toLowerCase() ||
      n === brand.name.trim().toLowerCase()
    );
  }
  return false;
}

/** Markaya düşen USD payı (ortak harcamada eşit bölünür). */
export function brandExpenseShareUsd(
  expense: ContentExpense,
  brandId: string,
  brands: Brand[]
): number {
  if (!isCountableContentExpense(expense)) return 0;
  const ids = resolveExpenseBrandIds(expense, brands);
  if (ids.length === 0) {
    const b = brands.find((x) => x.id === brandId);
    return b && expenseMatchesBrand(expense, b, brands) ? expense.amountUsd : 0;
  }
  if (!ids.includes(brandId)) return 0;
  return expense.amountUsd / ids.length;
}

export function formatExpenseBrandLabel(
  expense: Pick<ContentExpense, "brandName" | "brandIds">,
  brands: Brand[]
): string {
  if (expense.brandIds?.length) {
    const names = expense.brandIds
      .map((id) => brands.find((b) => b.id === id)?.shortName)
      .filter(Boolean);
    if (names.length) return names.join(" · ");
  }
  return expense.brandName;
}

export function buildExpenseBrandFields(
  selectedBrandIds: string[],
  brands: Brand[]
): Pick<ContentExpense, "brandId" | "brandIds" | "brandName"> {
  const unique = [...new Set(selectedBrandIds.filter(Boolean))];
  if (unique.length === 0) {
    return { brandId: undefined, brandIds: undefined, brandName: "" };
  }
  const names = unique
    .map((id) => brands.find((b) => b.id === id)?.shortName)
    .filter(Boolean) as string[];
  return {
    brandId: unique[0],
    brandIds: unique.length > 1 ? unique : undefined,
    brandName: names.join(" · "),
  };
}

export function expenseReviewLabel(e: ContentExpense): string {
  const s = expenseReviewStatus(e);
  if (s === "pending") return "İncelemede";
  if (s === "needs_info") return "Bilgi istendi";
  if (s === "rejected") return "Reddedildi";
  if (s === "cancelled") return "Geri çekildi";
  return "Onaylı";
}
