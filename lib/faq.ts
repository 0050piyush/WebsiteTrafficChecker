export interface FaqItem {
  q: string;
  a: string;
  link?: { href: string; label: string };
}

export interface FaqGroup {
  id: string;
  title: string;
  items: FaqItem[];
}

export const FAQ: FaqGroup[] = [
  {
    id: "general",
    title: "General",
    items: [
      { q: "What is TrafficLens?", a: "A free SEO toolkit: a website traffic checker, competitor comparison, live site audits, an on-page SEO checker with a broken link checker, a keyword generator and Core Web Vitals tests. Every metric shows where it came from." },
      { q: "Is it really free?", a: "Yes. Every tool works for free, without an account or a credit card. Paid plans are coming for heavier use, such as bigger crawls and scheduled monitoring, but the free tools stay free.", link: { href: "/pricing", label: "See pricing" } },
      { q: "Do I need an account?", a: "No. You can sign in with Google or GitHub, but accounts will only be needed for paid features such as saved projects and scheduled audits." },
      { q: "Is TrafficLens open source?", a: "Yes, under the MIT license. You can read the code, run your own copy, or contribute.", link: { href: "https://github.com/0050piyush/WebsiteTrafficChecker", label: "View on GitHub" } },
    ],
  },
  {
    id: "traffic",
    title: "Traffic data",
    items: [
      { q: "Where does the traffic data come from?", a: "From the Tranco list, a research ranking of the top one million websites that averages several independent popularity sources over 30 days, which makes it hard to game. We convert the rank to a monthly visits range with a published model.", link: { href: "/methodology#traffic", label: "Read the method" } },
      { q: "How accurate are the traffic estimates?", a: "Treat them as order-of-magnitude: the real number usually falls within the range we show. Every traffic tool estimates; we show a range and the method instead of a single number that only looks exact. The popularity rank itself is measured data." },
      { q: "Why does Ahrefs, Semrush or Similarweb show a different number?", a: "They often measure something else (for example, Ahrefs' organic traffic counts only visits from Google search, while ours counts all visits) and use different models. Expect tools to disagree by 2–3×; compare trends and competitors within one tool.", link: { href: "/methodology#other-tools", label: "Why tools differ" } },
      { q: "Why is my site \"Unranked\"?", a: "It isn't in the top one million sites, which usually means fewer than about 9,000 visits a month. Rankings track registrable domains, so subdomains share their parent domain's rank." },
      { q: "How often is the data updated?", a: "Popularity ranks come from Tranco's daily list. Page, SEO, technology, TLS and DNS data is fetched live when you search. Registration and archive data can be cached for up to 24 hours." },
    ],
  },
  {
    id: "audit",
    title: "Site audit & page checks",
    items: [
      { q: "How does the site audit work?", a: "We start at the URL you enter, read robots.txt and your XML sitemaps, and follow links breadth-first, checking every page for 48 kinds of technical and on-page issues, plus the status of links and images.", link: { href: "/audit", label: "Run an audit" } },
      { q: "How many pages can I audit?", a: "Up to 200 pages per crawl on the Free plan. The Pro and Agency plans will raise that to 5,000 and 25,000 pages." },
      { q: "Why did my audit stop after one page?", a: "The site's robots.txt doesn't allow crawlers like ours. Many large sites allow only search engines. If it's your own site, untick \"Respect robots.txt\" and run the audit again." },
      { q: "Can it check sites built with JavaScript?", a: "Partly. We read the HTML your server sends and don't run JavaScript. When a page builds its content in the browser, we flag it and treat missing headings or text as warnings rather than errors." },
      { q: "Will an audit slow down my website?", a: "It shouldn't. Our crawler identifies itself as TrafficLensBot, fetches at most five pages at a time, and respects robots.txt and crawl-delay by default." },
    ],
  },
  {
    id: "keywords",
    title: "Keywords",
    items: [
      { q: "Do you show search volume?", a: "No. Accurate search volumes need paid clickstream data. Instead we show a suggest score: how prominently search engines suggest a phrase, relative to the other ideas in your search." },
      { q: "Which countries and languages are supported?", a: "17 countries and 10 languages, using suggestions from Google, Bing, YouTube, DuckDuckGo and Amazon (US)." },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & accounts",
    items: [
      { q: "Do you store the sites I check?", a: "No. Reports are generated live and not saved on our servers. Your recent searches are kept only in your own browser.", link: { href: "/privacy", label: "Privacy Policy" } },
      { q: "Do you use cookies?", a: "Only if you sign in, for your session. There are no analytics, advertising or tracking cookies." },
      { q: "When will paid plans be available?", a: "They're in development. Join the waitlist and we'll email you when they launch; nothing is charged until you choose to buy.", link: { href: "/contact?topic=waitlist", label: "Join the waitlist" } },
    ],
  },
  {
    id: "api",
    title: "API & self-hosting",
    items: [
      { q: "Is there an API?", a: "Yes. Every tool is available as a JSON or streaming API with fair-use rate limits per IP address.", link: { href: "/api-docs", label: "API documentation" } },
      { q: "Can I host TrafficLens myself?", a: "Yes. It's a standard Next.js app with a Dockerfile. Self-hosting lets you set your own limits." },
    ],
  },
];

/** The handful shown on the home page. */
export const HOME_FAQ: FaqItem[] = [FAQ[1].items[0], FAQ[1].items[1], FAQ[4].items[0], FAQ[2].items[4], FAQ[0].items[1]];
