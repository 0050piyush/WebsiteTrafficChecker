import type { Metadata } from "next";
import Link from "next/link";
import { Map as MapIcon } from "lucide-react";
import { PAGE_GROUPS } from "@/lib/pages";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sitemap",
  description: "Every page on TrafficLens: tools, guides, company and legal pages.",
};

export default function SitemapPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={<MapIcon className="h-7 w-7 text-accent-ink" aria-hidden />} title="Sitemap" description="Every page on TrafficLens in one place." />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {PAGE_GROUPS.map((group) => (
          <section key={group.title} className="card p-5" aria-labelledby={`sm-${group.title}`}>
            <h2 id={`sm-${group.title}`} className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              {group.title}
            </h2>
            <ul className="mt-3 space-y-3">
              {group.pages.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="font-medium text-accent-ink hover:underline">
                    {p.label}
                  </Link>
                  <p className="text-sm text-ink-2">{p.description}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm text-ink-3">
        For search engines:{" "}
        <a href="/sitemap.xml" className="text-accent-ink hover:underline">
          sitemap.xml
        </a>
      </p>
    </div>
  );
}
