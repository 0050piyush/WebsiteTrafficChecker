"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileSearch, Link2, Loader2 } from "lucide-react";
import type { PageReport } from "@/lib/seo/analyze";
import type { CheckCategory } from "@/lib/seo/checks";
import type { ExtractedLink } from "@/lib/seo/extract";
import { errorMessage } from "@/lib/client/ndjson";
import { addRecent } from "@/lib/client/recent";
import { download, slug, toCsv } from "@/lib/client/csv";
import { fmtBytes, fmtDate, fmtMs, fmtNumber } from "@/lib/client/format";
import { ToolForm } from "../ToolForm";
import { RecentSearches } from "../RecentSearches";
import { DataTable, FilterInput, Tabs, type Column } from "../DataTable";
import { Badge, Button, Card, CardHeader, ErrorNote, HttpStatus, KeyValue, PageHeader, ScoreGauge, Skeleton, StatusPill, cx } from "../ui";
import { ChecksList, CheckSummary } from "../report/ChecksList";
import { SerpPreview } from "../report/SerpPreview";
import { TechStack } from "../report/TechStack";
import { PageSpeedPanel } from "../report/PageSpeedPanel";
import { AdSlot } from "../AdSlot";

type TabId = "checks" | "content" | "links" | "images" | "social" | "technical" | "speed";

