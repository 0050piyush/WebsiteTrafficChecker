import type { MetadataRoute } from "next";
import { PAGE_GROUPS } from "@/lib/pages";
import { getAllPosts } from "@/lib/blog/posts";
import { siteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages = PAGE_GROUPS.flatMap((g) => g.pages).filter((p) => p.index);
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    ...pages.map((p) => ({
      url: `${base}${p.href}`,
      changeFrequency: "monthly" as const,
      priority: priorityFor(p.href),
    })),
    ...getAllPosts().map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: new Date(p.updated ?? p.date),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}

function priorityFor(href: string): number {
  return ["/traffic", "/compare", "/audit", "/analyzer", "/keywords"].includes(href) ? 0.9 : href === "/pricing" || href === "/blog" ? 0.7 : 0.5;
}
