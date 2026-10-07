import type { MetadataRoute } from "next";
import { hasPublicSiteUrl, siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = hasPublicSiteUrl() ? siteUrl() : null;
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/account", "/login"] }],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
