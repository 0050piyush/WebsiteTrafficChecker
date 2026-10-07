import type { Metadata } from "next";
import Link from "next/link";
import { Code2, Eye, Heart, Lock, Scale, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "About us",
  description: "TrafficLens is a free, open-source SEO toolkit that shows its work: live data, transparent methods and honest estimates.",
};

const PRINCIPLES = [
  { icon: Eye, title: "Show the work", body: "Every number names its source and links to how it's calculated. Estimates come with ranges, not false precision." },
  { icon: Zap, title: "Live over stale", body: "Audits and page checks fetch the site when you ask, so you see what's there today, not a crawl from weeks ago." },
  { icon: Heart, title: "Free where it counts", body: "Every tool works without an account, supported by ads. Paid plans are ad-free and only charge for what costs real money to run." },
  { icon: Scale, title: "Honest about limits", body: "We don't have a backlink index or search volumes, so we don't invent them. We'd rather show less and be right." },
  { icon: Lock, title: "Private by default", body: "Reports aren't stored, recent searches stay in your browser, and we never sell your data." },
  { icon: Code2, title: "Open source", body: "The code is MIT licensed. Read it, run it on your own server, or help improve it." },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="About TrafficLens" description="A free, open-source SEO toolkit for people who want to understand their numbers, not just look at them." />

      <div className="space-y-4 text-[15px] leading-relaxed text-ink-2">
        <p>
          SEO tools are powerful, but the best ones are expensive, hide most features behind a subscription, and rarely explain where their numbers come from. Two tools will often disagree about the same
          site by several times, and neither tells you why.
        </p>
        <p>
          TrafficLens takes a different approach. It checks websites live, uses open research data such as popularity rankings combined from several independent sources and public registries, and
          publishes the{" "}
          <Link href="/methodology" className="text-accent-ink hover:underline">
            method behind every metric
          </Link>
          . When something is an estimate, we show it as a range and say so.
        </p>
      </div>

      <h2 className="mt-12 text-xl font-semibold text-ink">What we believe</h2>
      <div className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {PRINCIPLES.map((p) => (
          <div key={p.title} className="flex gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
              <p.icon className="h-4 w-4 text-accent-ink" aria-hidden />
            </div>
            <div>
              <h3 className="font-semibold text-ink">{p.title}</h3>
              <p className="mt-1 text-sm text-ink-2">{p.body}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-xl font-semibold text-ink">What&apos;s next</h2>
      <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-ink-2">
        <p>
          The free tools are here to stay. Next we&apos;re building the features people ask for most: scheduled audits with email alerts, saved projects, larger crawls and higher API limits. Those will be part
          of the Pro and Agency plans, because they cost real money to run.
        </p>
      </div>

      <div className="card mt-10 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-ink">Have feedback or want to help?</h2>
          <p className="mt-1 text-sm text-ink-2">Tell us what to build next or report wrong data.</p>
        </div>
        <Link href="/contact" className="inline-flex h-10 shrink-0 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">
          Contact us
        </Link>
      </div>
    </div>
  );
}
