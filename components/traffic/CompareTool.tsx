"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, GitCompare, Loader2, Plus, X } from "lucide-react";
import type { TrafficSection } from "@/lib/overview";
import { errorMessage } from "@/lib/client/ndjson";
import { download, toCsv } from "@/lib/client/csv";
import { addRecent } from "@/lib/client/recent";
import { displayQuery, siteUrlFor } from "@/lib/client/site";
import { RecentSearches } from "../RecentSearches";
import { fmtCompact, fmtDate, fmtNumber, fmtRank } from "@/lib/client/format";
import { LineChart, Legend } from "../charts/LineChart";
import { Card, CardHeader, Delta, ErrorNote, MethodLink, PageHeader, Skeleton } from "../ui";

type Result = { input: string; domain?: string; ok: true; data: TrafficSection } | { input: string; domain?: string; ok: false; error: string };

const MAX = 8;
const SERIES = Array.from({ length: MAX }, (_, i) => `var(--series-${i + 1})`);

export function CompareTool() {
  const params = useSearchParams();
  const router = useRouter();
  const domainsParam = params.get("domains") ?? "";
  const domains = useMemo(() => domainsParam.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean).slice(0, MAX), [domainsParam]);
  const [inputs, setInputs] = useState<string[]>(domains.length ? [...domains, ""] : ["", ""]);
  const [prevParam, setPrevParam] = useState(domainsParam);
  if (prevParam !== domainsParam) {
    setPrevParam(domainsParam);
    setInputs(domains.length ? [...domains, ...(domains.length < MAX ? [""] : [])] : ["", ""]);
  }
  const key = domains.join(",");
  // Results are tagged with the query they belong to; a mismatch means "loading".
  const [loaded, setLoaded] = useState<{ results: Result[]; error: string | null; key: string }>({ results: [], error: null, key: "" });
  const state = loaded.key === key ? { ...loaded, loading: false } : { results: [] as Result[], error: null, key, loading: !!key };

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    addRecent("compare", key);
    fetch(`/api/v1/traffic?domains=${encodeURIComponent(key)}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorMessage(res));
        const body = (await res.json()) as { results: Result[] };
        setLoaded({ results: body.results, error: null, key });
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setLoaded({ results: [], error: (err as Error).message, key });
      });
    return () => ctrl.abort();
  }, [key]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const list = [...new Set(inputs.map((i) => i.trim()).filter(Boolean))];
    if (list.length) router.push(`/compare?domains=${encodeURIComponent(list.join(","))}`);
  };

  // Colors follow the entity's position in the user's list, so they never repaint.
  const colored = state.results.map((r, i) => ({ ...r, color: SERIES[i] }));
  const ok = colored.filter((r): r is Result & { ok: true; color: string } => r.ok);
  const ranked = ok.filter((r) => r.data.popularity.ranks.length);
  const series = ranked.map((r) => ({ id: r.domain!, label: r.domain!, color: r.color, points: r.data.popularity.ranks.map((p) => ({ x: p.date, y: p.rank })) }));
  const ranks = ranked.flatMap((r) => r.data.popularity.ranks.map((p) => p.rank));
  const useLog = ranks.length > 1 && Math.max(...ranks) / Math.min(...ranks) > 20;

  const exportCsv = () => {
    download(
      "trafficlens-compare.csv",
      toCsv(
        colored.map((r) => ({
          domain: r.domain ?? r.input,
          rank: r.ok ? (r.data.popularity.latest?.rank ?? "") : "",
          rank_change: r.ok ? (r.data.popularity.change ?? "") : "",
          est_monthly_visits: r.ok ? Math.round(r.data.estimate?.mid ?? 0) || "" : "",
          est_low: r.ok ? Math.round(r.data.estimate?.low ?? 0) || "" : "",
          est_high: r.ok ? Math.round(r.data.estimate?.high ?? 0) || "" : "",
          tier: r.ok ? r.data.tier.label : "",
          error: r.ok ? "" : r.error,
        })),
      ),
    );
  };

  return (
    <div>
      <PageHeader
        icon={<GitCompare className="h-7 w-7 text-accent-ink" aria-hidden />}
        title="Compare websites"
        description="Put up to 8 competitors side by side: popularity rank, 30-day movement and estimated visits."
      />
      <form onSubmit={submit} className="card mb-6 p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {inputs.map((v, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 focus-within:border-accent">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES[i] }} aria-hidden />
              <label className="sr-only" htmlFor={`domain-${i}`}>Domain {i + 1}</label>
              <input
                id={`domain-${i}`}
                value={v}
                onChange={(e) => setInputs((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={i === 0 ? "yoursite.com" : "competitor.com"}
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
                autoComplete="off"
                spellCheck={false}
              />
              {siteUrlFor(v) && (
                <a href={siteUrlFor(v)!} target="_blank" rel="noopener noreferrer nofollow" className="text-ink-3 hover:text-accent-ink" title={`Open ${displayQuery(v)} in a new tab`} aria-label={`Open ${displayQuery(v)} in a new tab`}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {inputs.length > 1 && (
                <button type="button" onClick={() => setInputs((list) => list.filter((_, j) => j !== i))} className="text-ink-3 hover:text-ink" aria-label={`Remove domain ${i + 1}`}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={state.loading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60">
            {state.loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Compare
          </button>
          {inputs.length < MAX && (
            <button type="button" onClick={() => setInputs((l) => [...l, ""])} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-ink-2 hover:bg-surface-2">
              <Plus className="h-4 w-4" aria-hidden /> Add site
            </button>
          )}
        </div>
      </form>
      <RecentSearches tool="compare" exclude={key} className="-mt-3 mb-6" />

      {state.error && <ErrorNote message={state.error} />}
      {state.loading && (
        <div className="space-y-4">
          <Skeleton className="h-72 rounded-[14px]" />
          <Skeleton className="h-40 rounded-[14px]" />
        </div>
      )}

      {!state.loading && colored.length > 0 && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Popularity rank over time" subtitle={useLog ? "Log scale; lower is better" : "Lower is better"} source="all sources" />
            <div className="p-5">
              {series.length ? (
                <>
                  <div className="mb-3">
                    <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
                  </div>
                  <LineChart
                    series={series}
                    invertY
                    integer
                    logY={useLog}
                    height={280}
                    yFormat={(n) => (useLog || n >= 1_000_000 ? `#${fmtCompact(n)}` : `#${fmtNumber(n)}`)}
                    xFormat={(x) => fmtDate(x, { month: "short", day: "numeric" })}
                    ariaLabel={`Popularity rank history for ${series.map((s) => s.label).join(", ")}`}
                  />
                </>
              ) : (
                <p className="py-6 text-center text-sm text-ink-3">None of these sites are in the top 1 million, so there is no rank history to chart.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Side by side"
              action={
                <button type="button" onClick={exportCsv} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-surface-2">
                  <Download className="h-4 w-4" aria-hidden /> CSV
                </button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-3">
                    <th className="px-5 py-2.5 font-medium">Website</th>
                    <th className="px-3 py-2.5 text-right font-medium">Rank</th>
                    <th className="px-3 py-2.5 text-right font-medium">30-day change</th>
                    <th className="px-3 py-2.5 text-right font-medium">Est. monthly visits (all sources)</th>
                    <th className="px-3 py-2.5 font-medium">Tier</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-line">
                  {colored.map((r) => (
                    <tr key={r.input}>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2 font-medium text-ink">
                          <span className="inline-block h-0.5 w-4 rounded" style={{ background: r.color }} aria-hidden />
                          {r.domain ?? r.input}
                          {r.domain && (
                            <a href={`https://${r.domain}/`} target="_blank" rel="noopener noreferrer nofollow" className="text-ink-3 hover:text-accent-ink" title={`Open ${r.domain} in a new tab`} aria-label={`Open ${r.domain} in a new tab`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </span>
                      </td>
                      {r.ok ? (
                        <>
                          <td className="px-3 py-3 text-right text-ink">{fmtRank(r.data.popularity.latest?.rank)}</td>
                          <td className="px-3 py-3 text-right">{r.data.popularity.ranks.length ? <Delta value={r.data.popularity.change} /> : "—"}</td>
                          <td className="px-3 py-3 text-right text-ink">
                            {r.data.estimate ? (
                              <>
                                ~{fmtCompact(r.data.estimate.mid)} <span className="text-xs text-ink-3">({fmtCompact(r.data.estimate.low)}–{fmtCompact(r.data.estimate.high)})</span>
                              </>
                            ) : (
                              <span className="text-ink-3">&lt; 9K</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-ink-2">{r.data.tier.label}</td>
                        </>
                      ) : (
                        <td colSpan={4} className="px-3 py-3 text-bad-ink">{r.error}</td>
                      )}
                      <td className="px-5 py-3 text-right">
                        {r.domain && (
                          <Link href={`/traffic?domain=${encodeURIComponent(r.domain)}`} className="text-sm text-accent-ink hover:underline">
                            Details
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line px-5 py-3">
              <MethodLink anchor="traffic">How are visits estimated?</MethodLink>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
