/** Üretim / önizleme taban URL — sitemap & robots için. */
export function getSiteBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    return process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim()}`;
  }
  return "https://foxstreaming.vercel.app";
}

/** Sitemap ve robots'ta asla listelenmemesi gereken iç rotalar. */
export const PRIVATE_ROUTE_PREFIXES = [
  "/prim",
  "/ozet",
  "/kasa",
  "/maaslar",
  "/gorevler",
  "/kullanicilar",
  "/yayinci",
  "/marka",
  "/denetci",
  "/api",
] as const;
