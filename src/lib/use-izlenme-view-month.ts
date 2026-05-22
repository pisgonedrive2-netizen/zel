"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { shiftCalendarMonthYm, toYearMonthLocal } from "@/lib/data";

const YM_RE = /^\d{4}-\d{2}$/;

/** Tüm `/izlenme/*` sayfalarında paylaşılan ay — `?month=YYYY-MM` ile senkron. */
export function useIzlenmeViewMonth() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const todayYm = toYearMonthLocal();

  const monthFromUrl = searchParams.get("month");
  const urlMonth = monthFromUrl && YM_RE.test(monthFromUrl) ? monthFromUrl : todayYm;

  const [viewMonth, setViewMonthState] = useState(urlMonth);

  useEffect(() => {
    if (urlMonth !== viewMonth) setViewMonthState(urlMonth);
  }, [urlMonth, viewMonth]);

  const setViewMonth = useCallback(
    (next: string) => {
      setViewMonthState(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("month", next);
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const shiftMonth = useCallback(
    (delta: number) => setViewMonth(shiftCalendarMonthYm(viewMonth, delta)),
    [viewMonth, setViewMonth]
  );

  return { viewMonth, setViewMonth, shiftMonth, todayYm };
}

/** Navbar linklerine ay parametresi ekle. */
export function izlenmeHref(path: string, viewMonth: string) {
  const base = path.split("?")[0];
  return `${base}?month=${viewMonth}`;
}
