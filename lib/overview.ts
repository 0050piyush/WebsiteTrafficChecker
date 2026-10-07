import { analyzePage, AnalyzeError, type PageReport } from "./seo/analyze";
import { collectSitemapUrls } from "./seo/sitemap";
import { fetchUrl } from "./net/fetcher";
import { getTrancoRanks, type TrancoResult } from "./sources/tranco";
import { getRdap, type RdapInfo } from "./sources/rdap";
import { getDnsInfo, type DnsInfo } from "./sources/dns";
import { getWaybackInfo, type WaybackInfo } from "./sources/wayback";
import { getOpenPageRank, isOpenPageRankEnabled, type AuthorityScore } from "./sources/openpagerank";
import { estimateMonthlyVisits, popularityTier, type VisitEstimate } from "./traffic-model";
import { parseRobots, groupFor, robotsAccess, type RobotsAccess } from "./seo/robots";

export interface TrafficSection {
  tranco: TrancoResult;
  estimate: VisitEstimate | null;
  tier: { label: string; description: string };
  estimatesByDay: { date: string; rank: number; visits: number }[];
}

export type HomepageSection = Omit<PageReport, "links" | "images"> & {
  links: Omit<PageReport["links"], "items">;
  images: Omit<PageReport["images"], "items">;
};

export interface CrawlabilitySection {
  robots: {
    url: string;
    found: boolean;
    /** Whether each kind of bot may crawl the homepage. */
    access: RobotsAccess;
    crawlDelay: number | null;
    sitemaps: string[];
    invalidLines: number;
  };
  sitemap: {
    checked: string[];
    urlCount: number;
    partial: boolean;
    errors: { url: string; error: string }[];
    latestLastmod: string | null;
    sample: string[];
  };
}

export interface SectionMap {
  traffic: TrafficSection;
  homepage: HomepageSection;
  crawlability: CrawlabilitySection;
  registration: RdapInfo | null;
  dns: DnsInfo;
  history: WaybackInfo;
  authority: { enabled: boolean; value: AuthorityScore | null };
}

export type SectionName = keyof SectionMap;

export type SectionEvent = {
  [K in SectionName]: { section: K; status: "ok"; data: SectionMap[K]; ms: number } | { section: K; status: "error"; error: string; ms: number };
}[SectionName];

export const SECTION_NAMES: SectionName[] = ["traffic", "homepage", "crawlability", "registration", "dns", "history", "authority"];

export function buildTrafficSection(tranco: TrancoResult): TrafficSection {
  const rank = tranco.latest?.rank ?? null;
  return {
    tranco,
    estimate: rank ? estimateMonthlyVisits(rank) : null,
    tier: popularityTier(rank),
    estimatesByDay: tranco.ranks.map((r) => ({ date: r.date, rank: r.rank, visits: Math.round(estimateMonthlyVisits(r.rank)?.mid ?? 0) })),
  };
}

async function homepageReport(hostname: string, signal?: AbortSignal): Promise<PageReport> {
  try {
    return await analyzePage(`https://${hostname}/`, { signal });
  } catch (err) {
    // Some sites still only speak plain HTTP.
    const code = (err as AnalyzeError).code;
    if (code && !["BLOCKED_URL", "ABORTED", "NOT_HTML"].includes(code)) {
      try {
        return await analyzePage(`http://${hostname}/`, { signal });
      } catch {
        /* report the original HTTPS error */
      }
    }
    throw err;
  }
}

async function crawlability(report: Pick<PageReport, "finalUrl" | "robotsTxt">, signal?: AbortSignal): Promise<CrawlabilitySection> {
  const origin = new URL(report.finalUrl).origin;
  let robotsInfo: CrawlabilitySection["robots"] = {
    url: report.robotsTxt.url,
    found: false,
    access: { googlebot: true, bingbot: true, otherBots: true },
    crawlDelay: null,
    sitemaps: [],
    invalidLines: 0,
  };
  try {
    const res = await fetchUrl(`${origin}/robots.txt`, { timeoutMs: 8000, maxBytes: 512 * 1024, signal });
    if (res.status === 200 && !/text\/html/i.test(res.headers["content-type"] ?? "")) {
      const robots = parseRobots(res.body.toString("utf8"));
      robotsInfo = {
        url: res.finalUrl,
        found: true,
        access: robotsAccess(robots, report.finalUrl),
        // Google ignores crawl-delay; Bing honors it, so report Bing's value.
        crawlDelay: groupFor(robots, "Bingbot").crawlDelay,
        sitemaps: robots.sitemaps,
        invalidLines: robots.invalidLines.length,
      };
    }
  } catch {
    /* robots.txt unreachable: treated as absent */
  }

  // Big sites have dozens of large sitemaps; read a few in parallel within a time budget
  // and report the count as a lower bound ("+") rather than holding up the report.
  const roots = robotsInfo.sitemaps.length ? robotsInfo.sitemaps.slice(0, 5) : [`${origin}/sitemap.xml`];
  const deadline = Date.now() + 10_000;
  const collection = await collectSitemapUrls(
    roots,
    async (url) => {
      // No single fetch may run past the overall budget.
      const r = await fetchUrl(url, { timeoutMs: Math.max(1000, Math.min(8000, deadline - Date.now())), maxBytes: 15 * 1024 * 1024, signal });
      return { status: r.status, body: r.body };
    },
    { maxSitemaps: 8, maxUrls: 100_000, concurrency: 4, deadline },
  );
  const lastmods = collection.urls.map((u) => u.lastmod).filter((d): d is string => !!d && !isNaN(Date.parse(d)));
  lastmods.sort((a, b) => Date.parse(b) - Date.parse(a));
  return {
    robots: robotsInfo,
    sitemap: {
      checked: collection.sitemapsFetched,
      urlCount: collection.urls.length,
      partial: collection.partial,
      errors: collection.errors.slice(0, 5),
      latestLastmod: lastmods[0] ?? null,
      sample: collection.urls.slice(0, 10).map((u) => u.loc),
    },
  };
}

