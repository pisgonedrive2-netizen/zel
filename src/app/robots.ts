import type { MetadataRoute } from "next";
import { getSiteBaseUrl, PRIVATE_ROUTE_PREFIXES } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteBaseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/login",
      disallow: [...PRIVATE_ROUTE_PREFIXES],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
