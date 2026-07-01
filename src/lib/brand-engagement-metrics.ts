import type { BrandLink, LinkSnapshot } from "@/store/store";
import { linkEngagementForMonth } from "@/lib/brand-month-metrics";

export interface LinkEngagementTotals {
  likes: number;
  comments: number;
  shares: number;
  /** Beğeni + yorum + paylaşım — etkileşim KPI */
  interactions: number;
  linksWithData: number;
}

export function fmtEngagement(n?: number | null): string {
  if (n == null || n <= 0) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(1) + "k";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("tr-TR");
}

/** Seçili ay için tüm linklerin engagement toplamı (snapshot veya canlı API alanları). */
export function totalLinkEngagementForMonth(
  links: BrandLink[],
  monthYm: string,
  allSnaps: LinkSnapshot[],
  todayYm: string
): LinkEngagementTotals {
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let linksWithData = 0;

  for (const link of links) {
    const e = linkEngagementForMonth(link, monthYm, allSnaps, todayYm);
    const has =
      (e.likes != null && e.likes > 0) ||
      (e.comments != null && e.comments > 0) ||
      (e.shares != null && e.shares > 0);
    if (!has) continue;
    linksWithData += 1;
    likes += e.likes ?? 0;
    comments += e.comments ?? 0;
    shares += e.shares ?? 0;
  }

  return {
    likes,
    comments,
    shares,
    interactions: likes + comments + shares,
    linksWithData,
  };
}
