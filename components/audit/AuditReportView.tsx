"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, ExternalLink, Info } from "lucide-react";
import type { AuditIssue, AuditReport, CrawledPage, LinkCheckResult, Severity } from "@/lib/audit/types";
import { download, slug, toCsv } from "@/lib/client/csv";
import { fmtBytes, fmtDuration, fmtMs, fmtNumber, pathOf } from "@/lib/client/format";
import { BarList } from "../charts/BarList";
import { DataTable, FilterInput, Tabs, type Column } from "../DataTable";
import { Badge, Card, CardHeader, HttpStatus, MethodLink, ScoreGauge, Stat, StatusPill, cx } from "../ui";

const SEV_ORDER: Severity[] = ["error", "warning", "notice"];

export function AuditReportView({ report }: { report: AuditReport }) {
  const [tab, setTab] = useState<"issues" | "pages" | "external">("issues");
  const counts = useMemo(() => {
    const c: Record<Severity, number> = { error: 0, warning: 0, notice: 0 };
    for (const i of report.issues) c[i.severity] += i.count;
    return c;
  }, [report.issues]);

  const exportJson = () => download(`audit-${slug(report.host)}.json`, JSON.stringify(report, null, 2), "application/json");
  const exportIssues = () =>
    download(
      `audit-issues-${slug(report.host)}.csv`,
      toCsv(report.issues.flatMap((i) => i.urls.map((u) => ({ severity: i.severity, issue: i.title, url: u.url, detail: u.detail ?? "" })))),
    );

  const statusItems = [
    { label: "2xx OK", value: report.statusDistribution["2xx"] ?? 0, color: "var(--good)" },
    { label: "3xx Redirect", value: report.statusDistribution["3xx"] ?? 0, color: "var(--ink-3)" },
    { label: "4xx Client error", value: report.statusDistribution["4xx"] ?? 0, color: "var(--serious)" },
    { label: "5xx Server error", value: report.statusDistribution["5xx"] ?? 0, color: "var(--bad)" },
    { label: "Failed", value: report.statusDistribution["Failed"] ?? 0, color: "var(--bad)" },
    { label: "Blocked", value: report.statusDistribution["Blocked"] ?? 0, color: "var(--ink-3)" },
  ].filter((i) => i.value > 0);
  const depthItems = ["0", "1", "2", "3", "4", "5+"].filter((k) => report.depthDistribution[k]).map((k) => ({ label: k === "0" ? "Homepage" : `${k} click${k === "1" ? "" : "s"}`, value: report.depthDistribution[k] }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
            {report.host}
            <a href={report.finalUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-ink-3 hover:text-accent-ink" title={`Open ${report.host} in a new tab`} aria-label={`Open ${report.host} in a new tab`}>
              <ExternalLink className="h-4 w-4" />
            </a>
          </h2>
          <p className="text-sm text-ink-3">
            Crawled {new Date(report.finishedAt).toLocaleString("en-US")} in {fmtDuration(report.durationMs)}
            {report.stats.cancelled && " · stopped early"}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportIssues} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-surface-2">
            <Download className="h-4 w-4" aria-hidden /> Issues CSV
          </button>
          <button type="button" onClick={exportJson} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-surface-2">
            <Download className="h-4 w-4" aria-hidden /> Full JSON
          </button>
        </div>
      </div>

      {report.site.blockedForCrawler && report.options.respectRobots && (
        <div className="flex gap-2 rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn-ink">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            This site&apos;s robots.txt doesn&apos;t allow crawlers like TrafficLensBot, so the audit couldn&apos;t go past the start page. Many large sites allow only search engines. If it&apos;s
            your own site, uncheck <strong>Respect robots.txt</strong> and run the audit again.
          </span>
        </div>
      )}

      {(report.stats.limitReached || report.stats.cancelled) && (
        <div className="flex gap-2 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent-ink">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {report.stats.cancelled ? "The audit was stopped before it finished. " : `The crawl stopped at the ${report.options.maxPages}-page limit. `}
            {report.stats.discoveredNotCrawled > 0 && `${fmtNumber(report.stats.discoveredNotCrawled)} more URLs were discovered but not crawled. `}
            Orphan-page detection is skipped for partial crawls.
          </span>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
        <div className="card flex flex-col items-center justify-center px-8 py-5">
          <ScoreGauge score={report.healthScore} size={120} label="Health score" />
          <div className="mt-2 text-sm font-medium text-ink">Health score</div>
          <MethodLink anchor="audit">What does this mean?</MethodLink>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="URLs crawled" value={fmtNumber(report.stats.crawled)} sub={`${report.stats.html} HTML pages`} />
          <Stat label="Errors" value={<span className="text-bad-ink">{fmtNumber(counts.error)}</span>} sub={`${report.issues.filter((i) => i.severity === "error").length} issue types`} />
          <Stat label="Warnings" value={<span className="text-warn-ink">{fmtNumber(counts.warning)}</span>} sub={`${report.issues.filter((i) => i.severity === "warning").length} issue types`} />
          <Stat label="Notices" value={fmtNumber(counts.notice)} sub={`${report.issues.filter((i) => i.severity === "notice").length} issue types`} />
          <Stat label="Avg. response time" value={fmtMs(report.stats.avgTtfbMs)} sub="Time to first byte" />
          <Stat label="Links checked" value={fmtNumber(report.stats.externalChecked + report.stats.resourcesChecked)} sub={`${report.stats.externalChecked} external · ${report.stats.resourcesChecked} files`} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="HTTP status codes" subtitle="All crawled URLs" />
          <div className="p-5">
            <BarList items={statusItems} ariaLabel="URLs by HTTP status" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Click depth" subtitle="Clicks from the start page to each HTML page" />
          <div className="p-5">{depthItems.length ? <BarList items={depthItems} ariaLabel="Pages by click depth" /> : <p className="text-sm text-ink-3">No HTML pages crawled.</p>}</div>
        </Card>
      </div>

      <Card>
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "issues", label: `Issues (${report.issues.length})` },
            { id: "pages", label: `Pages (${report.pages.length})` },
            { id: "external", label: `External links (${report.externalLinks.length})` },
          ]}
        />
        {tab === "issues" && <IssuesPanel issues={report.issues} />}
        {tab === "pages" && <PagesPanel pages={report.pages} host={report.host} />}
        {tab === "external" && <ExternalPanel links={report.externalLinks} host={report.host} />}
      </Card>
    </div>
  );
}