export function AnalyzerTool() {
  const params = useSearchParams();
  const router = useRouter();
  const url = (params.get("url") ?? "").trim();
  const keyword = (params.get("keyword") ?? "").trim();
  const [kw, setKw] = useState(keyword);
  const key = url ? `${url}|${keyword}` : "";
  const [loaded, setLoaded] = useState<{ key: string; report: PageReport | null; error: string | null }>({ key: "", report: null, error: null });
  const state = loaded.key === key ? { ...loaded, loading: false } : { key, report: null, error: null, loading: !!key };

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    addRecent("analyzer", url);
    const qs = new URLSearchParams({ url, ...(keyword ? { keyword } : {}) });
    fetch(`/api/v1/analyze?${qs}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorMessage(res));
        setLoaded({ key, report: await res.json(), error: null });
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setLoaded({ key, report: null, error: (err as Error).message });
      });
    return () => ctrl.abort();
  }, [key, url, keyword]);

  return (
    <div>
      <PageHeader
        icon={<FileSearch className="h-7 w-7 text-accent-ink" aria-hidden />}
        title="On-page SEO checker"
        description="Run 40+ checks on any URL: titles, meta tags, headings, content, links, images, structured data, social previews, speed and security. Add a target keyword to check how well the page is optimized for it."
      />
      <ToolForm
        initial={url}
        label="Page URL"
        placeholder="https://example.com/page"
        button="Analyze page"
        busy={state.loading}
        inputMode="url"
        openSite
        onSubmit={(v) => router.push(`/analyzer?${new URLSearchParams({ url: v, ...(kw.trim() ? { keyword: kw.trim() } : {}) })}`)}
      >
        <label className="flex w-full items-center gap-2 sm:w-auto">
          <span className="shrink-0">Target keyword</span>
          <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="optional, e.g. running shoes" className="h-8 w-full rounded-md border border-line bg-bg px-2 text-sm text-ink outline-none focus:border-accent sm:w-64" />
        </label>
      </ToolForm>
      <RecentSearches tool="analyzer" exclude={url} className="-mt-3 mb-6" />
      {state.error && <ErrorNote title="Couldn't analyze this page" message={state.error} />}
      {state.loading && (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-[14px]" />
          <Skeleton className="h-96 rounded-[14px]" />
        </div>
      )}
      {state.report && <PageReportView report={state.report} />}
    </div>
  );
}

function PageReportView({ report: r }: { report: PageReport }) {
  const [tab, setTab] = useState<TabId>("checks");
  const categories = useMemo(() => [...new Set(r.checks.map((c) => c.category))] as CheckCategory[], [r.checks]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="flex flex-col items-center justify-center gap-4 p-6 sm:flex-row sm:justify-start">
          <ScoreGauge score={r.score} size={128} label="On-page SEO score" />
          <div className="min-w-0 space-y-2 text-center sm:text-left">
            <a href={r.finalUrl} target="_blank" rel="noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 break-all text-sm font-medium text-accent-ink hover:underline">
              {r.finalUrl} <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
            <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
              <HttpStatus status={r.http.status} />
              <StatusPill status={r.seo.indexable ? "pass" : "fail"} label={r.seo.indexable ? "Indexable" : "Not indexable"} />
              {r.keyword && <Badge tone="accent">Keyword: {r.keyword}</Badge>}
            </div>
            <CheckSummary checks={r.checks} />
            <p className="text-xs text-ink-3">Fetched {new Date(r.fetchedAt).toLocaleString("en-US")} in {fmtMs(r.http.totalMs)}</p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Search result preview" subtitle={`Title ~${r.seo.titlePx}px of 600px · description ~${r.seo.descriptionPx}px of 920px`} />
          <div className="p-5">
            <SerpPreview serp={r.serp} favicon={r.seo.favicon} />
            {(r.serp.titleTruncated || r.serp.descriptionTruncated) && (
              <p className="mt-2 text-xs text-warn-ink">{[r.serp.titleTruncated && "Title", r.serp.descriptionTruncated && "Description"].filter(Boolean).join(" and ")} will likely be truncated.</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <Tabs<TabId>
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "checks", label: "All checks" },
            { id: "content", label: "Content & keywords" },
            { id: "links", label: `Links (${r.links.total})` },
            { id: "images", label: `Images (${r.images.total})` },
            { id: "social", label: "Social & schema" },
            { id: "technical", label: "HTTP & security" },
            { id: "speed", label: "Core Web Vitals" },
          ]}
        />
        <div className="p-5">
          {tab === "checks" && (
            <div className="gap-10 md:columns-2">
              {categories.map((cat) => (
                <div key={cat} className="mb-6 break-inside-avoid">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-3">{cat}</h3>
                  <ChecksList checks={r.checks.filter((c) => c.category === cat)} />
                </div>
              ))}
            </div>
          )}
          {tab === "content" && <ContentPanel r={r} />}
          {tab === "links" && <LinksPanel r={r} />}
          {tab === "images" && <ImagesPanel r={r} />}
          {tab === "social" && <SocialPanel r={r} />}
          {tab === "technical" && <TechnicalPanel r={r} />}
          {tab === "speed" && <PageSpeedPanel url={r.finalUrl} />}
        </div>
      </Card>
      <AdSlot />
    </div>
  );
}

function ContentPanel({ r }: { r: PageReport }) {
  const [n, setN] = useState<"one" | "two" | "three">("one");
  const grams = r.content.keywords[n];
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold text-ink">Heading outline</h3>
        {r.seo.headings.length ? (
          <ol className="mt-3 space-y-1 text-sm">
            {r.seo.headings.map((h, i) => (
              <li key={i} className="flex items-baseline gap-2" style={{ paddingLeft: `${(h.level - 1) * 14}px` }}>
                <Badge tone={h.level === 1 ? "accent" : "neutral"} className="shrink-0 font-mono">
                  H{h.level}
                </Badge>
                <span className={cx("text-ink-2", !h.text && "italic text-ink-3")}>{h.text || "(empty heading)"}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-ink-3">No headings found.</p>
        )}
      </div>
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-ink">Readability</h3>
          {r.content.readability ? (
            <KeyValue
              rows={[
                ["Flesch reading ease", <span key="f"><span className="font-semibold">{r.content.readability.fleschReadingEase}</span> · {r.content.readability.label}</span>],
                ["Words in main content", fmtNumber(r.content.readability.words)],
                ["Avg. words per sentence", r.content.readability.avgWordsPerSentence],
                ["Total visible words", fmtNumber(r.content.wordCount)],
              ]}
            />
          ) : (
            <p className="mt-2 text-sm text-ink-3">Not enough English text to score readability.</p>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Most used phrases</h3>
            <div className="inline-flex rounded-lg border border-line p-0.5 text-xs" role="group" aria-label="Phrase length">
              {(["one", "two", "three"] as const).map((k, i) => (
                <button key={k} type="button" onClick={() => setN(k)} aria-pressed={n === k} className={cx("rounded-md px-2.5 py-1", n === k ? "bg-surface-2 font-medium text-ink" : "text-ink-3")}>
                  {i + 1} word{i ? "s" : ""}
                </button>
              ))}
            </div>
          </div>
          {grams.length ? (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="py-1.5 font-medium">Phrase</th>
                  <th className="py-1.5 text-right font-medium">Count</th>
                  <th className="py-1.5 text-right font-medium">Density</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-line">
                {grams.map((g) => (
                  <tr key={g.phrase}>
                    <td className="py-1.5 text-ink">{g.phrase}</td>
                    <td className="py-1.5 text-right text-ink-2">{g.count}</td>
                    <td className="py-1.5 text-right text-ink-2">{g.density.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-sm text-ink-3">No repeated phrases.</p>
          )}
        </div>
      </div>
    </div>
  );
}

type LinkStatus = { status: number; error: string | null };

function LinksPanel({ r }: { r: PageReport }) {
  const [filter, setFilter] = useState<"all" | "internal" | "external" | "nofollow" | "broken">("all");
  const [q, setQ] = useState("");
  const [statuses, setStatuses] = useState<Record<string, LinkStatus>>({});
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unique = useMemo(() => {
    const map = new Map<string, ExtractedLink & { count: number }>();
    for (const l of r.links.items) {
      const prev = map.get(l.href);
      if (prev) prev.count++;
      else map.set(l.href, { ...l, count: 1 });
    }
    return [...map.values()];
  }, [r.links.items]);

  const checkAll = async () => {
    setChecking(true);
    setError(null);
    try {
      const urls = unique.map((l) => l.href);
      const out: Record<string, LinkStatus> = {};
      for (let i = 0; i < urls.length; i += 150) {
        const res = await fetch("/api/v1/links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ urls: urls.slice(i, i + 150) }) });
        if (!res.ok) throw new Error(await errorMessage(res));
        const body = (await res.json()) as { results: { url: string; status: number; error: string | null }[] };
        for (const x of body.results) out[x.url] = { status: x.status, error: x.error };
        setStatuses({ ...out });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const broken = (href: string) => {
    const s = statuses[href];
    return !!s && (s.status === 0 || s.status === 404 || s.status === 410 || s.status >= 500);
  };
  const rows = unique.filter((l) => {
    if (q && !`${l.href} ${l.text}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "internal") return l.internal;
    if (filter === "external") return !l.internal;
    if (filter === "nofollow") return l.nofollow;
    if (filter === "broken") return broken(l.href);
    return true;
  });
  const checkedCount = Object.keys(statuses).length;
  const brokenCount = unique.filter((l) => broken(l.href)).length;

  const columns: Column<ExtractedLink & { count: number }>[] = [
    {
      key: "href",
      header: "URL",
      sortValue: (l) => l.href,
      render: (l) => (
        <div className="max-w-[30rem]">
          <a href={l.href} target="_blank" rel="noreferrer nofollow" className="break-all text-accent-ink hover:underline">
            {l.href}
          </a>
          <div className="truncate text-xs text-ink-3">{l.text || <em>no anchor text</em>}</div>
        </div>
      ),
    },
    { key: "type", header: "Type", sortValue: (l) => (l.internal ? 0 : 1), render: (l) => <Badge>{l.internal ? "Internal" : "External"}</Badge> },
    { key: "rel", header: "Rel", render: (l) => (l.rel.length ? <span className="text-xs text-ink-2">{l.rel.join(" ")}</span> : <span className="text-ink-3">—</span>) },
    { key: "count", header: "Times", align: "right", sortValue: (l) => l.count, render: (l) => l.count },
    {
      key: "status",
      header: "Status",
      sortValue: (l) => statuses[l.href]?.status ?? -2,
      render: (l) => {
        const s = statuses[l.href];
        if (!s) return <span className="text-ink-3">{checking ? "…" : "—"}</span>;
        return (
          <span className="flex flex-col gap-0.5">
            <HttpStatus status={s.status} />
            {s.error && <span className="text-xs text-ink-3">{s.error}</span>}
          </span>
        );
      },
    },
  ];

  return (
    <div className="-m-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <FilterInput value={q} onChange={setQ} placeholder="Filter links" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-9 rounded-lg border border-line bg-bg px-2 text-sm text-ink" aria-label="Link type">
          <option value="all">All links ({unique.length})</option>
          <option value="internal">Internal</option>
          <option value="external">External</option>
          <option value="nofollow">Nofollow / UGC / sponsored</option>
          <option value="broken">Broken ({brokenCount})</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          {checkedCount > 0 && !checking && (
            <span className="text-sm text-ink-2">
              {brokenCount ? <span className="text-bad-ink">{brokenCount} broken</span> : <span className="text-good-ink">No broken links</span>} of {checkedCount} checked
            </span>
          )}
          <Button variant="secondary" className="h-9" onClick={checkAll} disabled={checking || !unique.length}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
            {checking ? `Checking ${checkedCount}/${unique.length}…` : "Check all links"}
          </Button>
          <button
            type="button"
            onClick={() => download(`links-${slug(r.finalUrl)}.csv`, toCsv(unique.map((l) => ({ url: l.href, anchor: l.text, internal: l.internal, rel: l.rel.join(" "), count: l.count, status: statuses[l.href]?.status ?? "" }))))}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-surface-2"
          >
            <Download className="h-4 w-4" aria-hidden /> CSV
          </button>
        </div>
      </div>
      {error && <ErrorNote className="m-5" message={error} />}
      <DataTable rows={rows} columns={columns} rowKey={(l) => l.href} pageSize={50} empty="No links match." />
      {r.links.total > r.links.items.length && <p className="px-5 py-2 text-xs text-ink-3">Showing the first {r.links.items.length} of {r.links.total} links.</p>}
    </div>
  );
}

