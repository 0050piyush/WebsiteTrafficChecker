import { analyzePage, AnalyzeError, type PageReport } from "./seo/analyze";
import { collectSitemapUrls } from "./seo/sitemap";
import { BOT_TOKEN, fetchUrl } from "./net/fetcher";
import { getTrancoRanks, type TrancoResult } from "./sources/tranco";
import { getRdap, type RdapInfo } from "./sources/rdap";
import { getDnsInfo, type DnsInfo } from "./sources/dns";
import { getWaybackInfo, type WaybackInfo } from "./sources/wayback";
import { getOpenPageRank, isOpenPageRankEnabled, type AuthorityScore } from "./sources/openpagerank";
import { estimateMonthlyVisits, popularityTier, type VisitEstimate } from "./traffic-model";
import { parseRobots, groupFor } from "./seo/robots";

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
    disallowAll: boolean;
    rulesForAll: number;
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
    disallowAll: false,
    rulesForAll: 0,
    crawlDelay: null,
    sitemaps: [],
    invalidLines: 0,
  };
  try {
    const res = await fetchUrl(`${origin}/robots.txt`, { timeoutMs: 8000, maxBytes: 512 * 1024, signal });
    if (res.status === 200 && !/text\/html/i.test(res.headers["content-type"] ?? "")) {
      const robots = parseRobots(res.body.toString("utf8"));
      const generic = groupFor(robots, BOT_TOKEN);
      robotsInfo = {
        url: res.finalUrl,
        found: true,
        disallowAll: generic.rules.some((r) => r.type === "disallow" && r.path === "/") && !generic.rules.some((r) => r.type === "allow" && r.path === "/"),
        rulesForAll: generic.rules.length,
        crawlDelay: generic.crawlDelay,
        sitemaps: robots.sitemaps,
        invalidLines: robots.invalidLines.length,
      };
    }
  } catch {
    /* robots.txt unreachable: treated as absent */
  }

  const roots = robotsInfo.sitemaps.length ? robotsInfo.sitemaps.slice(0, 5) : [`${origin}/sitemap.xml`];
  const collection = await collectSitemapUrls(
    roots,
    async (url) => {
      const r = await fetchUrl(url, { timeoutMs: 12_000, maxBytes: 30 * 1024 * 1024, signal });
      return { status: r.status, body: r.body };
    },
    { maxSitemaps: 8, maxUrls: 100_000 },
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
  const timed = async <K extends SectionName>(section: K, fn: () => Promise<SectionMap[K]>) => {
    const start = Date.now();
    try {
      const data = await fn();
      emit({ section, status: "ok", data, ms: Date.now() - start } as SectionEvent);
      return data;
    } catch (err) {
      emit({ section, status: "error", error: (err as Error).message || "Failed", ms: Date.now() - start } as SectionEvent);
      return null;
    }
  };

  await Promise.all([
    want("traffic") && timed("traffic", async () => buildTrafficSection(await getTrancoRanks(target.domain))),
    (want("homepage") || want("crawlability")) &&
      (async () => {
        const report = await timed("homepage", async () => trimReport(await homepageReport(target.hostname, signal)));
        if (report) await timed("crawlability", () => crawlability(report, signal));
        else emit({ section: "crawlability", status: "error", error: "Skipped because the homepage could not be fetched", ms: 0 });
      })(),
    want("registration") && timed("registration", () => getRdap(target.domain)),
    want("dns") && timed("dns", () => getDnsInfo(target.hostname, target.domain)),
    want("history") && timed("history", () => getWaybackInfo(target.domain)),
    want("authority") && timed("authority", async () => ({ enabled: isOpenPageRankEnabled(), value: await getOpenPageRank(target.domain) })),
  ]);
}
