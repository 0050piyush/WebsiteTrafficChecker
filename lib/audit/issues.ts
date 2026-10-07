import { SERP_TITLE_MAX_PX } from "../seo/text";
import type { AuditIssue, AuditIssueUrl, CrawledPage, LinkCheckResult, Severity } from "./types";

interface IssueDef {
  severity: Severity;
  title: string;
  description: string;
  fix: string;
}

/** Every issue the audit can report. Kept in one place so the UI and docs stay in sync. */
export const ISSUE_DEFS: Record<string, IssueDef> = {
  "site-not-https": { severity: "error", title: "Site is not served over HTTPS", description: "The site's start page loads over plain HTTP.", fix: "Install a TLS certificate and redirect all HTTP URLs to HTTPS." },
  "http-not-redirected": { severity: "warning", title: "HTTP version doesn't redirect to HTTPS", description: "http:// URLs load without redirecting, creating duplicate, insecure copies of the site.", fix: "Add a site-wide 301 redirect from HTTP to HTTPS." },
  "host-duplicate": { severity: "warning", title: "www and non-www both serve content", description: "Both host variants respond with 200 instead of one redirecting to the other, splitting signals between two copies of the site.", fix: "301-redirect one host variant to the other." },
  "page-4xx": { severity: "error", title: "4XX page", description: "Internal URLs return a client error (e.g. 404 Not Found). Users and crawlers hit a dead end.", fix: "Restore the page, 301-redirect it to a relevant URL, or remove links to it." },
  "page-5xx": { severity: "error", title: "5XX page", description: "Internal URLs return a server error. Persistent 5XX errors cause pages to drop out of the index.", fix: "Check server logs and fix the underlying error." },
  "page-failed": { severity: "error", title: "Page failed to load", description: "The request timed out or the connection failed.", fix: "Check server availability, DNS and TLS configuration for these URLs." },
  "broken-internal-links": { severity: "error", title: "Page has broken internal links", description: "These pages link to internal URLs that return 4XX/5XX or fail to load.", fix: "Update or remove the broken links." },
  "broken-images": { severity: "error", title: "Page has broken images", description: "Images on these pages fail to load.", fix: "Fix the image URLs or upload the missing files." },
  "redirect-loop": { severity: "error", title: "Redirect loop", description: "These URLs redirect in a circle and never resolve to a page.", fix: "Fix the redirect rules so each URL ends at a 200 page." },
  "missing-title": { severity: "error", title: "Title tag missing or empty", description: "Search engines will generate a title themselves, often poorly.", fix: "Add a unique, descriptive <title> to each page." },
  "duplicate-title": { severity: "error", title: "Duplicate titles", description: "Several indexable pages share the same title, making it hard for search engines to tell them apart.", fix: "Write a unique title for every page." },
  "mixed-content": { severity: "error", title: "HTTPS page loads HTTP resources", description: "Mixed content is blocked or flagged by browsers and undermines HTTPS.", fix: "Load every resource over HTTPS." },
  "canonical-to-broken": { severity: "error", title: "Canonical points to a broken URL", description: "The canonical URL returns 4XX/5XX, so the canonical hint is ignored.", fix: "Point the canonical tag at a live, indexable URL." },
  "missing-description": { severity: "warning", title: "Meta description missing", description: "Search engines will build a snippet from page text, which is often less compelling.", fix: "Write a unique 120–160 character description." },
  "duplicate-description": { severity: "warning", title: "Duplicate meta descriptions", description: "Several pages share the same meta description.", fix: "Write a unique description for each page." },
  "title-too-long": { severity: "warning", title: "Title too long", description: `Titles wider than ~${SERP_TITLE_MAX_PX}px are truncated in search results.`, fix: "Shorten titles and front-load the important words." },
  "title-too-short": { severity: "notice", title: "Title too short", description: "Titles under 30 characters may miss relevant context.", fix: "Expand titles to describe the page more fully." },
  "description-too-long": { severity: "notice", title: "Meta description too long", description: "Descriptions longer than ~160 characters are truncated.", fix: "Keep descriptions under ~155 characters." },
  "description-too-short": { severity: "notice", title: "Meta description too short", description: "Descriptions under 70 characters waste snippet space.", fix: "Aim for 120–160 characters." },
  "missing-h1": { severity: "warning", title: "H1 missing", description: "The page has no H1 heading.", fix: "Add one H1 that summarizes the page." },
  "multiple-h1": { severity: "notice", title: "Multiple H1 tags", description: "More than one H1 dilutes the main topic.", fix: "Keep one H1 and demote the others." },
  "missing-alt": { severity: "warning", title: "Images missing alt text", description: "Search engines and screen readers can't understand these images.", fix: "Add descriptive alt attributes." },
  "slow-page": { severity: "warning", title: "Slow server response", description: "Time to first byte is over 1 second (measured from our crawler).", fix: "Add caching or a CDN, and optimize server-side work." },
  "large-page": { severity: "warning", title: "HTML page is too large", description: "The HTML is over 1 MB, which slows parsing and wastes crawl budget.", fix: "Reduce inline scripts/data and trim markup." },
  "low-word-count": { severity: "warning", title: "Low word count", description: "Indexable pages with under 200 words of text may be seen as thin content.", fix: "Add useful content or noindex/merge thin pages." },
  "duplicate-content": { severity: "warning", title: "Duplicate content", description: "These pages have identical main content.", fix: "Consolidate them, or set a canonical to the preferred version." },
  "redirect-chain": { severity: "warning", title: "Redirect chain", description: "A redirect leads to another redirect. Each hop adds latency and loses crawl efficiency.", fix: "Redirect straight to the final URL." },
  "broken-external-links": { severity: "warning", title: "Page has broken external links", description: "These pages link out to URLs that return 404/410/5XX or don't resolve.", fix: "Update or remove the broken outbound links." },
  "missing-viewport": { severity: "warning", title: "Viewport meta tag missing", description: "Pages render as zoomed-out desktop layouts on phones.", fix: '<meta name="viewport" content="width=device-width, initial-scale=1">' },
  "orphan-page": { severity: "warning", title: "Orphan page (in sitemap, no internal links)", description: "These sitemap URLs aren't linked from any crawled page, so users and crawlers can barely find them.", fix: "Link to them from relevant pages, or remove them from the sitemap." },
  "sitemap-non-200": { severity: "warning", title: "Sitemap contains non-200 URLs", description: "Sitemaps should only list live, canonical URLs.", fix: "Remove redirects and broken URLs from the sitemap." },
  "noindex-in-sitemap": { severity: "warning", title: "Noindex page in sitemap", description: "The sitemap asks for indexing while the page asks not to be indexed.", fix: "Remove noindex pages from the sitemap (or drop the noindex)." },
  "http-internal-links": { severity: "warning", title: "Links to HTTP pages from HTTPS", description: "Internal links point at http:// URLs on an HTTPS site.", fix: "Update internal links to HTTPS." },
  "missing-canonical": { severity: "notice", title: "Canonical tag missing", description: "Without a canonical, search engines guess the preferred version of duplicate URLs.", fix: "Add a self-referencing canonical tag." },
  "non-canonical": { severity: "notice", title: "Non-canonical page", description: "The page's canonical points to another URL, so it won't be indexed itself.", fix: "Verify this is intended; link internally to the canonical URL instead." },
  "noindex-page": { severity: "notice", title: "Noindex page", description: "These pages are excluded from search results by a noindex directive.", fix: "Verify these pages are meant to be hidden from search." },
  "links-to-redirect": { severity: "notice", title: "Page links to redirects", description: "Internal links point at URLs that redirect.", fix: "Link directly to the final URL." },
  "deep-page": { severity: "notice", title: "Page is more than 3 clicks deep", description: "Deep pages get crawled less often and receive less internal link equity.", fix: "Link to important pages from higher-level pages." },
  "single-inlink": { severity: "notice", title: "Page has only one internal link to it", description: "Pages with very few internal links are weakly connected to the site.", fix: "Add contextual links from related pages." },
  "nofollow-internal": { severity: "notice", title: "Nofollow internal links", description: "Internal links with rel=nofollow stop link equity flowing through the site.", fix: "Remove nofollow from internal links." },
  "dead-end": { severity: "notice", title: "No outgoing internal links", description: "The page doesn't link anywhere else on the site.", fix: "Add links to related pages." },
  "missing-lang": { severity: "notice", title: "Missing language attribute", description: "The <html> element has no lang attribute.", fix: 'Add lang (e.g. <html lang="en">).' },
  "missing-og": { severity: "notice", title: "Open Graph tags incomplete", description: "Shared links get a poor preview on social and chat apps.", fix: "Add og:title, og:description and og:image." },
  "no-structured-data": { severity: "notice", title: "No structured data", description: "No Schema.org markup was found.", fix: "Add JSON-LD for the page type to qualify for rich results." },
  "uncompressed": { severity: "notice", title: "HTML not compressed", description: "Pages are served without gzip or Brotli compression.", fix: "Enable compression on the server or CDN." },
  "blocked-by-robots": { severity: "notice", title: "Blocked by robots.txt", description: "Internal URLs that robots.txt prevents crawlers from fetching.", fix: "Make sure nothing important is disallowed." },
  "no-robots": { severity: "notice", title: "robots.txt not found", description: "No robots.txt file was found at the site root.", fix: "Add a robots.txt (it can simply reference your sitemap)." },
  "no-sitemap": { severity: "notice", title: "XML sitemap not found", description: "No sitemap was declared in robots.txt or found at /sitemap.xml.", fix: "Generate an XML sitemap and reference it in robots.txt." },
};