function IssuesPanel({ issues }: { issues: AuditIssue[] }) {
  const [filter, setFilter] = useState<Severity | "all">("all");
  const shown = filter === "all" ? issues : issues.filter((i) => i.severity === filter);
  if (!issues.length) return <p className="px-5 py-10 text-center text-sm text-ink-3">No issues found. Nice work.</p>;
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 px-5 pt-4">
        {(["all", ...SEV_ORDER] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={cx("rounded-full border px-3 py-1 text-xs capitalize", filter === s ? "border-transparent bg-ink text-bg" : "border-line text-ink-2 hover:text-ink")}
          >
            {s === "all" ? "All" : `${s}s`} ({s === "all" ? issues.length : issues.filter((i) => i.severity === s).length})
          </button>
        ))}
      </div>
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {shown.map((i) => (
          <IssueRow key={i.id} issue={i} />
        ))}
      </ul>
    </div>
  );
}

function IssueRow({ issue }: { issue: AuditIssue }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const urls = all ? issue.urls : issue.urls.slice(0, 20);
  return (
    <li>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2/60" aria-expanded={open}>
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />}
        <StatusPill status={issue.severity} />
        <span className="min-w-0 flex-1 text-sm font-medium text-ink">{issue.title}</span>
        <span className="tabular text-sm text-ink-2">{fmtNumber(issue.count)}</span>
      </button>
      {open && (
        <div className="space-y-3 bg-surface-2/40 px-5 pb-4 pl-12 pt-1">
          <p className="text-sm text-ink-2">{issue.description}</p>
          <p className="text-sm">
            <span className="font-medium text-ink">How to fix: </span>
            <span className="text-ink-2">{issue.fix}</span>
          </p>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
            {urls.map((u, idx) => (
              <li key={`${u.url}-${idx}`} className="px-3 py-2">
                <a href={u.url} target="_blank" rel="noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 break-all text-accent-ink hover:underline">
                  {u.url}
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                </a>
                {u.detail && <div className="mt-0.5 break-all text-xs text-ink-3">{u.detail}</div>}
              </li>
            ))}
          </ul>
          {issue.urls.length > 20 && !all && (
            <button type="button" onClick={() => setAll(true)} className="text-sm text-accent-ink hover:underline">
              Show all {issue.urls.length}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function PagesPanel({ pages, host }: { pages: CrawledPage[]; host: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "ok" | "redirect" | "error">("all");
  const rows = pages.filter((p) => {
    if (q && !`${p.url} ${p.title ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (status === "ok") return p.status >= 200 && p.status < 300;
    if (status === "redirect") return p.status >= 300 && p.status < 400;
    if (status === "error") return p.status === 0 || p.status >= 400;
    return true;
  });
  const columns: Column<CrawledPage>[] = [
    {
      key: "url",
      header: "URL",
      sortValue: (p) => p.url,
      render: (p) => (
        <div className="max-w-[28rem]">
          <a href={p.url} target="_blank" rel="noreferrer nofollow" className="break-all text-accent-ink hover:underline">
            {pathOf(p.url)}
          </a>
          {p.title && <div className="truncate text-xs text-ink-3">{p.title}</div>}
          {p.redirectTo && <div className="truncate text-xs text-ink-3">→ {p.redirectTo}</div>}
          {p.error && <div className="text-xs text-bad-ink">{p.error}</div>}
        </div>
      ),
    },
    { key: "status", header: "Status", sortValue: (p) => p.status, render: (p) => <HttpStatus status={p.status} /> },
    { key: "depth", header: "Depth", align: "right", sortValue: (p) => p.depth, render: (p) => (p.depth >= 0 ? p.depth : <span title="Only found in the sitemap">—</span>) },
    { key: "inlinks", header: "Inlinks", align: "right", sortValue: (p) => p.inlinks, render: (p) => p.inlinks },
    { key: "words", header: "Words", align: "right", sortValue: (p) => p.wordCount ?? -1, render: (p) => (p.wordCount !== undefined ? fmtNumber(p.wordCount) : "—") },
    { key: "ttfb", header: "TTFB", align: "right", sortValue: (p) => p.ttfbMs, render: (p) => (p.status > 0 ? fmtMs(p.ttfbMs) : "—") },
    { key: "size", header: "Size", align: "right", sortValue: (p) => p.htmlBytes, render: (p) => (p.htmlBytes ? fmtBytes(p.htmlBytes) : "—") },
    {
      key: "issues",
      header: "Issues",
      align: "right",
      sortValue: (p) => p.issues.length,
      render: (p) => (p.issues.length ? <Badge tone={p.issues.length > 3 ? "warn" : "neutral"}>{p.issues.length}</Badge> : <span className="text-ink-3">0</span>),
    },
  ];
  const exportCsv = () =>
    download(
      `audit-pages-${slug(host)}.csv`,
      toCsv(
        pages.map((p) => ({
          url: p.url,
          status: p.status,
          redirect_to: p.redirectTo ?? "",
          depth: p.depth,
          inlinks: p.inlinks,
          title: p.title ?? "",
          meta_description: p.metaDescription ?? "",
          h1: p.h1 ?? "",
          words: p.wordCount ?? "",
          ttfb_ms: p.ttfbMs,
          html_bytes: p.htmlBytes,
          canonical: p.canonical ?? "",
          noindex: p.noindex ?? "",
          in_sitemap: p.inSitemap,
          issues: p.issues.join(" "),
        })),
      ),
    );
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <FilterInput value={q} onChange={setQ} placeholder="Filter by URL or title" />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-9 rounded-lg border border-line bg-bg px-2 text-sm text-ink" aria-label="Status filter">
          <option value="all">All statuses</option>
          <option value="ok">2xx only</option>
          <option value="redirect">Redirects</option>
          <option value="error">Errors</option>
        </select>
        <button type="button" onClick={exportCsv} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-surface-2">
          <Download className="h-4 w-4" aria-hidden /> CSV
        </button>
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(p) => p.url} initialSort={{ key: "issues", dir: "desc" }} />
    </div>
  );
}

function ExternalPanel({ links, host }: { links: LinkCheckResult[]; host: string }) {
  const [brokenOnly, setBrokenOnly] = useState(false);
  const rows = brokenOnly ? links.filter((l) => l.status === 0 || l.status >= 400) : links;
  if (!links.length) return <p className="px-5 py-10 text-center text-sm text-ink-3">No external links were checked.</p>;
  const columns: Column<LinkCheckResult>[] = [
    {
      key: "url",
      header: "Link",
      sortValue: (l) => l.url,
      render: (l) => (
        <a href={l.url} target="_blank" rel="noreferrer nofollow" className="break-all text-accent-ink hover:underline">
          {l.url}
        </a>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (l) => l.status,
      render: (l) => (
        <span className="flex flex-col gap-0.5">
          <HttpStatus status={l.status} />
          {l.error && <span className="text-xs text-ink-3">{l.error}</span>}
          {[401, 403, 429, 999].includes(l.status) && <span className="text-xs text-ink-3">Blocks bots; likely fine in a browser</span>}
        </span>
      ),
    },
    { key: "sources", header: "Linked from", align: "right", sortValue: (l) => l.sources.length, render: (l) => <span title={l.sources.join("\n")}>{l.sources.length} page(s)</span> },
  ];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm text-ink-2">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={brokenOnly} onChange={(e) => setBrokenOnly(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Errors only
        </label>
        <button
          type="button"
          onClick={() => download(`audit-external-${slug(host)}.csv`, toCsv(links.map((l) => ({ url: l.url, status: l.status, error: l.error ?? "", linked_from: l.sources.join(" ") }))))}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-surface-2"
        >
          <Download className="h-4 w-4" aria-hidden /> CSV
        </button>
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(l) => l.url} initialSort={{ key: "status", dir: "desc" }} minWidth={560} />
    </div>
  );
}
