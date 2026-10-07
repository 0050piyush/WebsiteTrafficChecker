import { BOT_TOKEN, createAgents, decodeBody, fetchUrl, probeUrl, FetchError } from "../net/fetcher";
import { extractPage, robotsDirectives } from "../seo/extract";
import { groupFor, isAllowed, parseRobots, type RobotsTxt } from "../seo/robots";
import { collectSitemapUrls } from "../seo/sitemap";
import { textPixelWidth } from "../seo/text";
import { isSameSite, registrableDomain, stripWww } from "../url";
import { mapLimit, sleep } from "../concurrency";
import { computeIssues, healthScore } from "./issues";
import type { AuditEvent, AuditOptions, AuditReport, CrawledPage, LinkCheckResult } from "./types";

const RESOURCE_EXT = /\.(pdf|zip|gz|rar|7z|tar|jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?|mp4|webm|mov|avi|mp3|wav|ogg|m4a|docx?|xlsx?|pptx?|csv|exe|dmg|apk|msi|iso|css|js|mjs|json|woff2?|ttf|otf|eot)$/i;
const MAX_LINK_CHECKS = 300;
const MAX_PER_EXTERNAL_HOST = 8;

export const DEFAULT_AUDIT_OPTIONS: AuditOptions = {
  maxPages: 100,
  concurrency: 4,
  respectRobots: true,
  checkExternal: true,
  checkResources: true,
  useSitemap: true,
};

function normalize(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    return u.href;
  } catch {
    return url;
  }
}

/**
 * Click depth from the start page. Links add one click; redirects add none, so
 * this is a 0-1 BFS over the crawled link graph. Unreachable pages get no entry.
 */
export function clickDepths(starts: string[], inlinks: Map<string, Set<string>>, pages: CrawledPage[]): Map<string, number> {
  const out = new Map<string, { to: string; w: 0 | 1 }[]>();
  const add = (from: string, to: string, w: 0 | 1) => {
    if (!out.has(from)) out.set(from, []);
    out.get(from)!.push({ to, w });
  };
  for (const [target, sources] of inlinks) for (const s of sources) add(s, target, 1);
  for (const p of pages) if (p.redirectTo) add(p.url, p.redirectTo, 0);
  const dist = new Map<string, number>();
  const deque: string[] = [];
  for (const s of starts) {
    if (!dist.has(s)) {
      dist.set(s, 0);
      deque.push(s);
    }
  }
  while (deque.length) {
    const u = deque.shift()!;
    const d = dist.get(u)!;
    for (const { to, w } of out.get(u) ?? []) {
      const nd = d + w;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        if (w === 0) deque.unshift(to);
        else deque.push(to);
      }
    }
  }
  return dist;
}

/**
 * When to stop starting new work under a time budget: the crawl stops early enough for
 * in-flight pages (20s timeout) and link checks to finish, and link checks stop early
 * enough for the report to be built and sent.
 */
export function auditDeadlines(startMs: number, timeLimitMs: number | undefined): { crawlUntil: number; checkLinksUntil: number } {
  if (!timeLimitMs || !Number.isFinite(timeLimitMs)) return { crawlUntil: Infinity, checkLinksUntil: Infinity };
  return {
    crawlUntil: startMs + timeLimitMs - Math.min(70_000, timeLimitMs / 4),
    checkLinksUntil: startMs + timeLimitMs - Math.min(25_000, timeLimitMs / 10),
  };
}

