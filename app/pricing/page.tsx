import type { Metadata } from "next";
import Link from "next/link";
import { Check, Clock, Minus } from "lucide-react";
import { COMPARISON_GROUPS, CURRENCY, formatPrice, PLANS, type Cell } from "@/lib/plans";
import { cx } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Every TrafficLens tool is free with no account. Pro ($19/mo) and Agency ($49/mo) plans with no audit page limit, monitoring and higher API limits are coming soon.",
};

function CellValue({ value }: { value: Cell }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-good-ink" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-ink-3" aria-label="Not included" />;
  return <span className="text-ink">{value}</span>;
}

export default function PricingPage() {
  return (
    <div>
      <section className="mx-auto max-w-2xl py-6 text-center sm:py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Simple pricing. Free where it counts.</h1>
        <p className="mt-3 text-lg text-ink-2">
          Every tool is free to use today, with no account and no card; the Free plan is supported by ads. Paid plans are ad-free and add what costs us real money to run: bigger crawls, scheduled monitoring and higher limits.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <section
            key={plan.id}
            aria-labelledby={`plan-${plan.id}`}
            className={cx("card relative flex flex-col p-6", plan.featured && "border-accent ring-1 ring-accent")}
          >
            {plan.featured && (
              <span className="absolute -top-3 left-6 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-on-accent">Most popular</span>
            )}
            <div className="flex items-center justify-between gap-2">
              <h2 id={`plan-${plan.id}`} className="text-lg font-semibold text-ink">
                {plan.name}
              </h2>
              {plan.available ? (
                <span className="rounded-full bg-good-soft px-2 py-0.5 text-xs font-medium text-good-ink">Available now</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-ink">
                  <Clock className="h-3 w-3" aria-hidden /> Coming soon
                </span>
              )}
            </div>
            <p className="mt-1 min-h-10 text-sm text-ink-2">{plan.description}</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight text-ink">{formatPrice(plan)}</span>
              <span className="text-sm text-ink-3">{plan.price === 0 ? "forever" : `${CURRENCY.code} / month`}</span>
            </div>
            <Link
              href={plan.cta.href}
              className={cx(
                "mt-5 inline-flex h-11 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                plan.featured ? "bg-accent text-on-accent hover:bg-accent-hover" : "border border-line-strong bg-surface text-ink hover:bg-surface-2",
              )}
            >
              {plan.cta.label}
            </Link>
            <ul className="mt-6 space-y-2.5 text-sm">
              {plan.highlights.map((h) => (
                <li key={h} className="flex gap-2.5 text-ink-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-good-ink" aria-hidden />
                  {h}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-ink-3">
        Paid plans aren&apos;t on sale yet. Join the waitlist and we&apos;ll email you once when they launch. Features and prices may change before then, and nothing is charged until you choose to buy.
      </p>

      <section aria-labelledby="compare-plans" className="mt-14">
        <h2 id="compare-plans" className="text-xl font-semibold text-ink">
          Compare plans
        </h2>
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-3 py-3 text-left font-medium text-ink-3 sm:px-5">Feature</th>
                {PLANS.map((p) => (
                  <th key={p.id} className="w-[22%] px-1.5 py-3 text-center font-semibold text-ink sm:w-[18%] sm:px-4">
                    {p.name}
                    <div className="text-xs font-normal text-ink-3">{formatPrice(p)}/mo</div>
                  </th>
                ))}
              </tr>
            </thead>
            {COMPARISON_GROUPS.map((group) => (
              <tbody key={group.title} className="divide-y divide-line border-b border-line last:border-b-0">
                <tr className="bg-surface-2/60">
                  <th colSpan={4} scope="colgroup" className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-3 sm:px-5">
                    {group.title}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.feature}>
                    <th scope="row" className="px-3 py-2.5 text-left font-normal text-ink-2 sm:px-5">
                      {row.feature}
                    </th>
                    {PLANS.map((p) => (
                      <td key={p.id} className="px-1.5 py-2.5 text-center sm:px-4">
                        <CellValue value={row.values[p.id]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      <section aria-labelledby="pricing-faq" className="mx-auto mt-14 max-w-3xl">
        <h2 id="pricing-faq" className="text-xl font-semibold text-ink">
          Pricing questions
        </h2>
        <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
          {[
            ["Will the free tools stay free?", "Yes. Everything you can use today stays in the Free plan. Paid plans add capacity and features that cost money to run, such as large crawls and scheduled monitoring."],
            ["Why does the Free plan show ads?", "Ads pay for the servers and data that keep the free tools free. Pro and Agency are completely ad-free: sign in with your paid account and the ads disappear on every page."],
            ["When will paid plans launch?", "They're in development. Join the waitlist and we'll email you when they're ready. There's no commitment and nothing is charged until you decide to buy."],
            ["Do I need an account?", "Not for the free tools. Accounts (sign in with Google or GitHub) will be needed for paid features like saved projects and scheduled audits."],
            ["Can I self-host instead?", "Yes. TrafficLens is open source under the MIT license, so you can run it on your own server and set your own limits."],
          ].map(([q, a]) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer items-center justify-between font-medium text-ink">
                {q}
                <span className="ml-4 text-ink-3 transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-ink-2">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-sm text-ink-3">
          More answers in the{" "}
          <Link href="/faq" className="text-accent-ink hover:underline">
            FAQ
          </Link>
          , or{" "}
          <Link href="/contact" className="text-accent-ink hover:underline">
            contact us
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
