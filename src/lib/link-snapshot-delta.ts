import type { BrandLink, LinkSnapshot } from "@/store/store";

/** URL'den okunabilir site adı (kick.com, twitter.com vb.). */
export function linkSiteLabel(url: string): string {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return "";
  try {
    const raw = /^https?:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    const map: Record<string, string> = {
      "kick.com": "Kick",
      "twitter.com": "Twitter / X",
      "x.com": "Twitter / X",
      "twitch.tv": "Twitch",
      "t.me": "Telegram",
      "telegram.me": "Telegram",
      "discord.com": "Discord",
      "discord.gg": "Discord",
      "youtube.com": "YouTube",
      "youtu.be": "YouTube",
      "instagram.com": "Instagram",
      "tiktok.com": "TikTok",
    };
    for (const [key, label] of Object.entries(map)) {
      if (host === key || host.endsWith(`.${key}`)) return label;
    }
    return host;
  } catch {
    return trimmed;
  }
}

/** Link satırında gösterilecek başlık: handle, not veya site. */
export function linkDisplayTitle(link: BrandLink): string {
  if (link.handle?.trim()) return link.handle.trim();
  if (link.notes?.trim()) return link.notes.trim().slice(0, 80);
  const site = linkSiteLabel(link.url);
  if (site) return site;
  return link.platform;
}

function snapsForLink(linkId: string, allSnaps: LinkSnapshot[]): LinkSnapshot[] {
  return allSnaps
    .filter((s) => s.linkId === linkId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.views - a.views);
}

/** Bir önceki snapshot (herhangi bir tarih). */
export function previousLinkSnapshot(
  linkId: string,
  beforeDate: string,
  allSnaps: LinkSnapshot[],
  excludeSnapshotId?: string
): LinkSnapshot | null {
  const before = beforeDate.slice(0, 10);
  const list = snapsForLink(linkId, allSnaps).filter(
    (s) => s.date.slice(0, 10) < before && s.id !== excludeSnapshotId
  );
  return list[0] ?? null;
}

/** Yeni girilen değer − önceki snapshot (negatif olmaz). */
export function snapshotViewsDelta(
  newViews: number,
  previousViews: number | null | undefined
): number {
  if (previousViews == null || previousViews <= 0) return Math.max(0, newViews);
  return Math.max(0, newViews - previousViews);
}

/** Seçili ay içindeki izlenme artışı (ay başı / önceki ay sonu → ay sonu). */
export function linkViewsGainInMonth(
  link: BrandLink,
  monthYm: string,
  allSnaps: LinkSnapshot[],
  todayYm: string
): { gain: number; baseline: number; latest: number; hasData: boolean } {
  const inMonth = allSnaps
    .filter((s) => s.linkId === link.id && s.date.startsWith(monthYm))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (inMonth.length > 0) {
    const latest = inMonth[0].views;
    const prior = allSnaps
      .filter((s) => s.linkId === link.id && s.date.slice(0, 7) < monthYm)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const start =
      prior != null
        ? prior.views
        : inMonth.length > 1
          ? inMonth[inMonth.length - 1].views
          : 0;
    return {
      gain: Math.max(0, latest - start),
      baseline: start,
      latest,
      hasData: true,
    };
  }
  if (monthYm === todayYm && (link.lastViews ?? 0) > 0) {
    const prior = allSnaps
      .filter((s) => s.linkId === link.id && s.date.slice(0, 7) < monthYm)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const latest = link.lastViews ?? 0;
    const start = prior?.views ?? 0;
    return {
      gain: Math.max(0, latest - start),
      baseline: start,
      latest,
      hasData: true,
    };
  }
  return { gain: 0, baseline: 0, latest: 0, hasData: false };
}

export function totalLinkViewsGainInMonth(
  links: BrandLink[],
  monthYm: string,
  allSnaps: LinkSnapshot[],
  todayYm: string
): number {
  return links.reduce(
    (sum, link) => sum + linkViewsGainInMonth(link, monthYm, allSnaps, todayYm).gain,
    0
  );
}
