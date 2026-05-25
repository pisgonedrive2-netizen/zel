"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { shiftCalendarMonthYm, toYearMonthLocal } from "@/lib/data";
import { filterLinksForViewMonth } from "@/lib/brand-month-metrics";
import type { IzlenmeApiDateMode, IzlenmeLinkScope } from "@/lib/izlenme-refresh";
import type { BrandLink, LinkSnapshot } from "@/store/store";

const YM_RE = /^\d{4}-\d{2}$/;

function parseLinkScope(raw: string | null): IzlenmeLinkScope {
  return raw === "all" ? "all" : "month";
}

function parseApiDateMode(raw: string | null): IzlenmeApiDateMode {
  return raw === "today" ? "today" : "view-month";
}

/** Tüm `/izlenme/*` sayfalarında paylaşılan ay + link/API filtreleri. */
export function useIzlenmeViewMonth() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const todayYm = toYearMonthLocal();

  const monthFromUrl = searchParams.get("month");
  const urlMonth = monthFromUrl && YM_RE.test(monthFromUrl) ? monthFromUrl : todayYm;
  const urlLinkScope = parseLinkScope(searchParams.get("links"));
  const urlApiDateMode = parseApiDateMode(searchParams.get("apiDate"));

  const [viewMonth, setViewMonthState] = useState(urlMonth);
  const [linkScope, setLinkScopeState] = useState<IzlenmeLinkScope>(urlLinkScope);
  const [apiDateMode, setApiDateModeState] = useState<IzlenmeApiDateMode>(urlApiDateMode);

  useEffect(() => {
    if (urlMonth !== viewMonth) setViewMonthState(urlMonth);
  }, [urlMonth, viewMonth]);

  useEffect(() => {
    if (urlLinkScope !== linkScope) setLinkScopeState(urlLinkScope);
  }, [urlLinkScope, linkScope]);

  useEffect(() => {
    if (urlApiDateMode !== apiDateMode) setApiDateModeState(urlApiDateMode);
  }, [urlApiDateMode, apiDateMode]);

  const replaceQuery = useCallback(
    (patch: { month?: string; links?: IzlenmeLinkScope; apiDate?: IzlenmeApiDateMode }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (patch.month != null) params.set("month", patch.month);
      if (patch.links != null) {
        if (patch.links === "month") params.delete("links");
        else params.set("links", patch.links);
      }
      if (patch.apiDate != null) {
        if (patch.apiDate === "view-month") params.delete("apiDate");
        else params.set("apiDate", patch.apiDate);
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setViewMonth = useCallback(
    (next: string) => {
      setViewMonthState(next);
      replaceQuery({ month: next });
    },
    [replaceQuery]
  );

  const setLinkScope = useCallback(
    (next: IzlenmeLinkScope) => {
      setLinkScopeState(next);
      replaceQuery({ links: next });
    },
    [replaceQuery]
  );

  const setApiDateMode = useCallback(
    (next: IzlenmeApiDateMode) => {
      setApiDateModeState(next);
      replaceQuery({ apiDate: next });
    },
    [replaceQuery]
  );

  const shiftMonth = useCallback(
    (delta: number) => setViewMonth(shiftCalendarMonthYm(viewMonth, delta)),
    [viewMonth, setViewMonth]
  );

  const filterLinks = useCallback(
    (links: BrandLink[], snapshots: LinkSnapshot[]) =>
      filterLinksForViewMonth(links, viewMonth, snapshots, todayYm, linkScope === "all"),
    [viewMonth, todayYm, linkScope]
  );

  return {
    viewMonth,
    setViewMonth,
    shiftMonth,
    todayYm,
    linkScope,
    setLinkScope,
    apiDateMode,
    setApiDateMode,
    filterLinks,
  };
}

/** Navbar linklerine ay + filtre parametreleri. */
export function izlenmeHref(
  path: string,
  viewMonth: string,
  opts?: { linkScope?: IzlenmeLinkScope; apiDateMode?: IzlenmeApiDateMode }
) {
  const base = path.split("?")[0];
  const params = new URLSearchParams();
  params.set("month", viewMonth);
  if (opts?.linkScope === "all") params.set("links", "all");
  if (opts?.apiDateMode === "today") params.set("apiDate", "today");
  return `${base}?${params.toString()}`;
}
