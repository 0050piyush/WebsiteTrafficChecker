import Link from "next/link";
import { ArrowRight, BarChart3, Braces, Check, FileSearch, GitCompare, Link2, Minus, Sparkles, Stethoscope, Gauge, Eye, Zap, Lock, Download, Code2 } from "lucide-react";
import { HeroSearch } from "@/components/HeroSearch";
import { HOME_FAQ } from "@/lib/faq";

const TOOLS = [
  { href: "/traffic", icon: BarChart3, title: "Website traffic checker", body: "Popularity rank, 30-day trend and an estimated visits range for any domain, plus hosting, tech stack and domain age." },
  { href: "/compare", icon: GitCompare, title: "Compare competitors", body: "Put up to 8 sites side by side and see who is gaining or losing ground." },
  { href: "/audit", icon: Stethoscope, title: "Site audit", body: "Live crawl of up to hundreds of pages, checked for 45+ technical and on-page issues, with a health score." },
  { href: "/analyzer", icon: FileSearch, title: "On-page SEO checker", body: "40+ checks for a single URL, a pixel-accurate SERP preview, keyword density and readability." },
  { href: "/analyzer", icon: Link2, title: "Broken link checker", body: "Check the HTTP status of every link on a page in one click." },
  { href: "/keywords", icon: Sparkles, title: "Keyword generator", body: "Hundreds of real searches from Google, Bing, YouTube, DuckDuckGo and Amazon, grouped by intent and topic." },
  { href: "/traffic", icon: Gauge, title: "Core Web Vitals", body: "Lighthouse lab scores and real-user Chrome data, with the fixes that matter most." },
  { href: "/api-docs", icon: Braces, title: "Free REST API", body: "Every tool is available as JSON or a streaming API for your own dashboards and scripts." },
];

const WHY = [
  { icon: Eye, title: "Every number shows its work", body: "Each metric names its source and links to the method behind it. Estimates come with ranges, not false precision." },
  { icon: Zap, title: "Live, not stale", body: "Audits and page checks fetch the site right now, instead of reading from a stored index." },
  { icon: Lock, title: "Free tools, no sign-up", body: "Every tool works without an account, a credit card or a captcha wall. Paid plans only add capacity, like bigger crawls and monitoring." },
  { icon: Download, title: "Export everything", body: "CSV and JSON exports on every table. Shareable links for every report." },
  { icon: Code2, title: "Open source & self-hostable", body: "Run it on your own server, read the code, or extend it. MIT licensed." },
  { icon: Braces, title: "API included", body: "The same engine behind the UI is available as a documented REST API." },
];

const COMPARISON: [string, string | boolean, string | boolean][] = [
  ["Price", "Free; paid plans from $19/mo (coming soon)", "Paid subscription"],
  ["Use without an account", true, false],
  ["Site audit", "Live crawl, no setup", "Project setup and crawl quotas"],
  ["On-page SEO checks", true, true],
  ["Keyword ideas", "Live autocomplete from 5 engines", "Proprietary database"],
  ["Search volume & keyword difficulty", "Relative score only", true],
  ["Traffic estimates", "Rank-based range, model published", "Model-based single number"],
  ["Backlink index", false, true],
  ["Rank tracking", false, true],
  ["Method linked from every metric", true, "Partially"],
  ["Self-hosting & full API", true, "API on higher tiers"],
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="mx-auto h-4 w-4 text-good-ink" aria-label="Yes" />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-ink-3" aria-label="No" />;
  return <span>{v}</span>;
}

export default function Home() {
  return (
    <div className="-mt-2">
      <section className="py-10 text-center sm:py-16">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2">
          <span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden /> Free · No sign-up · Open source
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">See how much traffic any website gets, and how to grow yours</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-2">
          Traffic estimates, live site audits, on-page SEO checks and keyword research in one place. Every number tells you where it came from.
        </p>
        <div className="mt-8">
          <HeroSearch />
        </div>
      </section>

      <section aria-labelledby="tools-heading" className="py-8">
        <h2 id="tools-heading" className="mb-5 text-xl font-semibold text-ink">Tools</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((t) => (
            <Link key={t.title} href={t.href} className="card group flex flex-col p-5 transition-colors hover:border-line-strong">
              <t.icon className="h-5 w-5 text-accent-ink" aria-hidden />
              <h3 className="mt-3 font-semibold text-ink">{t.title}</h3>
              <p className="mt-1.5 flex-1 text-sm text-ink-2">{t.body}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-ink">
                Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="why-heading" className="py-10">
        <h2 id="why-heading" className="text-xl font-semibold text-ink">Why TrafficLens</h2>
        <p className="mt-1 max-w-2xl text-ink-2">Paid SEO suites are powerful, but they&apos;re expensive, they gate most features, and they rarely explain their numbers. We took the opposite approach.</p>
        <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map((w) => (
            <div key={w.title} className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                <w.icon className="h-4 w-4 text-accent-ink" aria-hidden />
              </div>
              <div>
                <h3 className="font-semibold text-ink">{w.title}</h3>
                <p className="mt-1 text-sm text-ink-2">{w.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="compare-heading" className="py-10">
        <h2 id="compare-heading" className="text-xl font-semibold text-ink">An honest comparison</h2>
        <p className="mt-1 max-w-2xl text-ink-2">
          What we do better, and what we can&apos;t do. A backlink index and search volumes require crawling the web or buying clickstream data, which is why paid tools charge for them.
        </p>
        <div className="card mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th className="px-5 py-3 font-medium">Feature</th>
                <th className="px-5 py-3 text-center font-medium text-ink">TrafficLens</th>
                <th className="px-5 py-3 text-center font-medium">Typical paid SEO suites</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {COMPARISON.map(([feature, ours, theirs]) => (
                <tr key={feature}>
                  <td className="px-5 py-2.5 text-ink">{feature}</td>
                  <td className="px-5 py-2.5 text-center text-ink-2"><Cell v={ours} /></td>
                  <td className="px-5 py-2.5 text-center text-ink-2"><Cell v={theirs} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="faq-heading" className="py-10">
        <h2 id="faq-heading" className="text-xl font-semibold text-ink">Questions</h2>
        <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
          {HOME_FAQ.map(({ q, a }) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer items-center justify-between font-medium text-ink">
                {q}
                <span className="ml-4 text-ink-3 transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-2 text-sm text-ink-2">{a}</p>
            </details>
          ))}
        </div>
        <Link href="/faq" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
          See all questions <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
