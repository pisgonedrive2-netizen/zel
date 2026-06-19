import { isSupabaseClientMode } from "@/lib/supabase-client";
import { purgeViewershipCacheForBrands } from "@/lib/viewership-cache";
import { useStore, type Brand } from "@/store/store";

async function readApiError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/** Yerel store + viewership önbelleğinden markayı ve bağlı izlenme verisini temizler. */
export function purgeBrandFromLocalState(brandId: string): void {
  useStore.getState().deleteBrand(brandId);
  purgeViewershipCacheForBrands([brandId]);
}

/** Admin: markayı kalıcı siler (DB + yerel state). */
export async function deleteBrandAsAdmin(
  brandId: string,
  brandName?: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const label = brandName?.trim() || brandId;
  if (isSupabaseClientMode()) {
    try {
      const res = await fetch(`/api/admin/brands/${encodeURIComponent(brandId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        return { ok: false, reason: await readApiError(res) };
      }
    } catch {
      return { ok: false, reason: "Ağ hatası — marka sunucudan silinemedi." };
    }
  }
  purgeBrandFromLocalState(brandId);
  return { ok: true };
}

/** Admin: markayı pasifleştirir (listelerde varsayılan filtrede gizlenir). */
export async function archiveBrandAsAdmin(
  brandId: string,
  patch: Partial<Pick<Brand, "status" | "notes">> = { status: "inactive" }
): Promise<{ ok: true; brand?: Brand } | { ok: false; reason: string }> {
  const { updateBrand } = useStore.getState();
  if (isSupabaseClientMode()) {
    try {
      const res = await fetch(`/api/admin/brands/${encodeURIComponent(brandId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        return { ok: false, reason: await readApiError(res) };
      }
      const j = (await res.json()) as { brand?: Brand };
      if (j.brand) {
        updateBrand(brandId, j.brand);
      } else {
        updateBrand(brandId, patch);
      }
      return { ok: true, brand: j.brand };
    } catch {
      return { ok: false, reason: "Ağ hatası — marka güncellenemedi." };
    }
  }
  updateBrand(brandId, patch);
  return { ok: true };
}
