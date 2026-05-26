import { shiftCalendarMonthYm } from "@/lib/data";
import { totalLinkViewsForMonth } from "@/lib/brand-month-metrics";
import type { BrandLink, BrandViewership, LinkSnapshot } from "@/store/store";

export type GlobalTrendPoint = {
  key: string;
  label: string;
  views: number;
};

const monthShortYm = (ym: string) =>
  new Date(ym + "-01").toLocaleDateString("tr-TR", {
    month: "short",
    year: "2-digit",
  });

/** Seçili aydan geriye N ay — link + yayıncı izlenmesi. */
export function buildGlobalMonthlyTrend(opts: {
  anchorYm: string;
  monthCount: number;
  scopedLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  brandViewership: BrandViewership[];
  todayYm: string;
}): GlobalTrendPoint[] {
  const arr: GlobalTrendPoint[] = [];
  for (let i = -(opts.monthCount - 1); i <= 0; i++) {
    const ym = shiftCalendarMonthYm(opts.anchorYm, i);
    const linkViews = totalLinkViewsForMonth(
      opts.scopedLinks,
      ym,
      opts.linkSnapshots,
      opts.todayYm
    );
    const streamerViews = opts.brandViewership
      .filter((v) => v.month === ym)
      .reduce((s, v) => s + v.views, 0);
    arr.push({
      key: ym,
      label: monthShortYm(ym),
      views: linkViews + streamerViews,
    });
  }
  return arr;
}

/** Seçili ay içinde günlük snapshot toplamı (link bazlı gün sonu değeri). */
export function buildGlobalDailyTrendForMonth(opts: {
  monthYm: string;
  scopedLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  todayYm: string;
}): GlobalTrendPoint[] {
  const [y, m] = opts.monthYm.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = new Date();
  const isCurrentMonth = opts.monthYm === opts.todayYm;
  const linkIds = new Set(opts.scopedLinks.map((l) => l.id));

  const out: GlobalTrendPoint[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${opts.monthYm}-${String(d).padStart(2, "0")}`;
    if (isCurrentMonth) {
      const dt = new Date(`${dateStr}T12:00:00`);
      if (dt > today) break;
    }

    const perLink = new Map<string, number>();
    for (const s of opts.linkSnapshots) {
      if (!linkIds.has(s.linkId) || s.date !== dateStr) continue;
      const prev = perLink.get(s.linkId) ?? 0;
      perLink.set(s.linkId, Math.max(prev, s.views));
    }
    let views = 0;
    for (const v of perLink.values()) views += v;

    out.push({
      key: dateStr,
      label: String(d),
      views,
    });
  }
  return out;
}
