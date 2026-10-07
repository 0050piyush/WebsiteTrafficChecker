import { TtlCache, memoizeAsync } from "../cache";
import { dataForSeoLocation, type Market } from "../markets";
import { API_USER_AGENT, SourceError } from "./http";

/**
 * DataForSEO Labs (dataforseo.com) keeps a database of Google results, like Ahrefs and
 * Semrush do, so it knows which keywords a domain ranks for, at what position, with
 * monthly search volume and estimated traffic. It's a paid, pay-as-you-go API: set
 * DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD to turn it on. Results are cached for a day.
 */

export interface RankedKeyword {
  keyword: string;
  /** Position among organic results, 1-based. */
  position: number;
  /** Average monthly searches in the market. */
  volume: number | null;
  /** Estimated monthly visits this keyword sends to the site. */
  traffic: number | null;
  url: string | null;
}

export interface RankedKeywords {
  /** How many keywords the domain ranks for in the top 100. */
  totalKeywords: number | null;
  /** Estimated monthly organic search visits from this market. */
  organicTraffic: number | null;
  keywords: RankedKeyword[];
}

const ENDPOINT = "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live";
const cache = new TtlCache<Promise<RankedKeywords>>(2000, 24 * 60 * 60 * 1000);

export function isDataForSeoEnabled(): boolean {
  return !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseRankedKeywords(json: unknown): RankedKeywords {
  const body = json as { status_code?: number; status_message?: string; tasks?: { status_code?: number; status_message?: string; result?: unknown[] | null }[] };
  if (body?.status_code !== 20000) throw new SourceError(`DataForSEO: ${body?.status_message ?? "unexpected response"}`);
  const task = body.tasks?.[0];
  if (!task || task.status_code !== 20000) throw new SourceError(`DataForSEO: ${task?.status_message ?? "the task failed"}`);
  const result = (task.result?.[0] ?? null) as {
    total_count?: number;
    metrics?: { organic?: { etv?: number; count?: number } };
    items?: {
      keyword_data?: { keyword?: string; keyword_info?: { search_volume?: number } };
      ranked_serp_element?: { serp_item?: { type?: string; rank_group?: number; etv?: number; url?: string } };
    }[];
  } | null;
  if (!result) return { totalKeywords: 0, organicTraffic: 0, keywords: [] };

  const keywords: RankedKeyword[] = [];
  for (const item of result.items ?? []) {
    const keyword = item.keyword_data?.keyword;
    const serp = item.ranked_serp_element?.serp_item;
    const position = num(serp?.rank_group);
    if (!keyword || position === null) continue;
    keywords.push({
      keyword,
      position,
      volume: num(item.keyword_data?.keyword_info?.search_volume),
      traffic: num(serp?.etv) === null ? null : Math.round(serp!.etv!),
      url: typeof serp?.url === "string" ? serp.url : null,
    });
  }
  const etv = num(result.metrics?.organic?.etv);
  return {
    totalKeywords: num(result.metrics?.organic?.count) ?? num(result.total_count),
    organicTraffic: etv === null ? null : Math.round(etv),
    keywords,
  };
}

export function getRankedKeywords(domain: string, market: Market, { limit = 10, signal }: { limit?: number; signal?: AbortSignal } = {}): Promise<RankedKeywords> {
  const { location_code, language_code } = dataForSeoLocation(market);
  return memoizeAsync(cache, `${domain}|${location_code}|${limit}`, async () => {
    const auth = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString("base64");
    const timeout = AbortSignal.timeout(15_000);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Basic ${auth}`, "content-type": "application/json", accept: "application/json", "user-agent": API_USER_AGENT },
      body: JSON.stringify([
        {
          target: domain,
          location_code,
          language_code,
          limit,
          item_types: ["organic"],
          // Like Ahrefs: the keywords that bring the most visits first.
          order_by: ["ranked_serp_element.serp_item.etv,desc"],
        },
      ]),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    }).catch((err: Error) => {
      throw new SourceError(err.name === "TimeoutError" ? "DataForSEO timed out" : `DataForSEO is unreachable (${err.message})`);
    });
    if (res.status === 401) throw new SourceError("DataForSEO rejected the login; check DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD", 401);
    if (res.status === 402) throw new SourceError("The DataForSEO account is out of credit", 402);
    if (!res.ok) throw new SourceError(`DataForSEO returned HTTP ${res.status}`, res.status);
    return parseRankedKeywords(await res.json().catch(() => null));
  });
}
