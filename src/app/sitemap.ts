import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "@/lib/site-url";

/** Yalnızca herkese açık giriş sayfası — iç panel rotaları (prim dahil) listelenmez. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteBaseUrl();
  const now = new Date();
  return [
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