function ImagesPanel({ r }: { r: PageReport }) {
  if (!r.images.total) return <p className="text-sm text-ink-3">No images on this page.</p>;
  return (
    <div className="-m-5">
      <DataTable
        rows={r.images.items}
        rowKey={(img, i) => `${img.src}-${i}`}
        minWidth={600}
        columns={[
          {
            key: "src",
            header: "Image",
            render: (img) => (
              <a href={img.src} target="_blank" rel="noreferrer nofollow" className="break-all text-accent-ink hover:underline">
                {img.src.length > 90 ? `${img.src.slice(0, 90)}…` : img.src}
              </a>
            ),
          },
          {
            key: "alt",
            header: "Alt text",
            sortValue: (img) => (img.alt === null ? 0 : img.alt === "" ? 1 : 2),
            render: (img) => (img.alt === null ? <StatusPill status="warn" label="Missing" /> : img.alt === "" ? <span className="text-xs text-ink-3">Empty (decorative)</span> : <span className="text-ink-2">{img.alt}</span>),
          },
          { key: "dims", header: "Size attrs", render: (img) => (img.width && img.height ? `${img.width}×${img.height}` : <span className="text-ink-3">—</span>) },
          { key: "loading", header: "Loading", render: (img) => img.loading ?? <span className="text-ink-3">eager</span> },
        ]}
      />
    </div>
  );
}

function absUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

function SocialPanel({ r }: { r: PageReport }) {
  const og = r.social.openGraph;
  const ogImage = og["og:image"] ? absUrl(og["og:image"], r.finalUrl) : null;
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold text-ink">Link preview</h3>
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          {ogImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ogImage} alt="Open Graph preview" className="aspect-[1.91/1] w-full bg-surface-2 object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-surface-2 text-sm text-ink-3">No og:image</div>
          )}
          <div className="space-y-1 bg-surface-2 px-4 py-3">
            <div className="text-xs uppercase text-ink-3">{new URL(r.finalUrl).hostname}</div>
            <div className="font-semibold text-ink">{og["og:title"] || r.seo.title || "No title"}</div>
            <div className="line-clamp-2 text-sm text-ink-2">{og["og:description"] || r.seo.metaDescription || "No description"}</div>
          </div>
        </div>
      </div>
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-ink">Structured data</h3>
          {r.structuredData.jsonLd.length || r.structuredData.microdataTypes.length ? (
            <ul className="mt-2 space-y-2 text-sm">
              {r.structuredData.jsonLd.map((j, i) => (
                <li key={i} className="flex flex-wrap items-center gap-1.5">
                  <StatusPill status={j.valid ? "pass" : "fail"} label={j.valid ? "JSON-LD" : "Invalid JSON-LD"} />
                  {j.types.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                  {j.error && <span className="text-xs text-bad-ink">{j.error}</span>}
                </li>
              ))}
              {r.structuredData.microdataTypes.length > 0 && (
                <li className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">Microdata</Badge>
                  {r.structuredData.microdataTypes.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-3">No structured data found.</p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Open Graph & Twitter tags</h3>
          {Object.keys(og).length + Object.keys(r.social.twitter).length ? (
            <KeyValue rows={[...Object.entries(og), ...Object.entries(r.social.twitter)].slice(0, 20).map(([k, v]) => [<code key={k} className="text-xs">{k}</code>, <span key={`${k}v`} className="break-all">{v}</span>])} />
          ) : (
            <p className="mt-2 text-sm text-ink-3">No social tags found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TechnicalPanel({ r }: { r: PageReport }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-ink">Response</h3>
          <KeyValue
            rows={[
              ["Status", <HttpStatus key="s" status={r.http.status} />],
              ["Time to first byte", fmtMs(r.http.ttfbMs)],
              ["HTML size", `${fmtBytes(r.http.htmlBytes)} (${fmtBytes(r.http.transferBytes)} on the wire)`],
              ["Compression", r.http.contentEncoding ?? "none"],
              ["Content-Type", r.http.contentType ?? "—"],
              ["Server", r.http.server ?? "—"],
              ["Cache-Control", r.http.cacheControl ?? "—"],
              ["X-Robots-Tag", r.http.xRobotsTag ?? "—"],
              ["Canonical", r.seo.canonical ? <span key="c" className="break-all">{r.seo.canonical}</span> : "—"],
              [
                "robots.txt",
                !r.robotsTxt.found ? (
                  "Not found (all bots allowed)"
                ) : !r.robotsTxt.access ? (
                  "Couldn't be read"
                ) : !r.robotsTxt.access.googlebot ? (
                  <StatusPill key="r" status="fail" label="Blocks Googlebot" />
                ) : !r.robotsTxt.access.bingbot ? (
                  <StatusPill key="r" status="warn" label="Blocks Bingbot" />
                ) : (
                  <StatusPill key="r" status="pass" label={r.robotsTxt.access.otherBots ? "Allows search engines" : "Allows search engines · blocks other bots"} />
                ),
              ],
            ]}
          />
        </div>
        {r.http.redirects.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-ink">Redirect chain</h3>
            <ol className="mt-2 space-y-1.5 text-sm">
              {r.http.redirects.map((h, i) => (
                <li key={i} className="flex items-start gap-2">
                  <HttpStatus status={h.status} />
                  <span className="break-all text-ink-2">{h.url}</span>
                </li>
              ))}
              <li className="flex items-start gap-2">
                <HttpStatus status={r.http.status} />
                <span className="break-all text-ink">{r.finalUrl}</span>
              </li>
            </ol>
          </div>
        )}
      </div>
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-ink">TLS certificate</h3>
          {r.tls ? (
            <KeyValue
              rows={[
                ["Issued to", r.tls.subject ?? "—"],
                ["Issuer", r.tls.issuer ?? "—"],
                ["Valid until", `${fmtDate(r.tls.validTo)} (${r.tls.daysRemaining} days)`],
                ["Protocol", r.tls.protocol ?? "—"],
                ["Covers", `${r.tls.altNames.length} hostname(s)`],
              ]}
            />
          ) : (
            <p className="mt-2 text-sm text-ink-3">Not served over HTTPS.</p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Security headers</h3>
          <KeyValue
            rows={Object.entries(r.http.securityHeaders).map(([k, v]) => [
              <code key={k} className="text-xs">{k}</code>,
              v ? <span key={`${k}v`} className="break-all text-xs">{v}</span> : <StatusPill key={`${k}v`} status="warn" label="Missing" />,
            ])}
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Technologies</h3>
          <div className="mt-3">
            <TechStack technologies={r.technologies} />
          </div>
        </div>
      </div>
    </div>
  );
}
