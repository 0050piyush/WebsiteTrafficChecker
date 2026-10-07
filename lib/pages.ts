/** Every public page, grouped. Feeds the footer, the HTML sitemap and sitemap.xml. */
export interface SitePage {
  href: string;
  label: string;
  description: string;
  /** Include in sitemap.xml (search engines). */
  index?: boolean;
}

export const PAGE_GROUPS: { title: string; pages: SitePage[] }[] = [
  {
    title: "Tools",
    pages: [
      { href: "/traffic", label: "Website traffic checker", description: "Traffic estimate, popularity rank and trend, tech stack, hosting and domain history.", index: true },
      { href: "/compare", label: "Compare websites", description: "Up to 8 competitors side by side.", index: true },
      { href: "/audit", label: "Site audit", description: "Live crawl with 48 technical and on-page SEO checks.", index: true },
      { href: "/analyzer", label: "On-page SEO checker", description: "40+ checks for one page, plus a one-click broken link checker.", index: true },
      { href: "/keywords", label: "Keyword generator", description: "Keyword ideas from 5 search engines, grouped by intent and topic.", index: true },
    ],
  },
  {
    title: "Learn",
    pages: [
      { href: "/methodology", label: "Methodology & data sources", description: "Exactly how every metric is calculated.", index: true },
      { href: "/faq", label: "FAQ", description: "Answers to common questions.", index: true },
      { href: "/api-docs", label: "REST API", description: "Use every tool from your own code.", index: true },
    ],
  },
  {
    title: "Company",
    pages: [
      { href: "/about", label: "About us", description: "Why TrafficLens exists and what we believe.", index: true },
      { href: "/pricing", label: "Pricing", description: "Free tools, plus Pro and Agency plans (coming soon).", index: true },
      { href: "/contact", label: "Contact us", description: "Questions, bug reports and the paid plans waitlist.", index: true },
    ],
  },
  {
    title: "Account & legal",
    pages: [
      { href: "/login", label: "Log in", description: "Sign in with Google or GitHub." },
      { href: "/privacy", label: "Privacy Policy", description: "What we collect (very little) and your choices.", index: true },
      { href: "/sitemap", label: "Sitemap", description: "Every page on this site.", index: true },
    ],
  },
];
