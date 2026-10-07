import type { Metadata } from "next";
import Link from "next/link";
import { Shield } from "lucide-react";
import { SITE } from "@/lib/site";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What TrafficLens collects (very little), how it's used, which services see your queries, and your choices.",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line py-7 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-2 [&_a]:text-accent-ink [&_a:hover]:underline [&_li]:pl-1 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

const updated = new Date(`${SITE.privacyUpdated}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={<Shield className="h-7 w-7 text-accent-ink" aria-hidden />}
        title="Privacy Policy"
        description={
          <>
            Last updated {updated}. The short version: we don&apos;t sell data, show ads, use tracking cookies, or store the reports you run.
          </>
        }
      />

      <div className="card mb-8 p-5 text-sm text-ink-2">
        <h2 className="font-semibold text-ink">At a glance</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>You can use every tool without an account.</li>
          <li>Reports are generated on request and not saved on our servers.</li>
          <li>No analytics, advertising or tracking cookies.</li>
          <li>If you sign in or contact us, we use your details only to provide the service and reply to you.</li>
        </ul>
      </div>

      <Section id="what" title="1. Information we process">
        <p>
          <strong>What you enter.</strong> Domains, URLs and keywords you submit are used to produce the report you asked for. We don&apos;t link them to you, and we don&apos;t keep a history of them on our
          servers.
        </p>
        <p>
          <strong>Technical data.</strong> Like any website, our servers receive your IP address and browser details with each request. We use your IP address only for rate limiting, held in memory for at
          most an hour. Our hosting provider keeps standard request logs under its own privacy policy.
        </p>
        <p>
          <strong>Account data (only if you sign in).</strong> When you sign in with Google or GitHub, we receive your name, email address and profile picture. They&apos;re stored in an encrypted session cookie
          in your browser; we don&apos;t keep an account database.
        </p>
        <p>
          <strong>Messages you send us.</strong> When you use the contact form, we receive your name, email address, topic and message, and use them to reply. Waitlist sign-ups are used to email you when paid
          plans launch.
        </p>
      </Section>

      <Section id="third-parties" title="2. Services that see your queries">
        <p>To build reports, our servers (not your browser) send the domain, URL or keyword you entered to these services. They receive our server&apos;s address, not yours:</p>
        <ul>
          <li>The website you&apos;re analyzing, which we fetch as &ldquo;TrafficLensBot&rdquo;.</li>
          <li>Tranco (popularity ranks), domain registries via RDAP and rdap.org, the Internet Archive, and public DNS.</li>
          <li>Google PageSpeed Insights, only when you run a Core Web Vitals test.</li>
          <li>Open PageRank, if the site operator has enabled it.</li>
          <li>Autocomplete services from Google, YouTube, Bing, DuckDuckGo and Amazon, for keyword ideas.</li>
        </ul>
        <p>
          Some images load directly in your browser, so those sites can see your IP address: favicons and preview images of the sites you analyze, and your profile picture from Google or GitHub when signed in.
        </p>
        <p>Service providers that process data on our behalf: our hosting provider; Google and GitHub for sign-in; and Resend, which delivers contact-form emails to us.</p>
      </Section>

      <Section id="storage" title="3. Cookies and local storage">
        <ul>
          <li>
            <strong>No cookies</strong> are set unless you sign in. Signing in sets an encrypted session cookie (valid for 30 days) plus short-lived security cookies used during the sign-in process.
          </li>
          <li>
            <strong>Local storage</strong> in your browser keeps your theme choice and your recent searches. This never leaves your device; you can clear it with the &ldquo;Clear&rdquo; button or from your
            browser settings.
          </li>
        </ul>
      </Section>

      <Section id="retention" title="4. How long we keep data">
        <ul>
          <li>Reports: not stored. Public data such as ranks and archive dates is cached in memory for up to 24 hours to keep the tools fast.</li>
          <li>Rate-limit counters: up to one hour, in memory.</li>
          <li>Session cookie: until you sign out or it expires after 30 days.</li>
          <li>Contact messages and waitlist sign-ups: as long as needed to reply or to tell you about the launch, then deleted on request.</li>
        </ul>
      </Section>

      <Section id="use" title="5. How we use information">
        <p>Only to run the tools, prevent abuse, reply to messages and tell waitlist members when paid plans launch. We don&apos;t sell or rent personal information, and we don&apos;t use it for advertising.</p>
      </Section>

      <Section id="rights" title="6. Your choices and rights">
        <p>
          Depending on where you live, you may have the right to access, correct or delete personal information, or to object to its use. Because we keep so little, most requests concern contact messages and
          waitlist sign-ups. Send a request through the{" "}
          <Link href="/contact?topic=privacy">contact form</Link> with the topic &ldquo;Privacy or data request&rdquo;. You can also sign out at any time to remove the session cookie.
        </p>
      </Section>

      <Section id="security" title="7. Security">
        <p>
          The site is served over HTTPS, session cookies are encrypted, and our fetcher refuses to reach private network addresses. No system is perfectly secure, but we collect as little as possible so there
          is little to expose.
        </p>
      </Section>

      <Section id="children" title="8. Children">
        <p>TrafficLens is not directed at children under 16, and we don&apos;t knowingly collect their personal information.</p>
      </Section>

      <Section id="changes" title="9. Changes and contact">
        <p>
          If we change this policy, we&apos;ll update the date at the top of this page. Questions? <Link href="/contact?topic=privacy">Contact us</Link> or open an issue on{" "}
          <a href={SITE.issuesUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
