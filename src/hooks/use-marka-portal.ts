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
  const { brands } = useStore();
  const { viewMonth: month, setViewMonth: setMonth, shiftMonth, todayYm } =
    useMarkaViewMonth();

  const brandId = resolveBrandViewId(user?.role, user?.brandId, brandViewAs);
  const brand = brands.find((b) => b.id === brandId);
  const isAdminView = user?.role === "admin" && !!brandViewAs;
  const isBrandUser = user?.role === "brand";
  const canViewBrand = isBrandUser || isAdminView;

  const navMonth = (dir: 1 | -1) => shiftMonth(dir);

  return useMemo(
    () => ({
      user,
      brandId,
      brand,
      month,
      setMonth,
      navMonth,
      canViewBrand,
      isAdminView,
      isBrandUser,
      todayYm,
      monthTitle: monthLabelTr(month),
    }),
    [user, brandId, brand, month, setMonth, canViewBrand, isAdminView, isBrandUser, todayYm]
  );
}
