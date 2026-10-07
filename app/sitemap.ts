import type { MetadataRoute } from "next";
import { PAGE_GROUPS } from "@/lib/pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const pages = PAGE_GROUPS.flatMap((g) => g.pages).filter((p) => p.index);
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    ...pages.map((p) => ({
      url: `${base}${p.href}`,
      changeFrequency: "monthly" as const,
      priority: priorityFor(p.href),
    })),
  ];
}

function priorityFor(href: string): number {
  return ["/traffic", "/compare", "/audit", "/analyzer", "/keywords"].includes(href) ? 0.9 : href === "/pricing" ? 0.7 : 0.5;
}
