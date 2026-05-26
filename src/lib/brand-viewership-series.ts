import type { Brand, BrandLink, BrandViewership, LinkSnapshot } from "@/store/store";
import { shiftCalendarMonthYm, toYearMonthLocal } from "@/lib/data";
import { linkViewsForMonth, totalLinkViewsForMonth } from "@/lib/brand-month-metrics";

export interface BrandMonthViewRow {
  month: string;
  monthLabel: string;
  linkViews: number;
  streamerViews: number;
  totalViews: number;
}

export interface PlatformMonthSlice {
  platform: string;
  views: number;
}

/** Marka için snapshot / viewership içeren tüm ayları (YYYY-MM) toplar. */
export function collectBrandDataMonths(opts: {
  brandId: string;
  brandLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  brandViewership: BrandViewership[];
}): string[] {
  const linkIds = new Set(
    opts.brandLinks.filter((l) => l.brandId === opts.brandId).map((l) => l.id)
  );
  const months = new Set<string>();
  for (const s of opts.linkSnapshots) {
    if (linkIds.has(s.linkId) && s.date.length >= 7) {
      months.add(s.date.slice(0, 7));
    }
  }
  for (const v of opts.brandViewership) {
    if (v.brandId === opts.brandId && v.month) months.add(v.month);
  }
  return [...months].sort((a, b) => a.localeCompare(b));
}

/** Başlangıçtan seçili aya kadar aylık izlenme serisi (en fazla `maxMonths` ay). */
export function buildBrandViewershipSeries(opts: {
  brandId: string;
  brandLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  brandViewership: BrandViewership[];
  endMonthYm: string;
  todayYm: string;
  maxMonths?: number;
}): BrandMonthViewRow[] {
  const maxMonths = opts.maxMonths ?? 24;
  const links = opts.brandLinks.filter((l) => l.brandId === opts.brandId);
  const dataMonths = collectBrandDataMonths({
    brandId: opts.brandId,
    brandLinks: opts.brandLinks,
    linkSnapshots: opts.linkSnapshots,
    brandViewership: opts.brandViewership,
  });

  let startYm = dataMonths[0] ?? opts.endMonthYm;
  if (dataMonths.length > maxMonths) {
    startYm = dataMonths[dataMonths.length - maxMonths];
  }

  const out: BrandMonthViewRow[] = [];
  let cursor = startYm;
  while (cursor <= opts.endMonthYm) {
    const linkViews = totalLinkViewsForMonth(
      links,
      cursor,
      opts.linkSnapshots,
      opts.todayYm
    );
    const streamerViews = opts.brandViewership
      .filter((v) => v.brandId === opts.brandId && v.month === cursor)
      .reduce((s, v) => s + v.views, 0);
    const [y, m] = cursor.split("-").map(Number);
    const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("tr-TR", {
      month: "short",
      year: "2-digit",
    });
    out.push({
      month: cursor,
      monthLabel,
      linkViews,
      streamerViews,
      totalViews: linkViews + streamerViews,
    });
    cursor = shiftCalendarMonthYm(cursor, 1);
    if (out.length > maxMonths + 2) break;
  }
  return out;
}

/** Seçili ayda platform bazlı izlenme dağılımı. */
export function platformBreakdownForMonth(opts: {
  brandLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  monthYm: string;
  todayYm: string;
}): PlatformMonthSlice[] {
  const map = new Map<string, number>();
  for (const link of opts.brandLinks) {
    const { lastViews } = linkViewsForMonth(
      link,
      opts.monthYm,
      opts.linkSnapshots,
      opts.todayYm
    );
    if (lastViews <= 0) continue;
    const key = link.platform.trim() || "Diğer";
    map.set(key, (map.get(key) ?? 0) + lastViews);
  }
  return [...map.entries()]
    .map(([platform, views]) => ({ platform, views }))
    .sort((a, b) => b.views - a.views);
}

