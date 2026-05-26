import type { BrandLink } from "@/store/store";

/** Karşılaştırma ve mükerrer kontrol için kanonik URL. */
export function normalizeBrandLinkUrl(url: string): string {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return "";

  try {
    const raw = /^https?:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(raw);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");

    const host = u.hostname;

    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id ? `youtube:video:${id}` : u.toString();
    }

    if (host.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `youtube:video:${v}`;
      const shorts = u.pathname.match(/^\/shorts\/([^/?#]+)/);
      if (shorts) return `youtube:video:${shorts[1]}`;
      const path = u.pathname.replace(/\/+$/, "") || "/";
      u.search = "";
      u.pathname = path;
      return u.toString();
    }

    if (host.includes("tiktok.com") || host === "vm.tiktok.com" || host === "vt.tiktok.com") {
      const m = u.pathname.match(/\/video\/(\d+)/);
      if (m) return `tiktok:video:${m[1]}`;
      u.search = "";
      u.pathname = u.pathname.replace(/\/+$/, "") || "/";
      return u.toString();
    }

    if (host.includes("instagram.com") || host === "instagr.am") {
      u.search = "";
      u.pathname = u.pathname.replace(/\/+$/, "") || "/";
      return u.toString();
    }

    u.search = "";
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString();
  } catch {
    return trimmed.toLowerCase();
  }
}

export function findDuplicateBrandLink(
  links: BrandLink[],
  url: string,
  excludeId?: string,
  scope?: { ownerId?: string; brandId?: string }
): BrandLink | undefined {
  const norm = normalizeBrandLinkUrl(url);
  if (!norm) return undefined;

  return links.find((l) => {
    if (excludeId && l.id === excludeId) return false;
    if (scope?.ownerId && l.ownerId !== scope.ownerId) return false;
    if (scope?.brandId && l.brandId !== scope.brandId) return false;
    const other = normalizeBrandLinkUrl(l.url);
    if (!other) return false;
    return other === norm;
  });
}

/** Görüntüleme / sıralama için tekrar anahtarı — marka + sahip + URL. */
export function brandLinkDisplayKey(link: BrandLink): string {
  const url = normalizeBrandLinkUrl(link.url);
  if (!url) return `id:${link.id}`;
  const owner = link.ownerId ?? "";
  return `${link.brandId}:${owner}:${url}`;
}

/**
 * Aynı marka + yayıncı + URL için tek kayıt (isteğe bağlı liste sıkıştırma).
 * Farklı markalardaki aynı profil URL'si korunur.
 */
export function dedupeBrandLinksByUrl(links: BrandLink[]): BrandLink[] {
  const byKey = new Map<string, BrandLink>();

  for (const link of links) {
    const key = brandLinkDisplayKey(link);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, link);
      continue;
    }
    const pv = prev.lastViews ?? -1;
    const cv = link.lastViews ?? -1;
    if (cv > pv) {
      byKey.set(key, link);
      continue;
    }
    if (cv === pv && (link.createdAt ?? "") > (prev.createdAt ?? "")) {
      byKey.set(key, link);
    }
  }

  return [...byKey.values()];
}