export interface IssueContext {
  pages: CrawledPage[];
  /** internal target URL -> pages linking to it */
  inlinks: Map<string, Set<string>>;
  images: Map<string, Set<string>>;
  resourceResults: Map<string, LinkCheckResult>;
  externalResults: LinkCheckResult[];
  sitemapUrls: Set<string>;
  blocked: Set<string>;
  limitReached: boolean;
  site: {
    finalUrl: string;
    robotsFound: boolean;
    sitemapFound: boolean;
    httpsRedirect: "redirects" | "no-redirect" | "unreachable" | "n/a";
    hostCanonicalization: "redirects" | "duplicate" | "unreachable" | "n/a";
    alternateHostUrl: string | null;
    httpUrl: string | null;
  };
}

const MAX_URLS_PER_ISSUE = 500;
const isBrokenStatus = (s: number) => s === 0 || (s >= 400 && s < 600);
const isBrokenExternal = (r: LinkCheckResult) =>
  r.status === 404 || r.status === 410 || (r.status >= 500 && r.status !== 503) || (r.status === 0 && ["ENOTFOUND", "ECONNREFUSED", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID", "DEPTH_ZERO_SELF_SIGNED_CERT"].includes(r.code ?? ""));

export function computeIssues(ctx: IssueContext): AuditIssue[] {
  const found = new Map<string, AuditIssueUrl[]>();
  const flag = (id: string, url: string, detail?: string) => {
    const list = found.get(id) ?? [];
    list.push({ url, detail });
    found.set(id, list);
  };
  const byUrl = new Map(ctx.pages.map((p) => [p.url, p]));
  const isHttpsSite = ctx.site.finalUrl.startsWith("https:");

  // Site-level
  if (!isHttpsSite) flag("site-not-https", ctx.site.finalUrl);
  if (ctx.site.httpsRedirect === "no-redirect" && ctx.site.httpUrl) flag("http-not-redirected", ctx.site.httpUrl, "Returns 200 over HTTP");
  if (ctx.site.hostCanonicalization === "duplicate" && ctx.site.alternateHostUrl) flag("host-duplicate", ctx.site.alternateHostUrl, `Also serves content; should redirect to ${new URL(ctx.site.finalUrl).host}`);
  if (!ctx.site.robotsFound) flag("no-robots", new URL("/robots.txt", ctx.site.finalUrl).href);
  if (!ctx.site.sitemapFound) flag("no-sitemap", new URL("/sitemap.xml", ctx.site.finalUrl).href);

  for (const url of ctx.blocked) flag("blocked-by-robots", url);

  // Status-based
  for (const p of ctx.pages) {
    if (p.status === -1) continue;
    if (p.status === 0) flag("page-failed", p.url, p.error);
    else if (p.status >= 400 && p.status < 500) flag("page-4xx", p.url, `HTTP ${p.status} · linked from ${ctx.inlinks.get(p.url)?.size ?? 0} page(s)`);
    else if (p.status >= 500) flag("page-5xx", p.url, `HTTP ${p.status}`);
    else if (p.status >= 300 && p.status < 400 && p.redirectTo) {
      // Follow the chain through crawled pages.
      const chain = [p.url];
      let next: string | undefined = p.redirectTo;
      let loop = false;
      while (next && chain.length < 12) {
        if (chain.includes(next)) {
          loop = true;
          break;
        }
        chain.push(next);
        const np = byUrl.get(next);
        next = np && np.status >= 300 && np.status < 400 ? np.redirectTo : undefined;
      }
      if (loop) flag("redirect-loop", p.url, chain.join(" → "));
      else if (chain.length > 2) flag("redirect-chain", p.url, `${chain.length - 1} hops: ${chain.join(" → ")}`);
    }
    if (p.inSitemap && p.status !== 200 && p.status > 0) flag("sitemap-non-200", p.url, `HTTP ${p.status}`);
  }

  // Broken internal links & links to redirects (attributed to source pages).
  const brokenTargets = new Map<string, string[]>();
  const redirectTargets = new Map<string, string[]>();
  for (const [target, sources] of ctx.inlinks) {
    const tp = byUrl.get(target);
    const status = tp?.status ?? ctx.resourceResults.get(target)?.status;
    if (status === undefined || status === -1) continue;
    if (isBrokenStatus(status)) {
      for (const s of sources) brokenTargets.set(s, [...(brokenTargets.get(s) ?? []), `${target} (${status || "failed"})`]);
    } else if (status >= 300 && status < 400) {
      for (const s of sources) redirectTargets.set(s, [...(redirectTargets.get(s) ?? []), target]);
    }
  }
  for (const [source, targets] of brokenTargets) flag("broken-internal-links", source, `${targets.length} broken: ${targets.slice(0, 3).join(", ")}${targets.length > 3 ? "…" : ""}`);
  for (const [source, targets] of redirectTargets) flag("links-to-redirect", source, `${targets.length} link(s), e.g. ${targets[0]}`);

  const brokenImages = new Map<string, string[]>();
  for (const [img, sources] of ctx.images) {
    const r = ctx.resourceResults.get(img);
    if (r && (r.status === 404 || r.status === 410 || r.status >= 500 || (r.status === 0 && r.code === "ENOTFOUND"))) {
      for (const s of sources) brokenImages.set(s, [...(brokenImages.get(s) ?? []), img]);
    }
  }
  for (const [source, imgs] of brokenImages) flag("broken-images", source, `${imgs.length} broken: ${imgs.slice(0, 2).join(", ")}`);

  const brokenExternal = new Map<string, string[]>();
  for (const r of ctx.externalResults) {
    if (!isBrokenExternal(r)) continue;
    for (const s of r.sources) brokenExternal.set(s, [...(brokenExternal.get(s) ?? []), `${r.url} (${r.status || r.code})`]);
  }
  for (const [source, targets] of brokenExternal) flag("broken-external-links", source, `${targets.length} broken: ${targets.slice(0, 2).join(", ")}`);

  // Content-level checks on HTML 200 pages.
  const html = ctx.pages.filter((p) => p.isHtml && p.status === 200);
  const titleGroups = new Map<string, string[]>();
  const descGroups = new Map<string, string[]>();
  const hashGroups = new Map<string, string[]>();
  for (const p of html) {
    const indexable = !p.noindex && (!p.canonical || p.canonical === p.url);
    if (!p.title) flag("missing-title", p.url);
    else {
      if (indexable) titleGroups.set(p.title, [...(titleGroups.get(p.title) ?? []), p.url]);
      if ((p.titlePx ?? 0) > SERP_TITLE_MAX_PX) flag("title-too-long", p.url, `${p.title.length} chars · ~${p.titlePx}px`);
      else if (p.title.length < 30) flag("title-too-short", p.url, `${p.title.length} chars: “${p.title}”`);
    }
    if (!p.metaDescription) flag("missing-description", p.url);
    else {
      if (indexable) descGroups.set(p.metaDescription, [...(descGroups.get(p.metaDescription) ?? []), p.url]);
      if (p.metaDescription.length > 160) flag("description-too-long", p.url, `${p.metaDescription.length} chars`);
      else if (p.metaDescription.length < 70) flag("description-too-short", p.url, `${p.metaDescription.length} chars`);
    }
    if (!p.h1Count) flag("missing-h1", p.url);
    else if (p.h1Count > 1) flag("multiple-h1", p.url, `${p.h1Count} H1 tags`);
    if (p.imagesMissingAlt) flag("missing-alt", p.url, `${p.imagesMissingAlt} of ${p.images} images`);
    if (p.ttfbMs > 1000) flag("slow-page", p.url, `${p.ttfbMs} ms`);
    if (p.htmlBytes > 1024 * 1024) flag("large-page", p.url, `${(p.htmlBytes / 1024 / 1024).toFixed(1)} MB`);
    if (indexable && (p.wordCount ?? 0) < 200) flag("low-word-count", p.url, `${p.wordCount ?? 0} words`);
    if (indexable && p.contentHash && (p.wordCount ?? 0) >= 50) hashGroups.set(p.contentHash, [...(hashGroups.get(p.contentHash) ?? []), p.url]);
    if (!p.viewport) flag("missing-viewport", p.url);
    if (p.mixedContent) flag("mixed-content", p.url, `${p.mixedContent} insecure resource(s)`);
    if (p.httpInternalLinks && isHttpsSite) flag("http-internal-links", p.url, `${p.httpInternalLinks} link(s)`);
    if (!p.canonical) flag("missing-canonical", p.url);
    else if (p.canonical !== p.url) {
      flag("non-canonical", p.url, `→ ${p.canonical}`);
      const cp = byUrl.get(p.canonical);
      if (cp && isBrokenStatus(cp.status) && cp.status !== -1) flag("canonical-to-broken", p.url, `${p.canonical} (${cp.status || "failed"})`);
    }
    if (p.noindex) {
      flag("noindex-page", p.url);
      if (p.inSitemap) flag("noindex-in-sitemap", p.url);
    }
    if (p.depth > 3) flag("deep-page", p.url, `${p.depth} clicks`);
    if (p.nofollowInternal) flag("nofollow-internal", p.url, `${p.nofollowInternal} link(s)`);
    if (p.internalLinks === 0) flag("dead-end", p.url);
    if (!p.lang) flag("missing-lang", p.url);
    if (!p.openGraph) flag("missing-og", p.url);
    if (!p.structuredData) flag("no-structured-data", p.url);
    if (!p.compressed && p.htmlBytes > 1024) flag("uncompressed", p.url);
    if (indexable && p.depth > 0 && p.inlinks === 1) flag("single-inlink", p.url);
    if (!ctx.limitReached && p.inSitemap && p.depth !== 0 && p.inlinks === 0) flag("orphan-page", p.url);
  }
  for (const [title, urls] of titleGroups) if (urls.length > 1) for (const u of urls) flag("duplicate-title", u, `“${title.slice(0, 70)}” used on ${urls.length} pages`);
  for (const [, urls] of descGroups) if (urls.length > 1) for (const u of urls) flag("duplicate-description", u, `Shared by ${urls.length} pages`);
  for (const [, urls] of hashGroups) if (urls.length > 1) for (const u of urls) flag("duplicate-content", u, `Same content as ${urls.length - 1} other page(s)`);

  // Attach issue ids to pages for the per-page view.
  for (const [id, list] of found) for (const { url } of list) byUrl.get(url)?.issues.push(id);

  const order: Record<Severity, number> = { error: 0, warning: 1, notice: 2 };
  return [...found.entries()]
    .map(([id, urls]) => {
      const def = ISSUE_DEFS[id];
      return { id, severity: def.severity, title: def.title, description: def.description, fix: def.fix, count: urls.length, urls: urls.slice(0, MAX_URLS_PER_ISSUE) };
    })
    .sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);
}

/** Share of crawled internal URLs that have no error-severity issue. */
export function healthScore(pages: CrawledPage[]): number {
  const relevant = pages.filter((p) => p.status !== -1);
  if (!relevant.length) return 0;
  const clean = relevant.filter((p) => !p.issues.some((id) => ISSUE_DEFS[id]?.severity === "error")).length;
  return Math.round((clean / relevant.length) * 100);
}
