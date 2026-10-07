"use client";

import { useState } from "react";
import { Gauge, Loader2 } from "lucide-react";
import type { FieldMetric, PageSpeedSummary } from "@/lib/sources/pagespeed";
import { errorMessage } from "@/lib/client/ndjson";
import { fmtMs } from "@/lib/client/format";
import { Button, ErrorNote, ScoreGauge, StatusPill, cx } from "../ui";

function FieldRow({ label, metric, format, thresholds }: { label: string; metric: FieldMetric | null; format: (n: number) => string; thresholds: string }) {
  if (!metric) return null;
  const status = metric.category === "FAST" ? "pass" : metric.category === "AVERAGE" ? "warn" : metric.category === "SLOW" ? "fail" : "unknown";
  const word = metric.category === "FAST" ? "Good" : metric.category === "AVERAGE" ? "Needs improvement" : metric.category === "SLOW" ? "Poor" : "—";
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="text-xs text-ink-3">{thresholds}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className="tabular text-sm font-semibold text-ink">{format(metric.percentile)}</span>
        <StatusPill status={status} label={word} />
      </div>
    </div>
  );
}

export function PageSpeedPanel({ url }: { url: string }) {
  const [strategy, setStrategy] = useState<"mobile" | "desktop">("mobile");
  const [state, setState] = useState<{ loading: boolean; data?: PageSpeedSummary; error?: string }>({ loading: false });

  const run = async (s: "mobile" | "desktop") => {
    setStrategy(s);
    setState({ loading: true });
    try {
      const res = await fetch(`/api/v1/pagespeed?url=${encodeURIComponent(url)}&strategy=${s}`);
      if (!res.ok) throw new Error(await errorMessage(res));
      setState({ loading: false, data: await res.json() });
    } catch (err) {
      setState({ loading: false, error: (err as Error).message });
    }
  };

  const d = state.data;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Device">
          {(["mobile", "desktop"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStrategy(s)}
              className={cx("rounded-md px-3 py-1 text-sm capitalize", strategy === s ? "bg-surface-2 font-medium text-ink" : "text-ink-3 hover:text-ink")}
              aria-pressed={strategy === s}
            >
              {s}
            </button>
          ))}
        </div>
        <Button variant="secondary" onClick={() => run(strategy)} disabled={state.loading} className="h-9">
          {state.loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Gauge className="h-4 w-4" aria-hidden />}
          {state.loading ? "Running Lighthouse… (up to a minute)" : d ? "Re-run test" : "Run Core Web Vitals test"}
        </Button>
      </div>

      {state.error && <ErrorNote className="mt-4" title="PageSpeed test failed" message={state.error} />}

      {d && (
        <div className="mt-5 space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(
              [
                ["Performance", d.scores.performance],
                ["Accessibility", d.scores.accessibility],
                ["Best practices", d.scores.bestPractices],
                ["SEO", d.scores.seo],
              ] as const
            ).map(([label, score]) => (
              <div key={label} className="flex flex-col items-center gap-1">
                {score === null ? <div className="flex h-[88px] items-center text-ink-3">—</div> : <ScoreGauge score={score} size={88} label={label} />}
                <span className="text-xs text-ink-2">{label}</span>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink">Real-user experience (Chrome UX Report, 28 days)</h3>
            {d.field.scope ? (
              <>
                <p className="text-xs text-ink-3">{d.field.scope === "origin" ? "Not enough data for this exact URL; showing the whole origin." : "Data for this URL."}</p>
                <div className="mt-2 divide-y divide-line">
                  <FieldRow label="Largest Contentful Paint" metric={d.field.lcp} format={fmtMs} thresholds="Good ≤ 2.5 s" />
                  <FieldRow label="Interaction to Next Paint" metric={d.field.inp} format={fmtMs} thresholds="Good ≤ 200 ms" />
                  <FieldRow label="Cumulative Layout Shift" metric={d.field.cls} format={(n) => n.toFixed(2)} thresholds="Good ≤ 0.1" />
                  <FieldRow label="First Contentful Paint" metric={d.field.fcp} format={fmtMs} thresholds="Good ≤ 1.8 s" />
                  <FieldRow label="Time to First Byte" metric={d.field.ttfb} format={fmtMs} thresholds="Good ≤ 800 ms" />
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-3">Chrome doesn&apos;t have enough real-user data for this site. Lab results below still apply.</p>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Lab metrics ({d.strategy})</h3>
              <dl className="mt-2 divide-y divide-line text-sm">
                {d.lab.map((m) => (
                  <div key={m.id} className="flex justify-between py-1.5">
                    <dt className="text-ink-2">{m.title}</dt>
                    <dd className="tabular font-medium text-ink">{m.displayValue || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Biggest opportunities</h3>
              {d.opportunities.length ? (
                <ul className="mt-2 divide-y divide-line text-sm">
                  {d.opportunities.map((o) => (
                    <li key={o.id} className="flex justify-between gap-3 py-1.5">
                      <span className="text-ink-2">{o.title}</span>
                      <span className="tabular shrink-0 font-medium text-ink">−{fmtMs(o.savingsMs)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-3">No significant opportunities found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
