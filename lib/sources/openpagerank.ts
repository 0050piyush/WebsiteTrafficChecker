import { TtlCache, memoizeAsync } from "../cache";
import { getJson } from "./http";

/**
 * Open PageRank (domcop.com/openpagerank) publishes a 0–10 authority score computed
 * from Common Crawl's link graph. Requires a free API key.
 */

export interface AuthorityScore {
  score: number;
  rank: number | null;
}

const cache = new TtlCache<Promise<AuthorityScore | null>>(5000, 24 * 60 * 60 * 1000);

export function isOpenPageRankEnabled(): boolean {
  return !!process.env.OPENPAGERANK_API_KEY;
}

export function parseOpenPageRank(json: unknown): AuthorityScore | null {
  const row = (json as { response?: { status_code?: number; page_rank_decimal?: number | string; rank?: string | number | null }[] })?.response?.[0];
  if (!row || row.status_code !== 200) return null;
  const score = Number(row.page_rank_decimal);
  if (!Number.isFinite(score)) return null;
  const rank = row.rank === null || row.rank === undefined ? null : Number(row.rank);
  return { score: Math.round(score * 100) / 100, rank: Number.isFinite(rank) ? rank : null };
}

export function getOpenPageRank(domain: string): Promise<AuthorityScore | null> {
  const key = process.env.OPENPAGERANK_API_KEY;
  if (!key) return Promise.resolve(null);
  return memoizeAsync(cache, domain, async () => {
    const { data } = await getJson(`https://openpagerank.com/api/v1.0/getPageRank?domains%5B%5D=${encodeURIComponent(domain)}`, {
      timeoutMs: 10_000,
      headers: { "API-OPR": key },
    });
    return parseOpenPageRank(data);
  });
}
