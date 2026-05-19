"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/store/auth";
import { usePanelView, resolveBrandViewId } from "@/store/panel-view";
import { useStore } from "@/store/store";
import { toYearMonthLocal } from "@/lib/data";

export const monthLabelTr = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

export function useMarkaPortal() {
  const { user } = useAuth();
  const brandViewAs = usePanelView((s) => s.brandViewAs);
  const { brands } = useStore();
  const todayYm = toYearMonthLocal(new Date());
  const [month, setMonth] = useState(todayYm);

  const brandId = resolveBrandViewId(user?.role, user?.brandId, brandViewAs);
  const brand = brands.find((b) => b.id === brandId);
  const isAdminView = user?.role === "admin" && !!brandViewAs;
  const isBrandUser = user?.role === "brand";
  const canViewBrand = isBrandUser || isAdminView;

  const navMonth = (dir: 1 | -1) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(toYearMonthLocal(d));
  };

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
      monthTitle: monthLabelTr(month),
    }),
    [user, brandId, brand, month, canViewBrand, isAdminView, isBrandUser]
  );
}
