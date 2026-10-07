export type Severity = "error" | "warning" | "notice";

export interface AuditOptions {
  /** Most pages to crawl; null = no page limit (paid plans). */
  maxPages: number | null;
  /**
   * Time budget for the whole audit in ms. The crawl stops early enough to check links and
   * build the report inside it. Unset = no time limit.
   */
  timeLimitMs?: number;
  concurrency: number;
  respectRobots: boolean;
  checkExternal: boolean;
  checkResources: boolean;
  useSitemap: boolean;
}

export interface CrawledPage {
  url: string;
  /** 0 = request failed, -1 = not fetched (blocked by robots.txt). */
  status: number;
  error?: string;
  redirectTo?: string;
  contentType?: string;
  depth: number;
  ttfbMs: number;
  htmlBytes: number;
  compressed: boolean;
  isHtml: boolean;
  inSitemap: boolean;
  title?: string | null;
  titlePx?: number;
  metaDescription?: string | null;
  h1Count?: number;
  h1?: string | null;
  wordCount?: number;
  canonical?: string | null;
  noindex?: boolean;
  lang?: string | null;
  viewport?: boolean;
  openGraph?: boolean;
  structuredData?: boolean;
  images?: number;
  imagesMissingAlt?: number;
  internalLinks?: number;
  externalLinks?: number;
  nofollowInternal?: number;
  httpInternalLinks?: number;
  mixedContent?: number;
  contentHash?: string;
  /** Filled in after the crawl. */
  inlinks: number;
  issues: string[];
}

export interface AuditIssueUrl {
  url: string;
  detail?: string;
}

export interface AuditIssue {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  fix: string;
  count: number;
  urls: AuditIssueUrl[];
}

export interface LinkCheckResult {
  url: string;
  status: number;
  error?: string;
  code?: string;
  sources: string[];
}

export interface AuditReport {
  startUrl: string;
  finalUrl: string;
  host: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  options: AuditOptions;
  healthScore: number;
  stats: {
    crawled: number;
    html: number;
    redirects: number;
    clientErrors: number;
    serverErrors: number;
    failed: number;
    blocked: number;
    nonHtml: number;
    avgTtfbMs: number;
    totalHtmlBytes: number;
    externalChecked: number;
    resourcesChecked: number;
    sitemapUrls: number;
    /** The crawl stopped at a page or time limit with pages left to crawl. */
    limitReached: boolean;
    stopReason: "page-limit" | "time-limit" | null;
    discoveredNotCrawled: number;
    cancelled: boolean;
  };
  site: {
    robotsFound: boolean;
    /** robots.txt disallows our crawler (TrafficLensBot) from the start page. */
    blockedForCrawler: boolean;
    crawlDelay: number | null;
    sitemaps: string[];
    httpsRedirect: "redirects" | "no-redirect" | "unreachable" | "n/a";
    hostCanonicalization: "redirects" | "duplicate" | "unreachable" | "n/a";
  };
  issues: AuditIssue[];
  pages: CrawledPage[];
  externalLinks: LinkCheckResult[];
  statusDistribution: Record<string, number>;
  depthDistribution: Record<string, number>;
}

export type AuditEvent =
  | { type: "start"; startUrl: string; finalUrl: string; options: AuditOptions }
  | { type: "info"; message: string }
  | { type: "page"; page: CrawledPage; crawled: number; queued: number }
  | { type: "phase"; phase: "crawling" | "checking-links" | "analyzing"; total?: number }
  | { type: "progress"; done: number; total: number }
  | { type: "done"; report: AuditReport }
  | { type: "error"; message: string };
