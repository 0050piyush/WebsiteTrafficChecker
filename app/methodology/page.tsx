import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { TRAFFIC_ANCHORS } from "@/lib/traffic-model";
import { ISSUE_DEFS } from "@/lib/audit/issues";

export const metadata: Metadata = {
  title: "Methodology & Data Sources",
  description: "Exactly how TrafficLens computes every metric: data sources, the traffic model, SEO checks, audit health score and keyword scoring, plus known limitations.",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line py-8 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-2 [&_a]:text-accent-ink [&_a:hover]:underline [&_strong]:text-ink">{children}</div>
    </section>
  );
}

const fmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export default function Page() {
  const issues = Object.entries(ISSUE_DEFS);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={<BookOpen className="h-7 w-7 text-accent-ink" aria-hidden />}
        title="Methodology & data sources"
        description="Every number in TrafficLens can be traced to a source and a method. If something looks wrong, this page tells you why it might be."
      />
      <nav className="card mb-8 p-4 text-sm" aria-label="On this page">
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {[
            ["traffic", "Traffic estimates"],
            ["other-tools", "Why other tools differ"],
            ["sources", "Domain data sources"],
            ["onpage", "On-page SEO score"],
            ["audit", "Site audit & health score"],
            ["keywords", "Keyword ideas"],
            ["vitals", "Core Web Vitals"],
            ["limits", "Limitations"],
            ["privacy", "Privacy & crawling etiquette"],
          ].map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="text-accent-ink hover:underline">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="traffic" title="Traffic estimates">
        <p>
          <strong>The rank is measured data.</strong> We use a research ranking of the top one million sites that averages several independent popularity sources (such as Chrome UX Report, Cloudflare Radar and other
          top lists) over 30 days. Because no single source dominates, it&apos;s much harder to manipulate than older rankings. It ranks registrable domains, so{" "}
          <code>blog.example.com</code> shares the rank of <code>example.com</code>.
        </p>
        <p>
          <strong>The visits figure is a model.</strong> Web traffic is heavy-tailed: visits fall off roughly as a power of rank. We interpolate in log-log space between these calibration anchors, which reflect publicly reported
          traffic for well-known sites at those ranks:
        </p>
        <div className="card overflow-hidden">
          <table className="tabular w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th className="px-4 py-2 font-medium">Rank</th>
                <th className="px-4 py-2 text-right font-medium">Estimated monthly visits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {TRAFFIC_ANCHORS.map(([rank, visits]) => (
                <tr key={rank}>
                  <td className="px-4 py-1.5 text-ink">#{rank.toLocaleString("en-US")}</td>
                  <td className="px-4 py-1.5 text-right text-ink">{fmt.format(visits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          We show a range around the midpoint: ÷/× (2 + 0.25 × log₁₀ rank), i.e. ×2 for the top site and ×3.5 at rank one million. Real traffic can fall outside it: sites with heavy app or API traffic, very seasonal sites,
          and domains used mostly by machines (CDNs, ad servers) rank higher than their human visits justify. Sites outside the top million aren&apos;t ranked; we report them as likely below ~9K visits a month.
        </p>
        <p>
          Other tools also estimate traffic, usually from modeled search rankings or clickstream panels. Their numbers look precise but are estimates too. We prefer to show the uncertainty.
        </p>
      </Section>

      <Section id="other-tools" title="Why Ahrefs, Semrush or Similarweb show different numbers">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>They often measure something else.</strong> &ldquo;Organic traffic&rdquo; in Ahrefs or Semrush counts only visits from Google&apos;s organic results. Our figure counts all visits: search, direct, social,
            email and referral. For a well-known brand, total traffic is usually far higher than organic traffic; for a site that lives on search, the two can be close.
          </li>
          <li>
            <strong>They use different evidence.</strong> Ahrefs multiplies the keywords it thinks a site ranks for by estimated search volume and click-through rate; Similarweb models panel and ISP data; we
            convert a measured popularity rank. Each has blind spots. Keyword models miss traffic from keywords they don&apos;t track. Rank-based estimates run low for sites whose visitors arrive once from
            search and rarely return, because popularity lists reward repeat and returning users.
          </li>
          <li>
            <strong>How to compare.</strong> Treat any single tool&apos;s number as accurate to roughly 2–3× either way. The trend, and the order of competitors measured with the same tool, are far more
            reliable than absolute numbers compared across tools.
          </li>
        </ul>
      </Section>

      <Section id="sources" title="Domain data sources">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Homepage, tech stack, TLS, headers:</strong> fetched live by our server at the moment you search. Response times are measured from our server&apos;s location, not yours.</li>
          <li><strong>Technology detection:</strong> 130+ fingerprints matched against response headers, cookies, script URLs and HTML. Hover a badge to see the evidence for each detection.</li>
          <li><strong>Registration:</strong> <a href="https://about.rdap.org" target="_blank" rel="noreferrer">RDAP</a>, the structured successor to WHOIS, queried at the registry listed in IANA&apos;s bootstrap file.</li>
          <li><strong>DNS & email:</strong> live DNS queries for A, AAAA, MX, NS, TXT, CAA and <code>_dmarc</code> records. Providers are inferred from record hostnames.</li>
          <li><strong>History:</strong> the <a href="https://web.archive.org" target="_blank" rel="noreferrer">Internet Archive</a> CDX API: first capture and the years with snapshots.</li>
          <li><strong>Crawlability:</strong> <code>robots.txt</code> and up to 8 XML sitemaps (including sitemap indexes and <code>.xml.gz</code> files).</li>
          <li><strong>Authority (optional):</strong> <a href="https://www.domcop.com/openpagerank/" target="_blank" rel="noreferrer">Open PageRank</a>, a 0–10 score computed from the Common Crawl link graph, shown when the server has an API key.</li>
        </ul>
      </Section>

      <Section id="onpage" title="On-page SEO score">
        <p>
          The page analyzer runs 40+ checks in eight categories: indexing, meta tags, content, keyword placement, links, images, social and rich results, performance and security. Each check passes, warns or fails, and
          has a weight from 1 to 3 that reflects its impact (for example, a 404 status or a noindex tag weighs 3, a missing favicon weighs 1). Informational checks don&apos;t count.
        </p>
        <p>
          <strong>Score = Σ(weight × result) ÷ Σ(weight)</strong>, where pass = 1, warning = 0.5 and fail = 0.
        </p>
        <p>
          Title and description lengths are measured in <strong>pixels</strong> using Arial character widths (20px for titles, 14px for descriptions), because search engines truncate by width, not character count. Limits are
          ~600px for titles and ~920px for descriptions. The preview is approximate: engines rewrite titles and snippets when they think they can do better.
        </p>
        <p>
          <strong>robots.txt</strong> is judged for the bots that matter for search: Googlebot and Bingbot. Many large sites allow those but block every other bot, ours included; that is reported, but it
          isn&apos;t counted against the page.
        </p>
        <p>
          <strong>JavaScript-built pages:</strong> the analyzer reads the HTML the server sends and doesn&apos;t run JavaScript. When a page is a near-empty shell whose content is built in the browser, we
          flag it and report missing headings and thin text as warnings rather than failures, because they may appear after rendering.
        </p>
        <p>Readability uses the Flesch reading-ease formula, which is designed for English text.</p>
      </Section>

      <Section id="audit" title="Site audit & health score">
        <p>
          The crawler starts at the URL you enter, follows the redirect to the canonical host, reads <code>robots.txt</code> and your sitemaps, then crawls breadth-first: pages closest to the homepage first, sitemap-only URLs
          last. Redirects are recorded rather than followed silently, so chains and loops show up. Click depth is the number of links from the start page (redirects add zero). Images, files and external links are checked
          with HEAD requests, falling back to GET.
        </p>
        <p>
          <strong>Health score = share of crawled URLs with no error-level issue.</strong> Warnings and notices don&apos;t lower it, but they&apos;re worth fixing. External links that return 401, 403, 429 or 999 are not
          reported as broken, because many sites block bots while working fine in a browser.
        </p>
        <details className="card p-4">
          <summary className="cursor-pointer font-medium text-ink">All {issues.length} issue types</summary>
          <ul className="mt-3 divide-y divide-line text-sm">
            {issues.map(([id, d]) => (
              <li key={id} className="py-2">
                <span className="font-medium text-ink">{d.title}</span> <span className="text-xs uppercase text-ink-3">{d.severity}</span>
                <div className="text-ink-2">{d.description}</div>
              </li>
            ))}
          </ul>
        </details>
      </Section>

      <Section id="keywords" title="Keyword ideas">
        <p>
          We send your seed to each autocomplete service alongside question words (how, what, why…), prepositions (for, with, vs…) and, in deep mode, modifiers (best, free…) and every letter A–Z. Every suggestion that comes back
          is a real query people type often enough for the engine to suggest it.
        </p>
        <p>
          <strong>Suggest score:</strong> each time a phrase appears, it earns 1 ÷ (its position in the list), because engines order suggestions by popularity. Points are summed across queries and engines, boosted by 25% for
          every additional engine that agrees, and normalized so the strongest phrase scores 100. It&apos;s a relative signal within one search, <strong>not</strong> a search volume.
        </p>
        <p>
          <strong>Intent</strong> is assigned by matching modifier words (buy, price → transactional; best, vs, review → commercial; login, official → navigational; everything else → informational). <strong>Clusters</strong>{" "}
          group phrases by their most common shared modifier word.
        </p>
      </Section>

      <Section id="top-keywords" title="Top keywords in the traffic report">
        <p>
          Tools like Ahrefs list the keywords a site ranks for from their own database of Google results, with each keyword&apos;s position and search volume. There&apos;s no free source for rankings, so by default we
          show the next best thing: the phrases a site targets that people actually search for, with how often they&apos;re searched.
        </p>
        <p>
          <strong>Finding the phrases.</strong> We take the brand (from the domain name and the site&apos;s name), every part of the homepage title, the main headings and subheadings, and a few phrases repeated in the
          page text. Long title phrases also contribute their first two or three words, because &quot;is it down right now&quot; is usually searched as &quot;is it down&quot;.
        </p>
        <p>
          <strong>Search volume.</strong> When the site operator connects Google Ads, volumes are Google&apos;s own average monthly searches from{" "}
          <a href="https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics" target="_blank" rel="noreferrer">
            Keyword Planner
          </a>
          , for the site&apos;s country. Otherwise they&apos;re rough estimates, marked &quot;~&quot; and &quot;est.&quot;: search engines only suggest popular queries, and the more popular a query, the fewer letters
          you need to type before it appears (&quot;a&quot; brings up amazon). We find the shortest prefix that still brings each phrase up, note its position and how many unrelated queries it beat there (winning
          after &quot;isitd&quot;, where there&apos;s little competition, counts for less than winning after &quot;is it d&quot;), and convert that to monthly searches with a formula calibrated on known volumes. Expect
          estimates to be off by up to 10×; they&apos;re rounded to one significant figure for that reason. Phrases that are never suggested, even typed in full, are left out.
        </p>
        <p>
          <strong>Demand</strong> is the volume in words: High is 10,000+ searches a month, Medium 1,000–10,000, Low under 1,000.
        </p>
        <p>
          <strong>Real rankings (optional).</strong> When the site operator connects a{" "}
          <a href="https://dataforseo.com/apis/dataforseo-labs-api" target="_blank" rel="noreferrer">
            DataForSEO Labs
          </a>{" "}
          account, the report instead shows the keywords the domain (including subdomains) ranks for on Google, sorted by the visits they bring, with position, monthly search volume and estimated traffic.
        </p>
        <p>
          <strong>Market.</strong> Keywords are looked up for the country a site most likely serves: its country-code domain (.co.uk → United Kingdom), else its page language, else the United States.
        </p>
      </Section>

      <Section id="vitals" title="Core Web Vitals">
        <p>
          Run on demand through Google&apos;s <a href="https://developers.google.com/speed/docs/insights/v5/about" target="_blank" rel="noreferrer">PageSpeed Insights API</a>. Lab scores come from a Lighthouse run on
          Google&apos;s servers. Field data is the 75th percentile of real Chrome users over the last 28 days (Chrome UX Report), for the URL when there&apos;s enough data, otherwise for the whole origin.
        </p>
      </Section>

      <Section id="limits" title="Limitations">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>No backlink index.</strong> Finding who links to a site requires crawling a large part of the web continuously. There is no free, accurate source, so we don&apos;t pretend.</li>
          <li><strong>No absolute search volume or keyword difficulty.</strong> These require clickstream data or paid APIs. Rankings and volumes for the top keywords appear only when a DataForSEO account is connected.</li>
          <li><strong>No rank tracking.</strong> Scraping search results violates search engines&apos; terms; paid SERP APIs are the legitimate route.</li>
          <li><strong>JavaScript-rendered content</strong> isn&apos;t executed by the crawler. If your content only appears after JavaScript runs, we (like many crawlers) may see less than your users do.</li>
          <li><strong>Audits are capped</strong> (default 200 pages per run on the hosted version) to keep the service fair and polite.</li>
        </ul>
      </Section>

      <Section id="privacy" title="Privacy & crawling etiquette">
        <p>
          Reports are generated on request and not stored on the server. Recent searches are kept only in your browser&apos;s local storage. Our crawler identifies itself as <code>TrafficLensBot</code>, respects{" "}
          <code>robots.txt</code> and crawl-delay by default, crawls at most five pages at a time, and refuses to fetch private network addresses.
        </p>
        <p>
          Questions or corrections? <Link href="https://github.com/0050piyush/WebsiteTrafficChecker/issues">Open an issue on GitHub</Link>.
        </p>
        <p className="text-xs text-ink-3">
          Data credits: popularity ranks from{" "}
          <a href="https://tranco-list.eu" target="_blank" rel="noreferrer">
            Tranco
          </a>
          , built from Chrome UX Report (CC BY-SA 4.0), Cloudflare Radar (CC BY-NC 4.0), Majestic (CC BY 3.0), Cisco Umbrella and Farsight.
        </p>
      </Section>
    </div>
  );
}
