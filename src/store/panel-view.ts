"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface PanelViewAs {
  employeeId: string;
  employeeName: string;
}

export interface BrandViewAs {
  brandId: string;
  brandName: string;
}

interface PanelViewState {
  panelViewAs: PanelViewAs | null;
  brandViewAs: BrandViewAs | null;
  /** Çok markalı bir marka kullanıcısının aktif markası (kendi oturumu için). */
  activeBrandId: string | null;
  enterStreamerPanel: (employeeId: string, employeeName: string) => void;
  exitStreamerPanel: () => void;
  enterBrandPanel: (brandId: string, brandName: string) => void;
  exitBrandPanel: () => void;
  setActiveBrand: (brandId: string | null) => void;
}

export const usePanelView = create<PanelViewState>()(
  persist(
    (set) => ({
      panelViewAs: null,
      brandViewAs: null,
      activeBrandId: null,
      enterStreamerPanel: (employeeId, employeeName) =>
        set({
          panelViewAs: { employeeId, employeeName },
          brandViewAs: null,
        }),
      exitStreamerPanel: () => set({ panelViewAs: null }),
      enterBrandPanel: (brandId, brandName) =>
        set({
          brandViewAs: { brandId, brandName },
          panelViewAs: null,
        }),
      exitBrandPanel: () => set({ brandViewAs: null }),
      setActiveBrand: (brandId) => set({ activeBrandId: brandId }),
    }),
    {
      name: "foxstream-panel-view-v1",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

type AnyRole = "admin" | "streamer" | "auditor" | "brand" | null | undefined;

/** Admin yayıncı/marka panelini görüntülerken geçerli rol. */
export function effectiveRole(
  userRole: AnyRole,
  panelViewAs: PanelViewAs | null,
  brandViewAs?: BrandViewAs | null
): "admin" | "streamer" | "auditor" | "brand" | null {
  if (userRole === "admin" && panelViewAs) return "streamer";
  if (userRole === "admin" && brandViewAs) return "brand";
  return userRole ?? null;
}

/**
 * Marka sayfalarının kullanacağı brand id —
 * admin marka panelindeyse impersone edilen brand, değilse kullanıcının kendi
 * marka bağı (brand rolüyse).
 */
export function resolveBrandViewId(
  userRole: AnyRole,
  userBrandId: string | undefined,
  brandViewAs: BrandViewAs | null
): string {
  if (userRole === "admin" && brandViewAs) return brandViewAs.brandId;
  if (userRole === "brand") return userBrandId ?? "";
  return "";
}