function trimReport(report: PageReport): HomepageSection {
  const { links, images, ...rest } = report;
  const { items: _l, ...linkStats } = links;
  const { items: _i, ...imageStats } = images;
  void _l;
  void _i;
  return { ...rest, links: linkStats, images: imageStats };
}

/** Parse a "sections=a,b" list; unknown names are ignored, empty means all sections. */
export function parseSections(raw: string | null): SectionName[] | undefined {
  const list = (raw ?? "").split(",").filter((s): s is SectionName => SECTION_NAMES.includes(s as SectionName));
  return list.length ? list : undefined;
}

/**
 * Run the overview sources concurrently, reporting each section as soon as it is ready.
 * `only` limits the run to some sections (used to retry one that failed); crawlability
 * depends on the homepage fetch, so asking for either runs both.
 */
export async function runOverview(
  target: { hostname: string; domain: string },
  emit: (event: SectionEvent) => void,
  signal?: AbortSignal,
  only?: SectionName[],
): Promise<void> {
  const want = (s: SectionName) => !only || only.includes(s);
  /**
   * Run one section with a hard time budget, so a slow source can never hold the whole
   * report (or outlive the serverless function). Work still in flight is aborted.
   */
  const timed = async <K extends SectionName>(section: K, budgetMs: number, fn: (signal: AbortSignal) => Promise<SectionMap[K]>) => {
    const start = Date.now();
    const ctrl = new AbortController();
    const onOuterAbort = () => ctrl.abort();
    signal?.addEventListener("abort", onOuterAbort, { once: true });
    const timer = setTimeout(() => ctrl.abort(), budgetMs);
    const stopped = new Promise<never>((_, reject) =>
      ctrl.signal.addEventListener("abort", () => reject(new Error(signal?.aborted ? "Cancelled" : `The data source didn't respond within ${Math.round(budgetMs / 1000)} seconds`)), {
        once: true,
      }),
    );
    stopped.catch(() => undefined);
    try {
      const data = await Promise.race([fn(ctrl.signal), stopped]);
      emit({ section, status: "ok", data, ms: Date.now() - start } as SectionEvent);
      return data;
    } catch (err) {
      emit({ section, status: "error", error: (err as Error).message || "Failed", ms: Date.now() - start } as SectionEvent);
      return null;
    } finally {
      clearTimeout(timer);
      ctrl.abort();
      signal?.removeEventListener("abort", onOuterAbort);
    }
  };

  // Budgets keep the longest chain (homepage, then crawlability) under the 60s route limit.
  await Promise.all([
    want("traffic") && timed("traffic", 20_000, async () => buildTrafficSection(await getTrancoRanks(target.domain))),
    (want("homepage") || want("crawlability")) &&
      (async () => {
        const report = await timed("homepage", 30_000, async (s) => trimReport(await homepageReport(target.hostname, s)));
        if (report) await timed("crawlability", 20_000, (s) => crawlability(report, s));
        else emit({ section: "crawlability", status: "error", error: "Skipped because the homepage could not be fetched", ms: 0 });
      })(),
    want("registration") && timed("registration", 20_000, () => getRdap(target.domain)),
    want("dns") && timed("dns", 15_000, () => getDnsInfo(target.hostname, target.domain)),
    want("history") && timed("history", 20_000, () => getWaybackInfo(target.domain)),
    want("authority") && timed("authority", 15_000, async () => ({ enabled: isOpenPageRankEnabled(), value: await getOpenPageRank(target.domain) })),
  ]);
}
