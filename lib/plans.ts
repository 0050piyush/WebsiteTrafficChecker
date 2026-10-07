/**
 * Plans and prices, in one place. Paid plans are on a waitlist: nothing is sold until
 * payments are wired up, so every paid-only feature is marked as coming soon.
 */

export type PlanId = "free" | "pro" | "agency";

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in whole currency units; 0 for free. */
  price: number;
  description: string;
  highlights: string[];
  cta: { label: string; href: string };
  /** Purchasable / usable today. */
  available: boolean;
  featured?: boolean;
}

export const CURRENCY = { code: "USD", symbol: "$" };

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Every tool on the site, no account or card needed. Supported by ads.",
    highlights: [
      "Website traffic checker",
      "Compare up to 8 websites",
      "Site audits up to 200 pages each",
      "On-page SEO and broken link checker",
      "Keyword ideas from 5 search engines",
      "Core Web Vitals tests",
      "CSV and JSON exports",
      "REST API with fair-use limits",
    ],
    cta: { label: "Start for free", href: "/traffic" },
    available: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    description: "For site owners and marketers who check their SEO every week.",
    highlights: [
      "Everything in Free",
      "No ads anywhere on the site",
      "Site audits with no page limit",
      "Scheduled weekly audits with email alerts",
      "Track traffic trends for 50 websites",
      "Compare up to 25 websites",
      "Saved projects and report history",
      "PDF reports",
      "Personal API key with 10× higher limits",
    ],
    cta: { label: "Join the waitlist", href: "/contact?topic=waitlist&plan=pro" },
    available: false,
    featured: true,
  },
  {
    id: "agency",
    name: "Agency",
    price: 49,
    description: "For agencies and teams reporting on many client sites.",
    highlights: [
      "Everything in Pro, ad-free",
      "Site audits with no page limit",
      "Daily scheduled audits",
      "Track traffic trends for 250 websites",
      "5 team seats",
      "White-label PDF reports with your logo",
      "API key with 50× higher limits",
      "Priority email support",
    ],
    cta: { label: "Join the waitlist", href: "/contact?topic=waitlist&plan=agency" },
    available: false,
  },
];

export type Cell = boolean | string;

export interface ComparisonRow {
  feature: string;
  values: Record<PlanId, Cell>;
}

export const COMPARISON_GROUPS: { title: string; rows: ComparisonRow[] }[] = [
  {
    title: "Experience",
    rows: [{ feature: "Ad-free", values: { free: false, pro: true, agency: true } }],
  },
  {
    title: "Traffic & competitors",
    rows: [
      { feature: "Website traffic checker", values: { free: true, pro: true, agency: true } },
      { feature: "Websites per comparison", values: { free: "8", pro: "25", agency: "25" } },
      { feature: "Tracked websites with weekly trend emails", values: { free: false, pro: "50", agency: "250" } },
    ],
  },
  {
    title: "Site audit",
    rows: [
      { feature: "Pages per audit", values: { free: "200", pro: "No limit", agency: "No limit" } },
      { feature: "Scheduled audits and email alerts", values: { free: false, pro: "Weekly", agency: "Daily" } },
      { feature: "Saved projects and report history", values: { free: false, pro: true, agency: true } },
    ],
  },
  {
    title: "Pages & keywords",
    rows: [
      { feature: "On-page SEO checker", values: { free: true, pro: true, agency: true } },
      { feature: "Broken link checker", values: { free: true, pro: true, agency: true } },
      { feature: "Keyword generator", values: { free: true, pro: true, agency: true } },
      { feature: "Core Web Vitals tests", values: { free: true, pro: true, agency: true } },
    ],
  },
  {
    title: "Reports, API & team",
    rows: [
      { feature: "CSV and JSON exports", values: { free: true, pro: true, agency: true } },
      { feature: "PDF reports", values: { free: false, pro: true, agency: "White-label" } },
      { feature: "REST API", values: { free: "Fair use", pro: "10× limits", agency: "50× limits" } },
      { feature: "Team seats", values: { free: "—", pro: "1", agency: "5" } },
      { feature: "Support", values: { free: "Community", pro: "Email", agency: "Priority email" } },
    ],
  },
];

export function formatPrice(plan: Plan): string {
  return plan.price === 0 ? `${CURRENCY.symbol}0` : `${CURRENCY.symbol}${plan.price}`;
}
