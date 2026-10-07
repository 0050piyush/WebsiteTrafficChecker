import { TtlCache } from "../cache";
import { createThrottle } from "../concurrency";
import { googleAdsTargets, type Market } from "../markets";
import { SourceError } from "./http";

/**
 * Monthly search volumes from Google Ads Keyword Planner (KeywordPlanIdeaService
 * GenerateKeywordHistoricalMetrics). Free with a Google Ads account, but the API needs a
 * developer token with Basic (or Standard) access, plus OAuth credentials. Until all the
 * GOOGLE_ADS_* variables are set, keyword volumes are estimated instead.
 */

const REQUIRED = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"] as const;
const DEFAULT_VERSION = "v25";

export function isGoogleAdsEnabled(): boolean {
  return REQUIRED.every((k) => !!process.env[k]);
}

const digits = (id: string | undefined) => (id ?? "").replace(/\D/g, "");
const norm = (k: string) => k.toLowerCase().replace(/\s+/g, " ").trim();

let token: { value: string; expires: number } | null = null;

async function accessToken(signal?: AbortSignal): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
    }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: string; error_description?: string } | null;
  if (!res.ok || !data?.access_token) throw new SourceError(`Google sign-in failed: ${data?.error_description ?? data?.error ?? `HTTP ${res.status}`}`, res.status);
  token = { value: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return token.value;
}

/** The most useful message out of a Google Ads error response. */
export function googleAdsErrorMessage(body: unknown, status: number): string {
  const err = (body as { error?: { message?: string; details?: { errors?: { message?: string }[] }[] } })?.error;
  const detail = err?.details?.flatMap((d) => d.errors ?? []).find((e) => e.message)?.message;
  return `Google Ads: ${detail ?? err?.message ?? `HTTP ${status}`}`;
}

/** Map each requested keyword to its average monthly searches, including Google's close variants. */
export function parseHistoricalMetrics(body: unknown, keywords: string[]): Map<string, number | null> {
  const results = (body as { results?: { text?: string; closeVariants?: string[]; keywordMetrics?: { avgMonthlySearches?: string | number } }[] })?.results ?? [];
  const byText = new Map<string, number>();
  for (const r of results) {
    // int64 values arrive as strings; no metrics means Google has no searches on record.
    const volume = Number(r.keywordMetrics?.avgMonthlySearches ?? 0);
    for (const text of [r.text, ...(r.closeVariants ?? [])]) if (text) byText.set(norm(text), Number.isFinite(volume) ? volume : 0);
  }
  return new Map(keywords.map((k) => [k, byText.get(norm(k)) ?? null]));
}

const volumes = new TtlCache<number | null>(50_000, 7 * 24 * 60 * 60 * 1000);
// Keyword planning requests are rate limited per account; keep them at least a second apart.
const throttle = createThrottle(1100);
/** After a failure (e.g. a developer token awaiting approval), don't retry on every report. */
let pausedUntil = 0;
let pauseReason = "";

export async function getSearchVolumes(keywords: string[], market: Market, { signal }: { signal?: AbortSignal } = {}): Promise<Map<string, number | null>> {
  const { geoTargetConstant, language } = googleAdsTargets(market);
  const key = (k: string) => `${geoTargetConstant}|${language}|${norm(k)}`;
  const out = new Map<string, number | null>();
  const missing: string[] = [];
  for (const k of new Set(keywords)) {
    const hit = volumes.get(key(k));
    if (hit !== undefined) out.set(k, hit);
    else missing.push(k);
  }
  if (!missing.length) return out;
  if (Date.now() < pausedUntil) throw new SourceError(pauseReason);

  try {
    const data = await throttle(async () => {
      const version = process.env.GOOGLE_ADS_API_VERSION || DEFAULT_VERSION;
      const customerId = digits(process.env.GOOGLE_ADS_CUSTOMER_ID);
      const loginCustomerId = digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
      const res = await fetch(`https://googleads.googleapis.com/${version}/customers/${customerId}:generateKeywordHistoricalMetrics`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${await accessToken(signal)}`,
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
          "content-type": "application/json",
          ...(loginCustomerId ? { "login-customer-id": loginCustomerId } : {}),
        },
        body: JSON.stringify({ keywords: missing, language, geoTargetConstants: [geoTargetConstant], keywordPlanNetwork: "GOOGLE_SEARCH" }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new SourceError(googleAdsErrorMessage(body, res.status), res.status);
      return body;
    });
    for (const [k, v] of parseHistoricalMetrics(data, missing)) {
      volumes.set(key(k), v);
      out.set(k, v);
    }
    return out;
  } catch (err) {
    if (!signal?.aborted) {
      pausedUntil = Date.now() + 10 * 60 * 1000;
      pauseReason = (err as Error).message;
    }
    throw err;
  }
}

/** Test hook: forget the cached token, volumes and any pause. */
export function resetGoogleAdsState(): void {
  token = null;
  pausedUntil = 0;
  pauseReason = "";
  volumes.clear();
}