export function monthOverMonthChange(
  series: BrandMonthViewRow[],
  selectedMonth: string
): { prevMonth: string | null; current: number; previous: number; pct: number | null } {
  const idx = series.findIndex((r) => r.month === selectedMonth);
  if (idx < 0) {
    return { prevMonth: null, current: 0, previous: 0, pct: null };
  }
  const current = series[idx].totalViews;
  const previous = idx > 0 ? series[idx - 1].totalViews : 0;
  const prevMonth = idx > 0 ? series[idx - 1].month : null;
  const pct =
    previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : null;
  return { prevMonth, current, previous, pct };
}

/** İlk veri ayından bugüne kadar kısa etiket. */
export function brandDataSpanLabel(months: string[]): string {
  if (months.length === 0) return "Henüz veri yok";
  if (months.length === 1) {
    const [y, m] = months[0].split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  }
  const first = months[0];
  const last = months[months.length - 1];
  const fmt = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("tr-TR", { month: "short", year: "numeric" });
  };
  return `${fmt(first)} – ${fmt(last)}`;
}

export interface BrandRankRow {
  brandId: string;
  name: string;
  shortName: string;
  views: number;
  linkViews: number;
  streamerViews: number;
  monthlyTarget?: number;
  targetPct: number | null;
  sharePct: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
}

/** Seçili ayda tüm markaları izlenmeye göre sıralar (1 = en yüksek). */
export function rankBrandsForMonth(opts: {
  brands: Brand[];
  brandLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  brandViewership: BrandViewership[];
  monthYm: string;
  todayYm: string;
}): BrandRankRow[] {
  const rows = opts.brands
    .filter((b) => b.status === "active")
    .map((brand) => {
      const links = opts.brandLinks.filter((l) => l.brandId === brand.id);
      const linkViews = totalLinkViewsForMonth(
        links,
        opts.monthYm,
        opts.linkSnapshots,
        opts.todayYm
      );
      const streamerViews = opts.brandViewership
        .filter((v) => v.brandId === brand.id && v.month === opts.monthYm)
        .reduce((s, v) => s + v.views, 0);
      const views = linkViews + streamerViews;
      const targetPct =
        brand.monthlyTarget && brand.monthlyTarget > 0
          ? Math.min(100, (views / brand.monthlyTarget) * 100)
          : null;
      const likes    = links.reduce((s, l) => s + (l.lastLikes    ?? 0), 0);
      const comments = links.reduce((s, l) => s + (l.lastComments ?? 0), 0);
      const shares   = links.reduce((s, l) => s + (l.lastShares   ?? 0), 0);
      return {
        brandId: brand.id,
        name: brand.name,
        shortName: brand.shortName,
        views,
        linkViews,
        streamerViews,
        monthlyTarget: brand.monthlyTarget,
        targetPct,
        sharePct: 0,
        likes,
        comments,
        shares,
        engagement: likes + comments + shares,
      };
    })
    .sort((a, b) => b.views - a.views);

  const total = rows.reduce((s, r) => s + r.views, 0) || 1;
  return rows.map((r) => ({ ...r, sharePct: (r.views / total) * 100 }));
}

export const BRAND_CHART_COLORS: Record<string, string> = {
  "br-gala": "#10b981",
  "br-boffice": "#8b5cf6",
  "br-pipo": "#14b8a6",
  "br-hit": "#f59e0b",
  "br-padi": "#3b82f6",
};

export function brandChartColor(brandId: string, index: number): string {
  return (
    BRAND_CHART_COLORS[brandId] ??
    ["#6366f1", "#14b8a6", "#eab308", "#ec4899", "#06b6d4"][index % 5]
  );
}

export interface MultiBrandTrendPoint {
  month: string;
  monthLabel: string;
  [brandKey: string]: number | string;
}

/**
 * Günlük çoklu çizgi grafik verisi — son N günlük link_snapshots toplamı + brand_viewership
 *
 * "Son 1 ay" için günlük resolution gerekli; aksi halde tek noktayla çizgi çizilemez.
 * Her marka için her gün: o güne (veya öncesine en yakın) snapshot toplamı yazılır.
 *
 * Snapshot'lar seyrek olduğunda "forward fill" yapılır — yani o güne ait kayıt yoksa
 * en son bilinen değer kullanılır. Bu, eski snapshot'ı 0'a düşürmemek için kritik.
 */
