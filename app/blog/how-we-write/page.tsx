import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "How we write and check stories",
  description: "How TrafficLens picks, verifies, writes and corrects the news stories on its blog, including how AI is used.",
  alternates: { canonical: "/blog/how-we-write" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-7 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-2 [&_a]:text-accent-ink [&_a:hover]:underline [&_li]:pl-1 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export default function HowWeWrite() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="How we write and check stories" description="The rules every story on the TrafficLens blog follows, from picking a story to fixing mistakes." />

      <Section title="What we cover">
        <p>
          The biggest technology stories of the day: AI, search, chips, cloud and infrastructure, platforms and the business of the web. We pick stories that many outlets are reporting and that matter to
          people who build, run or market websites, and we explain what changed, why it matters and what to watch next.
        </p>
      </Section>

      <Section title="How stories are checked">
        <ul>
          <li>
            <strong>Two independent sources, minimum.</strong> Every fact in a story&apos;s &ldquo;Key facts&rdquo; box is confirmed by at least two independent outlets or by the company&apos;s own announcement plus an
            independent report. The sources are linked at the end of every story.
          </li>
          <li>
            <strong>Conflicting numbers are resolved or left out.</strong> When reports disagree, we use the primary source (the company announcement or filing) or don&apos;t print the number.
          </li>
          <li>
            <strong>No invented quotes.</strong> Quotes are reproduced word for word from a source and attributed. We don&apos;t paraphrase someone into a quote.
          </li>
          <li>
            <strong>Reported is not confirmed.</strong> Rumors and anonymous-source reports are labeled as such, and events that haven&apos;t happened yet aren&apos;t written up as if they had.
          </li>
        </ul>
      </Section>

      <Section title="How AI is used">
        <p>
          Stories are researched and drafted with AI assistance, then checked against the sources before publishing. We use AI to work faster, not to publish more: one story when there&apos;s real news, none when
          there isn&apos;t. Each story says so at the end, and lists every source it relies on.
        </p>
      </Section>

      <Section title="Corrections">
        <p>
          If we get something wrong, we fix it and add an &ldquo;Updated&rdquo; time to the story. Spotted an error?{" "}
          <Link href="/contact?topic=bug">Tell us</Link> and include the story&apos;s link.
        </p>
      </Section>

      <p className="mt-4 text-sm">
        <Link href="/blog" className="text-accent-ink hover:underline">
          ← Back to the blog
        </Link>
      </p>
    </div>
  );
}
