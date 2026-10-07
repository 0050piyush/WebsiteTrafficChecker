"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Square, Stethoscope } from "lucide-react";
import type { AuditEvent, AuditReport, CrawledPage } from "@/lib/audit/types";
import { errorMessage, readNdjson } from "@/lib/client/ndjson";
import { addRecent } from "@/lib/client/recent";
import { useAccount } from "@/lib/client/account";
import { fmtMs, fmtNumber, pathOf } from "@/lib/client/format";
import { Checkbox, ToolForm } from "../ToolForm";
import { RecentSearches } from "../RecentSearches";
import { AdSlot } from "../AdSlot";
import { Button, ErrorNote, HttpStatus, PageHeader } from "../ui";
import { AuditReportView } from "./AuditReportView";

type Phase = "idle" | "crawling" | "checking-links" | "analyzing" | "done" | "error";

interface RunState {
  phase: Phase;
  /** Page limit the server set for this audit (null = none), once the crawl starts. */
  pageLimit: number | null | undefined;
  crawled: number;
  queued: number;
  recent: CrawledPage[];
  messages: string[];
  linkProgress: { done: number; total: number } | null;
  report: AuditReport | null;
  error: string | null;
}

const INITIAL: RunState = { phase: "idle", pageLimit: undefined, crawled: 0, queued: 0, recent: [], messages: [], linkProgress: null, report: null, error: null };

export function AuditTool() {
  const params = useSearchParams();
  const router = useRouter();
  const url = (params.get("url") ?? "").trim();
  const [opts, setOpts] = useState({ respectRobots: params.get("robots") !== "0", checkExternal: params.get("external") !== "0", checkResources: true, useSitemap: true });
  const [run, setRun] = useState<RunState>(INITIAL);
  const ctrlRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (target: string, o: typeof opts) => {
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      setRun({ ...INITIAL, phase: "crawling" });
      addRecent("audit", target);
      const qs = new URLSearchParams({
        url: target,
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
            case "start":
              setRun((r) => ({ ...r, pageLimit: e.options.maxPages }));
              break;
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
  const startKey = url;
  const lastKey = useRef("");
  useEffect(() => {
    if (!startKey || lastKey.current === startKey) return;
    lastKey.current = startKey;
    void start(url, opts);
    // opts are read at start time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey]);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  const submit = (value: string) => {
    if (value === url) void start(value, opts);
    else router.push(`/audit?url=${encodeURIComponent(value)}`);
  };

  const running = run.phase === "crawling" || run.phase === "checking-links" || run.phase === "analyzing";
  // With no page limit, show progress against everything discovered so far.
  const pct = Math.min(100, Math.round((run.crawled / Math.max(1, typeof run.pageLimit === "number" ? run.pageLimit : run.crawled + run.queued)) * 100));
  const account = useAccount();

  return (
    <div>
      <PageHeader
        icon={<Stethoscope className="h-7 w-7 text-accent-ink" aria-hidden />}
        title="Site audit"
        description="Crawl a website live and check every page for 45+ technical and on-page SEO issues: broken links, redirects, duplicate titles, thin content, missing tags and more."
      />
      <ToolForm initial={url} label="Website URL" placeholder="https://example.com" button={running ? "Running…" : "Start audit"} busy={running} onSubmit={submit} inputMode="url" openSite>
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
      {account && <PageLimitNote limit={account.auditPages} />}
      <RecentSearches tool="audit" exclude={url} className="-mt-3 mb-6" />

      {run.phase === "error" && run.error && <ErrorNote title="The audit failed" message={run.error} />}

      {running && (
        <div className="card p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-ink">
                {run.phase === "crawling" &&
                  (run.pageLimit === undefined
                    ? "Starting the crawl…"
                    : run.pageLimit === null
                      ? `Crawling… ${fmtNumber(run.crawled)} pages`
                      : `Crawling… ${fmtNumber(run.crawled)} of up to ${fmtNumber(run.pageLimit)} pages`)}
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

      {run.report && !running && (
        <>
          <AuditReportView report={run.report} />
          <AdSlot className="mt-8" />
        </>
      )}

      {run.phase === "idle" && !run.report && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

/** What the visitor's plan allows: Free audits have a page limit, paid audits don't. */
function PageLimitNote({ limit }: { limit: number | null }) {
  return (
    <p className="-mt-3 mb-6 text-xs text-ink-3">
      {limit === null ? (
        "No page limit on your plan: the audit crawls every page it can reach."
      ) : (
        <>
          Free audits crawl up to {fmtNumber(limit)} pages.{" "}
          <Link href="/pricing" className="text-accent-ink hover:underline">
            Pro and Agency have no page limit
          </Link>
          .
        </>
      )}
    </p>
  );
}
