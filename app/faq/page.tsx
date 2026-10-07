import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { FAQ } from "@/lib/faq";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about TrafficLens: where the traffic data comes from, how accurate it is, site audits, keywords, privacy, pricing and the API.",
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.flatMap((g) => g.items).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHeader icon={<HelpCircle className="h-7 w-7 text-accent-ink" aria-hidden />} title="Frequently asked questions" description="Can't find what you need? Ask us anything through the contact page." />

      <nav aria-label="FAQ sections" className="mb-8 flex flex-wrap gap-2">
        {FAQ.map((g) => (
          <a key={g.id} href={`#${g.id}`} className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 hover:text-ink">
            {g.title}
          </a>
        ))}
      </nav>

      <div className="space-y-10">
        {FAQ.map((group) => (
          <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="scroll-mt-20">
            <h2 id={`${group.id}-title`} className="text-lg font-semibold text-ink">
              {group.title}
            </h2>
            <div className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
              {group.items.map((item) => (
                <details key={item.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium text-ink">
                    {item.q}
                    <span className="shrink-0 text-ink-3 transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">
                    {item.a}
                    {item.link && (
                      <>
                        {" "}
                        {item.link.href.startsWith("http") ? (
                          <a href={item.link.href} target="_blank" rel="noreferrer" className="text-accent-ink hover:underline">
                            {item.link.label}
                          </a>
                        ) : (
                          <Link href={item.link.href} className="text-accent-ink hover:underline">
                            {item.link.label}
                          </Link>
                        )}
                      </>
                    )}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="card mt-12 flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-ink">Still have a question?</h2>
          <p className="mt-1 text-sm text-ink-2">We read every message.</p>
        </div>
        <Link href="/contact" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">
          Contact us
        </Link>
      </div>
    </div>
  );
}
