import { TtlCache, memoizeAsync } from "../cache";
import { getJson } from "./http";

/**
 * The Internet Archive's CDX API tells us when a site was first captured and in
 * which years it has been archived — a good proxy for how long it has been live.
 */

export interface WaybackInfo {
  firstCapture: string | null;
  /** Years since the first capture. */
  ageYears: number | null;
  /** Year the archive was checked, so clients can draw a timeline to "now". */
  checkedYear: number;
  lastYear: number | null;
  years: number[];
  firstSnapshotUrl: string | null;
}

const cache = new TtlCache<Promise<WaybackInfo>>(2000, 24 * 60 * 60 * 1000);

function tsToIso(ts: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/.exec(ts);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  return isNaN(+date) ? null : date.toISOString();
}

export function parseWaybackCdx(domain: string, json: unknown): WaybackInfo {
  const rows = Array.isArray(json) ? (json as unknown[][]) : [];
  // First row is the header (field names).
  const stamps = rows
    .slice(rows.length && Array.isArray(rows[0]) && rows[0][0] === "timestamp" ? 1 : 0)
    .map((r) => String(r?.[0] ?? ""))
    .filter((t) => /^\d{8,14}$/.test(t))
    .sort();
  const checkedYear = new Date().getUTCFullYear();
  if (!stamps.length) return { firstCapture: null, ageYears: null, checkedYear, lastYear: null, years: [], firstSnapshotUrl: null };
  const years = [...new Set(stamps.map((t) => Number(t.slice(0, 4))))].sort((a, b) => a - b);
  const firstCapture = tsToIso(stamps[0]);
  return {
    firstCapture,
    ageYears: firstCapture ? Math.round(((Date.now() - Date.parse(firstCapture)) / (365.25 * 86_400_000)) * 10) / 10 : null,
    checkedYear,
    lastYear: years[years.length - 1],
    years,
    firstSnapshotUrl: `https://web.archive.org/web/${stamps[0]}/${domain}`,
  };
}

export function getWaybackInfo(domain: string): Promise<WaybackInfo> {
  return memoizeAsync(cache, domain, async () => {
    const url = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&output=json&fl=timestamp&collapse=timestamp:4&limit=100`;
    const { data } = await getJson(url, { timeoutMs: 15_000 });
    return parseWaybackCdx(domain, data);
  });
}
