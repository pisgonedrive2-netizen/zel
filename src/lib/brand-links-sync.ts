import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { brandFromRow } from "@/lib/db/mappers";
import type { Brand, BrandLink } from "@/store/store";

/** Payload + DB'deki geçerli marka id'leri. */
export async function loadValidBrandIds(
  brandsFromPayload: Brand[] = []
): Promise<Set<string>> {
  const ids = new Set(brandsFromPayload.map((b) => b.id));
  const { data, error } = await getSupabaseAdmin().from("brands").select("id");
  if (error) throw new Error(`brands select: ${error.message}`);
  for (const row of data ?? []) {
    ids.add(String((row as { id: string }).id));
  }
  return ids;
}

export function filterBrandLinksWithValidBrands(
  links: BrandLink[],
  validBrandIds: Set<string>
): BrandLink[] {
  return links.filter((l) => l.brandId && validBrandIds.has(l.brandId));
}
