"use client";

import { useMemo } from "react";
import { useAuth } from "@/store/auth";
import { usePanelView, resolveBrandViewId } from "@/store/panel-view";
import { useStore } from "@/store/store";
import { useMarkaViewMonth } from "@/lib/use-marka-view-month";

export const monthLabelTr = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

export function useMarkaPortal() {
  const { user } = useAuth();
  const brandViewAs = usePanelView((s) => s.brandViewAs);
  const activeBrandId = usePanelView((s) => s.activeBrandId);
  const { brands } = useStore();
  const { viewMonth: month, setViewMonth: setMonth, shiftMonth, todayYm } =
    useMarkaViewMonth();

  const isBrandUser = user?.role === "brand";
  const isAdminView = user?.role === "admin" && !!brandViewAs;

  // Çok markalı marka kullanıcısı: erişilebilir markalar (bootstrap zaten scope'ladı).
  // Aktif marka = panel-view seçimi (geçerliyse) → user.brandId → ilk marka.
  let brandId = resolveBrandViewId(user?.role, user?.brandId, brandViewAs);
  if (isBrandUser) {
    const accessible = brands;
    const picked =
      (activeBrandId && accessible.some((b) => b.id === activeBrandId) && activeBrandId) ||
      (user?.brandId && accessible.some((b) => b.id === user.brandId) && user.brandId) ||
      accessible[0]?.id ||
      user?.brandId ||
      "";
    brandId = picked;
  }

  const brand = brands.find((b) => b.id === brandId);
  const canViewBrand = isBrandUser || isAdminView;
  /** Marka kullanıcısının erişebildiği tüm markalar (switcher için). */
  const accessibleBrands = isBrandUser ? brands : [];

  const navMonth = (dir: 1 | -1) => shiftMonth(dir);

  return useMemo(
    () => ({
      user,
      brandId,
      brand,
      accessibleBrands,
      month,
      setMonth,
      navMonth,
      canViewBrand,
      isAdminView,
      isBrandUser,
      todayYm,
      monthTitle: monthLabelTr(month),
    }),
    [user, brandId, brand, accessibleBrands, month, setMonth, canViewBrand, isAdminView, isBrandUser, todayYm]
  );
}
