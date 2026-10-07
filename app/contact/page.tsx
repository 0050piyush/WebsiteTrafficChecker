import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Bug, Mail, Shield } from "lucide-react";
import { CONTACT_TOPICS, isContactEnabled, type ContactTopic, type WaitlistPlan } from "@/lib/contact";
import { SITE } from "@/lib/site";
import { ContactForm } from "@/components/ContactForm";
import { GitHubIcon } from "@/components/BrandIcons";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Questions, bug reports, feature ideas or joining the paid plans waitlist: get in touch with the TrafficLens team.",
};
export const dynamic = "force-dynamic";

export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const topicParam = typeof params.topic === "string" ? params.topic : "";
  const planParam = typeof params.plan === "string" ? params.plan : "";
  const defaultTopic = (CONTACT_TOPICS.some((t) => t.id === topicParam) ? topicParam : "general") as ContactTopic;
  const defaultPlan = planParam === "pro" || planParam === "agency" ? (planParam as WaitlistPlan) : null;
  const enabled = isContactEnabled();

  return (
    <div>
      <PageHeader
        icon={<Mail className="h-7 w-7 text-accent-ink" aria-hidden />}
        title="Contact us"
        description="Questions about a number, a bug, an idea, or interest in the paid plans: we read every message."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="card p-6" aria-label="Contact form">
          {enabled ? (
            <ContactForm defaultTopic={defaultTopic} defaultPlan={defaultPlan} />
          ) : (
            <div className="py-6 text-center">
              <Mail className="mx-auto h-9 w-9 text-ink-3" aria-hidden />
              <h2 className="mt-3 text-lg font-semibold text-ink">The contact form is being set up</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">
                Until it&apos;s ready, the quickest way to reach us is a GitHub issue. Use it for questions, bug reports, feature ideas and to register interest in paid plans.
              </p>
              <a
                href={SITE.issuesUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-on-accent hover:bg-accent-hover"
              >
                <GitHubIcon className="h-4 w-4" />
                Open a GitHub issue
              </a>
            </div>
          )}
        </section>

        <aside className="space-y-4 text-sm">
          {[
            {
              icon: BookOpen,
              title: "Questions about a number?",
              body: (
                <>
                  The{" "}
                  <Link href="/methodology" className="text-accent-ink hover:underline">
                    methodology
                  </Link>{" "}
                  and{" "}
                  <Link href="/faq" className="text-accent-ink hover:underline">
                    FAQ
                  </Link>{" "}
                  explain where every metric comes from.
                </>
              ),
            },
            {
              icon: Bug,
              title: "Found a bug?",
              body: (
                <>
                  Include the URL you checked and what you expected to see. Public reports on{" "}
                  <a href={SITE.issuesUrl} target="_blank" rel="noreferrer" className="text-accent-ink hover:underline">
                    GitHub
                  </a>{" "}
                  help everyone.
                </>
              ),
            },
            {
              icon: Shield,
              title: "Privacy requests",
              body: (
                <>
                  Choose &ldquo;Privacy or data request&rdquo; as the topic. Our{" "}
                  <Link href="/privacy" className="text-accent-ink hover:underline">
                    Privacy Policy
                  </Link>{" "}
                  explains what we keep (very little).
                </>
              ),
            },
          ].map((item) => (
            <div key={item.title} className="card p-4">
              <h2 className="flex items-center gap-2 font-semibold text-ink">
                <item.icon className="h-4 w-4 text-accent-ink" aria-hidden />
                {item.title}
              </h2>
              <p className="mt-1 text-ink-2">{item.body}</p>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