export async function runAudit(startInput: string, options: AuditOptions, emit: (e: AuditEvent) => void, signal?: AbortSignal): Promise<AuditReport> {
  const startedAt = new Date();
  const agents = createAgents(Math.max(2, options.concurrency));
  const deadlines = auditDeadlines(+startedAt, options.timeLimitMs);
  const maxPages = options.maxPages ?? Infinity;

  // 1. Resolve the start URL to find the site we are actually auditing.
  let finalUrl: string;
  try {
    const first = await fetchUrl(startInput, { timeoutMs: 20_000, maxBytes: 64 * 1024, signal, agents });
    finalUrl = first.finalUrl;
  } catch (err) {
    throw new FetchError(`Could not load ${startInput}: ${(err as Error).message}`, (err as FetchError).code ?? "FETCH_FAILED", startInput);
  }
  const scope = new URL(finalUrl);
  const startUrl = normalize(startInput);
  emit({ type: "start", startUrl, finalUrl, options });

  // 2. robots.txt
  let robots: RobotsTxt | null = null;
  try {
    const r = await fetchUrl(`${scope.origin}/robots.txt`, { timeoutMs: 10_000, maxBytes: 512 * 1024, signal, agents });
    if (r.status === 200 && !/text\/html/i.test(r.headers["content-type"] ?? "")) robots = parseRobots(decodeBody(r.body, r.headers["content-type"]));
  } catch {
    robots = null;
  }
  const crawlDelay = robots ? groupFor(robots, BOT_TOKEN).crawlDelay : null;
  const effectiveDelayMs = options.respectRobots && crawlDelay ? Math.min(crawlDelay, 5) * 1000 : 0;
  const concurrency = effectiveDelayMs ? 1 : Math.min(Math.max(1, options.concurrency), 5);
  if (effectiveDelayMs) emit({ type: "info", message: `robots.txt asks for a ${crawlDelay}s crawl delay; crawling one page at a time.` });
  // Many large sites allow search engines but block every other bot, including ours.
  const blockedForCrawler = options.respectRobots && !!robots && !isAllowed(robots, finalUrl, BOT_TOKEN);
  if (blockedForCrawler) {
    emit({
      type: "info",
      message: "This site's robots.txt doesn't allow TrafficLensBot to crawl it, so the audit can't go past the start page. If this is your site, turn off “Respect robots.txt” and run it again.",
    });
  }

  // 3. Sitemaps
  const sitemapRoots = robots?.sitemaps.length ? robots.sitemaps.slice(0, 5) : [`${scope.origin}/sitemap.xml`];
  let sitemapUrls = new Set<string>();
  let sitemapFound = false;
  if (options.useSitemap) {
    const collected = await collectSitemapUrls(
      sitemapRoots,
      async (url) => {
        const r = await fetchUrl(url, { timeoutMs: 15_000, maxBytes: 30 * 1024 * 1024, signal, agents });
        return { status: r.status, body: r.body };
      },
      { maxSitemaps: 6, maxUrls: 20_000 },
    ).catch(() => null);
    if (collected) {
      sitemapFound = collected.sitemapsFetched.length > 0;
      sitemapUrls = new Set(collected.urls.map((u) => normalize(u.loc)).filter((u) => isSameSite(u, scope)));
      if (sitemapFound) emit({ type: "info", message: `Found ${sitemapUrls.size.toLocaleString("en-US")} URLs in ${collected.sitemapsFetched.length} sitemap(s).` });
    }
  }

  // 4. Host canonicalization checks (HTTP→HTTPS, www↔apex), run alongside the crawl.
  const apex = registrableDomain(scope.hostname);
  const isApexOrWww = !!apex && stripWww(scope.hostname) === apex;
  const altHost = scope.hostname.startsWith("www.") ? stripWww(scope.hostname) : `www.${scope.hostname}`;
  const siteChecks = Promise.all([
    scope.protocol === "https:"
      ? fetchUrl(`http://${scope.host}/`, { maxRedirects: 0, timeoutMs: 8000, maxBytes: 16 * 1024, signal })
          .then((r) =>
            r.status >= 300 && r.status < 400 && (r.headers["location"] ?? "").startsWith("https:")
              ? ("redirects" as const)
              : r.status === 200
                ? ("no-redirect" as const)
                : ("unreachable" as const),
          )
          .catch(() => "unreachable" as const)
      : Promise.resolve("n/a" as const),
    isApexOrWww
      ? fetchUrl(`${scope.protocol}//${altHost}/`, { maxRedirects: 0, timeoutMs: 8000, maxBytes: 16 * 1024, signal })
          .then((r) => (r.status === 200 ? ("duplicate" as const) : r.status >= 300 && r.status < 400 ? ("redirects" as const) : ("unreachable" as const)))
          .catch(() => "unreachable" as const)
      : Promise.resolve("n/a" as const),
  ]);

  // 5. Crawl
  emit({ type: "phase", phase: "crawling" });
  const pages = new Map<string, CrawledPage>();
  const inlinks = new Map<string, Set<string>>();
  const images = new Map<string, Set<string>>();
  const externals = new Map<string, Set<string>>();
  const resources = new Map<string, Set<string>>();
  const blocked = new Set<string>();
  const seen = new Set<string>();
  const queue: { url: string; depth: number }[] = [];
  const sitemapQueue: string[] = [];
  let inFlight = 0;
  let crawledCount = 0;
  let outOfTime = false;

  const enqueue = (url: string, depth: number) => {
    if (seen.has(url)) return;
    seen.add(url);
    queue.push({ url, depth });
  };
  enqueue(startUrl, 0);
  if (normalize(finalUrl) !== startUrl) enqueue(normalize(finalUrl), 0);
  for (const u of sitemapUrls) sitemapQueue.push(u);

  const nextJob = (): { url: string; depth: number } | null => {
    if (queue.length) return queue.shift()!;
    while (sitemapQueue.length) {
      const u = sitemapQueue.shift()!;
      if (!seen.has(u)) {
        seen.add(u);
        // Depth unknown until a link to it is found; mark as discovered via sitemap.
        return { url: u, depth: 99 };
      }
    }
    return null;
  };

  const crawlOne = async ({ url, depth }: { url: string; depth: number }) => {
    const page: CrawledPage = {
      url,
      status: 0,
      depth,
      ttfbMs: 0,
      htmlBytes: 0,
      compressed: false,
      isHtml: false,
      inSitemap: sitemapUrls.has(url),
      inlinks: 0,
      issues: [],
    };
    if (options.respectRobots && robots && !isAllowed(robots, url, BOT_TOKEN)) {
      page.status = -1;
      page.error = "Blocked by robots.txt";
      blocked.add(url);
      pages.set(url, page);
      return;
    }
    try {
      const res = await fetchUrl(url, { maxRedirects: 0, timeoutMs: 20_000, maxBytes: 5 * 1024 * 1024, signal, agents });
      page.status = res.status;
      page.ttfbMs = res.timing.ttfbMs;
      page.contentType = res.headers["content-type"]?.split(";")[0];
      page.compressed = !!res.contentEncoding && res.contentEncoding !== "identity";
      if (res.status >= 300 && res.status < 400 && res.headers["location"]) {
        try {
          page.redirectTo = normalize(new URL(res.headers["location"], url).href);
          if (isSameSite(page.redirectTo, scope)) {
            if (!seen.has(page.redirectTo)) enqueue(page.redirectTo, depth);
          }
        } catch {
          page.error = `Invalid redirect location: ${res.headers["location"]}`;
        }
      } else if (res.status === 200 && /html/i.test(res.headers["content-type"] ?? "text/html")) {
        page.isHtml = true;
        page.htmlBytes = res.body.length;
        const html = decodeBody(res.body, res.headers["content-type"]);
        const ex = extractPage(html, url);
        const directives = robotsDirectives(ex.metaRobots, res.headers["x-robots-tag"]);
        const internalLinks = new Set<string>();
        let nofollowInternal = 0;
        let httpInternal = 0;
        let externalCount = 0;
        for (const link of ex.links) {
          const target = normalize(link.href);
          if (isSameSite(target, scope)) {
            internalLinks.add(target);
            if (link.nofollow) nofollowInternal++;
            if (scope.protocol === "https:" && target.startsWith("http:")) httpInternal++;
            if (!inlinks.has(target)) inlinks.set(target, new Set());
            inlinks.get(target)!.add(url);
            if (RESOURCE_EXT.test(new URL(target).pathname)) {
              if (!resources.has(target)) resources.set(target, new Set());
              resources.get(target)!.add(url);
            } else if (!(directives.nofollow && options.respectRobots) && !link.nofollow) {
              enqueue(target, depth + 1);
            }
          } else {
            externalCount++;
            if (!externals.has(target)) externals.set(target, new Set());
            externals.get(target)!.add(url);
          }
        }
        for (const img of ex.images) {
          if (!isSameSite(img.src, scope)) continue;
          if (!images.has(img.src)) images.set(img.src, new Set());
          images.get(img.src)!.add(url);
        }
        Object.assign(page, {
          title: ex.title,
          titlePx: ex.title ? textPixelWidth(ex.title, 20) : 0,
          metaDescription: ex.metaDescription,
          h1Count: ex.h1.length,
          h1: ex.h1[0] ?? null,
          wordCount: ex.wordCount,
          canonical: ex.canonical ? normalize(ex.canonical) : null,
          noindex: directives.noindex,
          lang: ex.lang,
          viewport: !!ex.viewport,
          openGraph: !!(ex.openGraph["og:title"] && ex.openGraph["og:image"]),
          structuredData: ex.jsonLd.some((j) => j.valid && j.types.length) || ex.microdataTypes.length > 0,
          images: ex.images.length,
          imagesMissingAlt: ex.images.filter((i) => i.alt === null).length,
          internalLinks: internalLinks.size,
          externalLinks: externalCount,
          nofollowInternal,
          httpInternalLinks: httpInternal,
          mixedContent: ex.mixedContent.length,
          contentHash: ex.contentHash,
        } satisfies Partial<CrawledPage>);
      }
    } catch (err) {
      if (err instanceof FetchError) {
        if (err.code === "ABORTED") throw err;
        page.status = 0;
        page.error = err.message;
      } else {
        page.error = `Could not parse the page: ${(err as Error).message}`;
      }
    }
    pages.set(url, page);
  };

  // Worker pool with a shared queue that grows as links are discovered.
  await new Promise<void>((resolve, reject) => {
    let failed = false;
    const pump = () => {
      if (failed) return;
      if (signal?.aborted) {
        if (inFlight === 0) resolve();
        return;
      }
      while (inFlight < concurrency && crawledCount < maxPages) {
        // Always crawl the start page; after that, stop starting pages once time is short.
        if (crawledCount > 0 && Date.now() >= deadlines.crawlUntil) {
          outOfTime = true;
          break;
        }
        const job = nextJob();
        if (!job) break;
        inFlight++;
        crawledCount++;
        (async () => {
          if (effectiveDelayMs) await sleep(effectiveDelayMs, signal).catch(() => undefined);
          await crawlOne(job);
          const page = pages.get(job.url);
          if (page) emit({ type: "page", page, crawled: pages.size, queued: queue.length + sitemapQueue.length });
        })()
          .catch((err) => {
            if ((err as FetchError).code !== "ABORTED") {
              failed = true;
              reject(err);
            }
          })
          .finally(() => {
            inFlight--;
            pump();
          });
      }
      if (inFlight === 0) resolve();
    };
    pump();
  });

  const discoveredNotCrawled = queue.length + sitemapQueue.filter((u) => !seen.has(u)).length;
  const stopReason = discoveredNotCrawled === 0 || signal?.aborted ? null : crawledCount >= maxPages ? "page-limit" : outOfTime ? "time-limit" : null;
  const limitReached = stopReason !== null;
  if (stopReason === "time-limit") {
    emit({ type: "info", message: `Reached the time limit for one audit after ${crawledCount.toLocaleString("en-US")} pages; checking links and building the report.` });
  }

  // 6. Link & resource checks
  const resourceResults = new Map<string, LinkCheckResult>();
  const externalResults: LinkCheckResult[] = [];
  if (!signal?.aborted) {
    const resourceTargets = [
      ...[...resources.keys()],
      ...(options.checkResources ? [...images.keys()] : []),
      // Internal links we discovered but did not crawl because of the page limit are left unchecked.
    ].filter((u) => !pages.has(u));
    const uniqueResources = [...new Set(resourceTargets)].slice(0, MAX_LINK_CHECKS);

    const perHost = new Map<string, number>();
    const externalTargets = options.checkExternal
      ? [...externals.keys()].filter((u) => {
          let host: string;
          try {
            host = new URL(u).hostname;
          } catch {
            return false;
          }
          const n = perHost.get(host) ?? 0;
          if (n >= MAX_PER_EXTERNAL_HOST) return false;
          perHost.set(host, n + 1);
          return true;
        }).slice(0, MAX_LINK_CHECKS)
      : [];

    const total = uniqueResources.length + externalTargets.length;
    if (total) {
      emit({ type: "phase", phase: "checking-links", total });
      let done = 0;
      const tick = () => {
        done++;
        if (done % 10 === 0 || done === total) emit({ type: "progress", done, total });
      };
      await Promise.all([
        mapLimit(
          uniqueResources,
          4,
          async (u) => {
            if (Date.now() >= deadlines.checkLinksUntil) return tick();
            const r = await probeUrl(u, { timeoutMs: 10_000, signal, agents });
            resourceResults.set(u, { url: u, status: r.status, error: r.error, code: r.code, sources: [...(resources.get(u) ?? images.get(u) ?? [])].slice(0, 20) });
            tick();
          },
          signal,
        ),
        mapLimit(
          externalTargets,
          6,
          async (u) => {
            if (Date.now() >= deadlines.checkLinksUntil) return tick();
            const r = await probeUrl(u, { timeoutMs: 10_000, signal });
            externalResults.push({ url: u, status: r.status, error: r.error, code: r.code, sources: [...(externals.get(u) ?? [])].slice(0, 20) });
            tick();
          },
          signal,
        ),
      ]);
    }
  }

  // 7. Analysis
  emit({ type: "phase", phase: "analyzing" });
  const [httpsRedirect, hostCanonicalization] = await siteChecks.catch(() => ["unreachable", "unreachable"] as const);
  const pageList = [...pages.values()];
  for (const p of pageList) {
    const sources = inlinks.get(p.url);
    p.inlinks = sources ? sources.size - (sources.has(p.url) ? 1 : 0) : 0;
  }
  const depths = clickDepths([startUrl, normalize(finalUrl)], inlinks, pageList);
  for (const p of pageList) p.depth = depths.get(p.url) ?? -1;

  const issues = computeIssues({
    pages: pageList,
    inlinks,
    images,
    resourceResults,
    externalResults,
    sitemapUrls,
    blocked,
    // Orphan pages can't be told apart on a partial crawl, whether it hit a limit or was stopped.
    limitReached: limitReached || (!!signal?.aborted && discoveredNotCrawled > 0),
    site: {
      finalUrl,
      robotsFound: !!robots,
      sitemapFound,
      httpsRedirect,
      hostCanonicalization,
      alternateHostUrl: `${scope.protocol}//${altHost}/`,
      httpUrl: scope.protocol === "https:" ? `http://${scope.host}/` : null,
    },
  });

  const statusDistribution: Record<string, number> = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, Failed: 0, Blocked: 0 };
  const depthDistribution: Record<string, number> = {};
  for (const p of pageList) {
    const bucket = p.status === -1 ? "Blocked" : p.status === 0 ? "Failed" : `${Math.floor(p.status / 100)}xx`;
    statusDistribution[bucket] = (statusDistribution[bucket] ?? 0) + 1;
    if (p.isHtml && p.status === 200 && p.depth >= 0) {
      const key = p.depth >= 5 ? "5+" : String(p.depth);
      depthDistribution[key] = (depthDistribution[key] ?? 0) + 1;
    }
  }
  const fetched = pageList.filter((p) => p.status > 0);
  const html = pageList.filter((p) => p.isHtml);

  for (const a of [agents.http, agents.https]) a.destroy();
  const finishedAt = new Date();
  return {
    startUrl,
    finalUrl,
    host: scope.host,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: +finishedAt - +startedAt,
    options: { ...options, concurrency },
    healthScore: healthScore(pageList),
    stats: {
      crawled: pageList.length,
      html: html.length,
      redirects: pageList.filter((p) => p.status >= 300 && p.status < 400).length,
      clientErrors: pageList.filter((p) => p.status >= 400 && p.status < 500).length,
      serverErrors: pageList.filter((p) => p.status >= 500).length,
      failed: pageList.filter((p) => p.status === 0).length,
      blocked: blocked.size,
      nonHtml: pageList.filter((p) => p.status === 200 && !p.isHtml).length,
      avgTtfbMs: fetched.length ? Math.round(fetched.reduce((s, p) => s + p.ttfbMs, 0) / fetched.length) : 0,
      totalHtmlBytes: html.reduce((s, p) => s + p.htmlBytes, 0),
      externalChecked: externalResults.length,
      resourcesChecked: resourceResults.size,
      sitemapUrls: sitemapUrls.size,
      limitReached,
      stopReason,
      discoveredNotCrawled,
      cancelled: !!signal?.aborted,
    },
    site: { robotsFound: !!robots, blockedForCrawler, crawlDelay, sitemaps: robots?.sitemaps ?? (sitemapFound ? sitemapRoots : []), httpsRedirect, hostCanonicalization },
    issues,
    pages: pageList,
    externalLinks: externalResults.sort((a, b) => a.status - b.status),
    statusDistribution,
    depthDistribution,
  };
}