export function buildMultiBrandTrendDaily(opts: {
  brands: Brand[];
  brandLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  brandViewership: BrandViewership[];
  endDate: Date;
  /** Kaç gün geriye (varsayılan 30). */
  days?: number;
}): MultiBrandTrendPoint[] {
  const active = opts.brands.filter((b) => b.status === "active");
  const days = opts.days ?? 30;

  const dayLabels: Array<{ iso: string; label: string; ym: string }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(opts.endDate);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
    const ym = iso.slice(0, 7);
    dayLabels.push({ iso, label, ym });
  }

  return dayLabels.map(({ iso, label, ym }) => {
    const point: MultiBrandTrendPoint = { month: iso, monthLabel: label };
    for (const brand of active) {
      const links = opts.brandLinks.filter((l) => l.brandId === brand.id);
      let total = 0;
      // Her linkin o tarih veya öncesi en yakın snapshot'ını topla (forward fill)
      for (const link of links) {
        const candidates = opts.linkSnapshots
          .filter((s) => s.linkId === link.id && s.date <= iso)
          .sort((a, b) => b.date.localeCompare(a.date));
        if (candidates.length > 0) {
          total += candidates[0].views ?? 0;
        }
      }
      // brand_viewership o aya ait, sadece son güne ekle ki çizgi sıçramasın —
      // alternatif: aya yayma. Şimdilik aya yay (her güne pay).
      const monthlyViewership = opts.brandViewership
        .filter((v) => v.brandId === brand.id && v.month === ym)
        .reduce((s, v) => s + v.views, 0);
      // Aylık değeri 30'a böl + biriktirici toplam değil; çoğu kullanım için
      // sadece link snapshot'lar yeterli. Aylık veriyi sadece günlük link verisi
      // hiç yoksa fallback olarak ay ortalaması ekle.
      if (total === 0 && monthlyViewership > 0) {
        total = Math.round(monthlyViewership / 30);
      }
      point[brand.id] = total;
    }
    return point;
  });
}

/** Tüm markalar için çoklu çizgi grafik verisi. */
export function buildMultiBrandTrend(opts: {
  brands: Brand[];
  brandLinks: BrandLink[];
  linkSnapshots: LinkSnapshot[];
  brandViewership: BrandViewership[];
  endMonthYm: string;
  todayYm: string;
  maxMonths?: number;
}): MultiBrandTrendPoint[] {
  const active = opts.brands.filter((b) => b.status === "active");
  const maxMonths = opts.maxMonths ?? 8;

  // Collect months from actual data
  const allMonths = new Set<string>();
  for (const b of active) {
    for (const m of collectBrandDataMonths({
      brandId: b.id,
      brandLinks: opts.brandLinks,
      linkSnapshots: opts.linkSnapshots,
      brandViewership: opts.brandViewership,
    })) {
      allMonths.add(m);
    }
  }

  // Always fill backwards from endMonthYm to guarantee maxMonths range
  let cursor = opts.endMonthYm;
  for (let i = 0; i < maxMonths; i++) {
    allMonths.add(cursor);
    cursor = shiftCalendarMonthYm(cursor, -1);
  }

  const sorted = [...allMonths].sort((a, b) => a.localeCompare(b));
  const filtered = sorted.filter((m) => m <= opts.endMonthYm);
  const months = filtered.length > maxMonths
    ? filtered.slice(filtered.length - maxMonths)
    : filtered;

  if (months.length === 0) months.push(opts.endMonthYm);

  return months.map((month) => {
    const [y, mo] = month.split("-").map(Number);
    const monthLabel = new Date(y, mo - 1, 1).toLocaleDateString("tr-TR", {
      month: "short",
      year: "2-digit",
    });
    const point: MultiBrandTrendPoint = { month, monthLabel };
    for (const brand of active) {
      const links = opts.brandLinks.filter((l) => l.brandId === brand.id);
      const linkViews = totalLinkViewsForMonth(
        links,
        month,
        opts.linkSnapshots,
        opts.todayYm
      );
      const streamerViews = opts.brandViewership
        .filter((v) => v.brandId === brand.id && v.month === month)
        .reduce((s, v) => s + v.views, 0);
      point[brand.id] = linkViews + streamerViews;
    }
    return point;
  });
}

export { toYearMonthLocal };
