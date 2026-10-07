import { TtlCache, memoizeAsync } from "../cache";
import { createThrottle } from "../concurrency";
import { getJson } from "./http";

/**
 * Tranco (https://tranco-list.eu) is a research-grade top-1M ranking that averages
 * several independent popularity lists over 30 days, which makes it hard to
 * manipulate. The free API returns a domain's rank in each recent daily list.
 */

export interface TrancoPoint {
  date: string;
  rank: number;
}

export interface TrancoResult {
  domain: string;
  ranks: TrancoPoint[];
  latest: TrancoPoint | null;
  best: number | null;
  worst: number | null;
  /** Positive = moved up (better) over the window. */
  change: number | null;
}

const API = "https://tranco-list.eu/api/ranks/domain/";
const cache = new TtlCache<Promise<TrancoResult>>(5000, 12 * 60 * 60 * 1000);
// The public API is rate limited; keep a polite pace per server instance.
const throttle = createThrottle(1100);

export function parseTrancoResponse(domain: string, json: unknown): TrancoResult {
  const raw = (json as { ranks?: unknown })?.ranks;
  const ranks: TrancoPoint[] = Array.isArray(raw)
    ? raw
        .map((r) => ({ date: String((r as TrancoPoint).date ?? ""), rank: Number((r as TrancoPoint).rank) }))
        .filter((r) => r.date && Number.isFinite(r.rank) && r.rank > 0)
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  if (!ranks.length) return { domain, ranks, latest: null, best: null, worst: null, change: null };
  const values = ranks.map((r) => r.rank);
  return {
    domain,
    ranks,
    latest: ranks[ranks.length - 1],
    best: Math.min(...values),
    worst: Math.max(...values),
    change: ranks.length > 1 ? ranks[0].rank - ranks[ranks.length - 1].rank : null,
  };
}

export function getTrancoRanks(domain: string): Promise<TrancoResult> {
  return memoizeAsync(cache, domain, () =>
    throttle(async () => {
      const { data } = await getJson(`${API}${encodeURIComponent(domain)}`, { timeoutMs: 12_000 });
      return parseTrancoResponse(domain, data);
    }),
  );
}
