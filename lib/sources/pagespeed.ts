import { TtlCache, memoizeAsync } from "../cache";
import { getJson, SourceError } from "./http";

/**
 * Google PageSpeed Insights: Lighthouse lab scores plus Chrome UX Report field data
 * (real-user Core Web Vitals) when Google has enough traffic data for the URL/origin.
 */

export type FieldCategory = "FAST" | "AVERAGE" | "SLOW" | null;

export interface FieldMetric {
  percentile: number;
  category: FieldCategory;
}

export interface PageSpeedSummary {
  url: string;
  strategy: "mobile" | "desktop";
  scores: { performance: number | null; accessibility: number | null; bestPractices: number | null; seo: number | null };
  lab: { id: string; title: string; displayValue: string; score: number | null }[];
  field: {
    scope: "url" | "origin" | null;
    overall: FieldCategory;
    lcp: FieldMetric | null;
    inp: FieldMetric | null;
    cls: FieldMetric | null;
    fcp: FieldMetric | null;
    ttfb: FieldMetric | null;
  };
  opportunities: { id: string; title: string; displayValue: string; savingsMs: number }[];
  fetchedAt: string;
}

const cache = new TtlCache<Promise<PageSpeedSummary>>(500, 60 * 60 * 1000);

interface LhAudit {
  id: string;
  title: string;
  score: number | null;
  displayValue?: string;
  details?: { type?: string; overallSavingsMs?: number };
}

type CruxMetrics = Record<string, { percentile: number; category: FieldCategory }>;

export function parsePageSpeed(url: string, strategy: "mobile" | "desktop", json: unknown): PageSpeedSummary {
  const j = (json ?? {}) as {
    lighthouseResult?: { categories?: Record<string, { score: number | null }>; audits?: Record<string, LhAudit> };
    loadingExperience?: { metrics?: CruxMetrics; overall_category?: FieldCategory; origin_fallback?: boolean };
    originLoadingExperience?: { metrics?: CruxMetrics; overall_category?: FieldCategory };
  };
  const cats = j.lighthouseResult?.categories ?? {};
  const audits = j.lighthouseResult?.audits ?? {};
  const pct = (v: number | null | undefined) => (typeof v === "number" ? Math.round(v * 100) : null);

  const labIds = ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index", "server-response-time"];
  const lab = labIds
    .map((id) => audits[id])
    .filter((a): a is LhAudit => !!a)
    .map((a) => ({ id: a.id, title: a.title, displayValue: a.displayValue ?? "", score: a.score }));

  const opportunities = Object.values(audits)
    .filter((a) => a?.details?.type === "opportunity" && (a.details.overallSavingsMs ?? 0) > 0 && (a.score ?? 1) < 0.9)
    .sort((a, b) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0))
    .slice(0, 8)
    .map((a) => ({ id: a.id, title: a.title, displayValue: a.displayValue ?? "", savingsMs: Math.round(a.details?.overallSavingsMs ?? 0) }));

  const urlLevel = j.loadingExperience?.metrics && !j.loadingExperience.origin_fallback ? j.loadingExperience : null;
  const exp = urlLevel ?? (j.originLoadingExperience?.metrics ? j.originLoadingExperience : null);
  const m = (key: string): FieldMetric | null => {
    const v = exp?.metrics?.[key];
    return v && typeof v.percentile === "number" ? { percentile: v.percentile, category: v.category ?? null } : null;
  };
  const cls = m("CUMULATIVE_LAYOUT_SHIFT_SCORE");

  return {
    url,
    strategy,
    scores: { performance: pct(cats.performance?.score), accessibility: pct(cats.accessibility?.score), bestPractices: pct(cats["best-practices"]?.score), seo: pct(cats.seo?.score) },
    lab,
    field: {
      scope: urlLevel ? "url" : exp ? "origin" : null,
      overall: exp?.overall_category ?? null,
      lcp: m("LARGEST_CONTENTFUL_PAINT_MS"),
      inp: m("INTERACTION_TO_NEXT_PAINT"),
      // CrUX reports CLS multiplied by 100.
      cls: cls ? { ...cls, percentile: cls.percentile / 100 } : null,
      fcp: m("FIRST_CONTENTFUL_PAINT_MS"),
      ttfb: m("EXPERIMENTAL_TIME_TO_FIRST_BYTE"),
    },
    opportunities,
    fetchedAt: new Date().toISOString(),
  };
}

export function runPageSpeed(url: string, strategy: "mobile" | "desktop"): Promise<PageSpeedSummary> {
  return memoizeAsync(cache, `${strategy}:${url}`, async () => {
    const params = new URLSearchParams({ url, strategy });
    for (const c of ["performance", "accessibility", "best-practices", "seo"]) params.append("category", c);
    const key = process.env.PAGESPEED_API_KEY;
    if (key) params.set("key", key);
    try {
      const { data } = await getJson(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, { timeoutMs: 90_000 });
      return parsePageSpeed(url, strategy, data);
    } catch (err) {
      if (err instanceof SourceError && err.status === 429 && !key) {
        throw new SourceError("Google's shared PageSpeed quota is exhausted. Set PAGESPEED_API_KEY (free) to enable Core Web Vitals.", 429);
      }
      if (err instanceof SourceError && err.status === 400) {
        throw new SourceError("PageSpeed Insights could not load this URL (it must be publicly reachable).", 400);
      }
      throw err;
    }
  });
}
