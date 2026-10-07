"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Square, Stethoscope } from "lucide-react";
import type { AuditEvent, AuditReport, CrawledPage } from "@/lib/audit/types";
import { errorMessage, readNdjson } from "@/lib/client/ndjson";
import { addRecent } from "@/lib/client/recent";
import { fmtMs, pathOf } from "@/lib/client/format";
import { Checkbox, ToolForm } from "../ToolForm";
import { Button, ErrorNote, HttpStatus, PageHeader } from "../ui";
import { AuditReportView } from "./AuditReportView";

type Phase = "idle" | "crawling" | "checking-links" | "analyzing" | "done" | "error";

interface RunState {
  phase: Phase;
  crawled: number;
  queued: number;
  recent: CrawledPage[];
  messages: string[];
  linkProgress: { done: number; total: number } | null;
  report: AuditReport | null;
  error: string | null;
}

const INITIAL: RunState = { phase: "idle", crawled: 0, queued: 0, recent: [], messages: [], linkProgress: null, report: null, error: null };
const PAGE_OPTIONS = [25, 50, 100, 200, 500];

export function AuditTool() {
  const params = useSearchParams();
  const router = useRouter();
  const url = (params.get("url") ?? "").trim();
  const maxPages = Number(params.get("max")) || 100;
  const [opts, setOpts] = useState({ respectRobots: params.get("robots") !== "0", checkExternal: params.get("external") !== "0", checkResources: true, useSitemap: true });
  const [max, setMax] = useState(maxPages);
  const [run, setRun] = useState<RunState>(INITIAL);
  const ctrlRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (target: string, pages: number, o: typeof opts) => {
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      setRun({ ...INITIAL, phase: "crawling" });
      addRecent("audit", target);
      const qs = new URLSearchParams({
        url: target,
        maxPages: String(pages),
        respectRobots: o.respectRobots ? "1" : "0",
        checkExternal: o.checkExternal ? "1" : "0",
        checkResources: o.checkResources ? "1" : "0",
        useSitemap: o.useSitemap ? "1" : "0",
      });
      try {
        const res = await fetch(`/api/v1/audit?${qs}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(await errorMessage(res));
        await readNdjson<AuditEvent | { type: "heartbeat" }>(res, (e) => {
          switch (e.type) {
            case "page":
              setRun((r) => ({ ...r, crawled: e.crawled, queued: e.queued, recent: [e.page, ...r.recent].slice(0, 8) }));
              break;
            case "info":
              setRun((r) => ({ ...r, messages: [...r.messages, e.message] }));
              break;
            case "phase":
              setRun((r) => ({ ...r, phase: e.phase, linkProgress: e.phase === "checking-links" ? { done: 0, total: e.total ?? 0 } : r.linkProgress }));
              break;
            case "progress":
              setRun((r) => ({ ...r, linkProgress: { done: e.done, total: e.total } }));
              break;
            case "done":
              setRun((r) => ({ ...r, phase: "done", report: e.report }));
              break;
            case "error":
              setRun((r) => ({ ...r, phase: "error", error: e.message }));
              break;
          }
        });
        setRun((r) => (r.phase === "done" || r.phase === "error" ? r : { ...r, phase: "error", error: "The audit stopped unexpectedly. Try again with fewer pages." }));
      } catch (err) {
        if (ctrl.signal.aborted) setRun((r) => ({ ...r, phase: r.report ? "done" : "idle" }));
        else setRun((r) => ({ ...r, phase: "error", error: (err as Error).message }));
      }
    },
    [],
  );

  // Start when the URL (query string) asks for an audit.
  const startKey = url ? `${url}|${maxPages}` : "";
  const lastKey = useRef("");
  useEffect(() => {
    if (!startKey || lastKey.current === startKey) return;
    lastKey.current = startKey;
    void start(url, maxPages, opts);
    // opts are read at start time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey]);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  const submit = (value: string) => {
    const next = `/audit?url=${encodeURIComponent(value)}&max=${max}`;
    if (value === url && max === maxPages) {
      void start(value, max, opts);
    } else router.push(next);
  };

  const running = run.phase === "crawling" || run.phase === "checking-links" || run.phase === "analyzing";
  const pct = Math.min(100, Math.round((run.crawled / Math.max(1, maxPages)) * 100));

  return (
    <div>
      <PageHeader
        icon={<Stethoscope className="h-7 w-7 text-accent-ink" aria-hidden />}
        title="Site audit"
        description="Crawl a website live and check every page for 45+ technical and on-page SEO issues: broken links, redirects, duplicate titles, thin content, missing tags and more."
      />
      <ToolForm initial={url} label="Website URL" placeholder="https://example.com" button={running ? "Running…" : "Start audit"} busy={running} onSubmit={submit} inputMode="url">
        <label className="inline-flex items-center gap-2">
          Max pages
          <select value={max} onChange={(e) => setMax(Number(e.target.value))} className="h-8 rounded-md border border-line bg-bg px-2 text-sm text-ink">
            {PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <Checkbox checked={opts.respectRobots} onChange={(v) => setOpts((o) => ({ ...o, respectRobots: v }))}>
          Respect robots.txt
        </Checkbox>
        <Checkbox checked={opts.checkExternal} onChange={(v) => setOpts((o) => ({ ...o, checkExternal: v }))}>
          Check external links
        </Checkbox>
        <Checkbox checked={opts.checkResources} onChange={(v) => setOpts((o) => ({ ...o, checkResources: v }))}>
          Check images & files
        </Checkbox>
        <Checkbox checked={opts.useSitemap} onChange={(v) => setOpts((o) => ({ ...o, useSitemap: v }))}>
          Include sitemap URLs
        </Checkbox>
      </ToolForm>

      {run.phase === "error" && run.error && <ErrorNote title="The audit failed" message={run.error} />}

      {running && (
        <div className="card p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-ink">
                {run.phase === "crawling" && `Crawling… ${run.crawled} of up to ${maxPages} pages`}
                {run.phase === "checking-links" && `Checking links and images… ${run.linkProgress?.done ?? 0} of ${run.linkProgress?.total ?? 0}`}
                {run.phase === "analyzing" && "Analyzing results…"}
              </div>
              <div className="text-xs text-ink-3">{run.queued > 0 && run.phase === "crawling" ? `${run.queued} URLs waiting in the queue` : "This runs live against the site; larger sites take a few minutes."}</div>
            </div>
            <Button variant="secondary" className="h-9" onClick={() => ctrlRef.current?.abort()}>
              <Square className="h-3.5 w-3.5" aria-hidden /> Stop
            </Button>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-accent-soft" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={run.phase === "crawling" ? pct : 100}>
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${run.phase === "crawling" ? pct : run.linkProgress?.total ? Math.round((run.linkProgress.done / run.linkProgress.total) * 100) : 100}%` }}
            />
          </div>
          {run.messages.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-xs text-ink-3">
              {run.messages.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
          {run.recent.length > 0 && (
            <ul className="mt-4 divide-y divide-line rounded-lg border border-line text-sm">
              {run.recent.map((p) => (
                <li key={p.url} className="flex items-center gap-3 px-3 py-1.5">
                  <HttpStatus status={p.status} />
                  <span className="min-w-0 flex-1 truncate text-ink-2">{pathOf(p.url)}</span>
                  <span className="tabular text-xs text-ink-3">{p.status > 0 ? fmtMs(p.ttfbMs) : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {run.report && !running && <AuditReportView report={run.report} />}

      {run.phase === "idle" && !run.report && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Live crawl", "We follow links from your homepage (and your XML sitemap), the way search engines discover pages."],
            ["45+ checks", "Broken pages and links, redirect chains and loops, duplicate and missing tags, thin content, orphan pages, mixed content, and more."],
            ["Polite by default", "Identifies as TrafficLensBot, obeys robots.txt and crawl-delay, and caps concurrency. Results aren't stored on our server."],
          ].map(([t, b]) => (
            <div key={t} className="card p-5">
              <h2 className="font-semibold text-ink">{t}</h2>
              <p className="mt-1 text-sm text-ink-2">{b}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
