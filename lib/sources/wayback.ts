import { TtlCache, memoizeAsync } from "../cache";
import { getJson, SourceError } from "./http";

/**
 * Internet Archive history: when a site was first captured, its latest snapshot, and
 * which years it has been archived in, a good proxy for how long it has been live.
 *
 * The year-by-year list needs the CDX server to scan every capture of the URL, which
 * can take far too long for huge sites (instagram.com has millions of captures). So it
 * is optional: first and latest captures come from fast, indexed lookups, and the year
 * list is included only when it arrives in time.
 */

export interface WaybackInfo {
  firstCapture: string | null;
  /** Most recent snapshot, when known. */
  lastCapture: string | null;
  /** Years since the first capture. */
  ageYears: number | null;
  /** Year the archive was checked, so clients can draw a timeline to "now". */
  checkedYear: number;
  lastYear: number | null;
  /** Years with at least one snapshot; null when that lookup didn't finish in time. */
  years: number[] | null;
  firstSnapshotUrl: string | null;
}

const CDX = "https://web.archive.org/cdx/search/cdx";
const AVAILABLE = "https://archive.org/wayback/available";
const TS_RE = /^\d{8,14}$/;

const FULL_TTL = 24 * 60 * 60 * 1000;
const PARTIAL_TTL = 60 * 60 * 1000;
const cache = new TtlCache<Promise<WaybackInfo>>(2000, FULL_TTL);

function tsToIso(ts: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/.exec(ts);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  return isNaN(+date) ? null : date.toISOString();
}

/** Timestamps from a CDX JSON response (first row is the field-name header), sorted. */
export function parseCdxTimestamps(json: unknown): string[] {
  const rows = Array.isArray(json) ? (json as unknown[][]) : [];
  return rows
    .slice(rows.length && Array.isArray(rows[0]) && rows[0][0] === "timestamp" ? 1 : 0)
    .map((r) => String(r?.[0] ?? ""))
    .filter((t) => TS_RE.test(t))
    .sort();
}

/** Timestamp of the snapshot returned by the Wayback Availability API, if any. */
export function parseAvailability(json: unknown): string | null {
  const closest = (json as { archived_snapshots?: { closest?: { available?: boolean; timestamp?: unknown } } })?.archived_snapshots?.closest;
  if (!closest || closest.available === false) return null;
  const ts = String(closest.timestamp ?? "");
  return TS_RE.test(ts) ? ts : null;
}

export function buildWaybackInfo(
  domain: string,
  { first, latest, yearStamps }: { first: string | null; latest: string | null; yearStamps: string[] | null },
): WaybackInfo {
  const checkedYear = new Date().getUTCFullYear();
  const years = yearStamps ? [...new Set(yearStamps.map((t) => Number(t.slice(0, 4))))].sort((a, b) => a - b) : null;
  // The year scan returns the first capture of each year, so it can fill in the first capture too.
  const firstTs = [first, yearStamps?.[0]].filter((t): t is string => !!t).sort()[0] ?? null;
  const lastTs = latest ?? null;
  const firstCapture = firstTs ? tsToIso(firstTs) : null;
  const lastCapture = lastTs ? tsToIso(lastTs) : null;
  const lastYear = Math.max(years?.[years.length - 1] ?? 0, lastTs ? Number(lastTs.slice(0, 4)) : 0) || null;
  return {
    firstCapture,
    lastCapture,
    ageYears: firstCapture ? Math.round(((Date.now() - Date.parse(firstCapture)) / (365.25 * 86_400_000)) * 10) / 10 : null,
    checkedYear,
    lastYear,
    years: firstCapture ? years : [],
    firstSnapshotUrl: firstTs ? `https://web.archive.org/web/${firstTs}/${domain}` : null,
  };
}

/** Earliest capture: the CDX index is sorted by time, so limit=1 returns it without a scan. */
async function firstCapture(domain: string): Promise<string | null> {
  const q = encodeURIComponent(domain);
  try {
    const { data } = await getJson(`${CDX}?url=${q}&output=json&fl=timestamp&limit=1`, { timeoutMs: 9000 });
    return parseCdxTimestamps(data)[0] ?? null;
  } catch {
    // The snapshot closest to 1990 is the earliest one.
    const { data } = await getJson(`${AVAILABLE}?url=${q}&timestamp=19900101`, { timeoutMs: 9000 });
    return parseAvailability(data);
  }
}

async function latestCapture(domain: string): Promise<string | null> {
  const { data } = await getJson(`${AVAILABLE}?url=${encodeURIComponent(domain)}`, { timeoutMs: 9000 });
  return parseAvailability(data);
}

/** First capture of each archived year. Slow for very large sites, so it has a tight budget. */
async function yearStamps(domain: string): Promise<string[]> {
  const { data } = await getJson(`${CDX}?url=${encodeURIComponent(domain)}&output=json&fl=timestamp&collapse=timestamp:4&limit=100`, { timeoutMs: 12_000 });
  return parseCdxTimestamps(data);
}

export function getWaybackInfo(domain: string): Promise<WaybackInfo> {
  return memoizeAsync(cache, domain, async () => {
    const [first, latest, years] = await Promise.allSettled([firstCapture(domain), latestCapture(domain), yearStamps(domain)]);
    if (first.status === "rejected" && latest.status === "rejected" && years.status === "rejected") {
      throw first.reason instanceof Error ? first.reason : new SourceError("The Internet Archive is unavailable");
    }
    const info = buildWaybackInfo(domain, {
      first: first.status === "fulfilled" ? first.value : null,
      latest: latest.status === "fulfilled" ? latest.value : null,
      yearStamps: years.status === "fulfilled" ? years.value : null,
    });
    // Re-check partial results sooner, so a slow archive day doesn't stick for 24 hours.
    if (first.status === "rejected" || latest.status === "rejected" || years.status === "rejected") {
      cache.set(domain, Promise.resolve(info), PARTIAL_TTL);
    }
    return info;
  });
}
