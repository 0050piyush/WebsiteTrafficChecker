"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BarChart3, ExternalLink, Globe, History, Link2, Loader2, Lock, Search, Server, ShieldCheck, Stethoscope, Cpu, Gauge, Download } from "lucide-react";
import type { SectionMap, SectionName } from "@/lib/overview";
import { readNdjson, errorMessage } from "@/lib/client/ndjson";
import { addRecent } from "@/lib/client/recent";
import { download, slug } from "@/lib/client/csv";
import { fmtAxis, fmtBytes, fmtCompact, fmtDate, fmtMs, fmtNumber, fmtRank, fmtYears } from "@/lib/client/format";
import { UNRANKED_CEILING } from "@/lib/traffic-model";
import { ToolForm } from "../ToolForm";
import { RecentSearches } from "../RecentSearches";
import { LineChart } from "../charts/LineChart";
import { Badge, Card, CardHeader, Delta, ErrorNote, KeyValue, MethodLink, PageHeader, ScoreGauge, Skeleton, Stat, StatusPill, cx } from "../ui";
import { SerpPreview } from "../report/SerpPreview";
import { Favicon } from "../report/Favicon";
import { TechStack } from "../report/TechStack";
import { ChecksList } from "../report/ChecksList";
import { PageSpeedPanel } from "../report/PageSpeedPanel";
import { TopKeywords, keywordsSubtitle } from "./TopKeywords";

type SectionState<K extends SectionName> = { status: "loading" } | { status: "ok"; data: SectionMap[K] } | { status: "error"; error: string };
type Sections = { [K in SectionName]: SectionState<K> };

const LOADING: Sections = {
  traffic: { status: "loading" },
  homepage: { status: "loading" },
  crawlability: { status: "loading" },
  keywords: { status: "loading" },
  registration: { status: "loading" },
  dns: { status: "loading" },
  history: { status: "loading" },
  authority: { status: "loading" },
};

interface OverviewState {
  key: string;
  domain: string;
  hostname: string;
  sections: Sections;
  fatal: string | null;
  done: boolean;
}

const fresh = (domain: string): OverviewState => ({ key: domain, domain, hostname: domain, sections: LOADING, fatal: null, done: false });

type OverviewEvent = { type: string; section?: SectionName; status?: "ok" | "error"; data?: unknown; error?: string; message?: string; domain?: string; hostname?: string };

async function streamOverview(domain: string, sections: SectionName[] | null, signal: AbortSignal, onEvent: (e: OverviewEvent) => void) {
  const qs = new URLSearchParams({ domain, ...(sections ? { sections: sections.join(",") } : {}) });
  const res = await fetch(`/api/v1/overview?${qs}`, { signal });
  if (!res.ok) throw new Error(await errorMessage(res));
  await readNdjson<OverviewEvent>(res, onEvent);
}

function withSections(s: OverviewState, names: SectionName[], value: { status: "loading" } | { status: "error"; error: string }): OverviewState {
  return { ...s, sections: { ...s.sections, ...Object.fromEntries(names.map((n) => [n, value])) } as Sections };
}

const SECTION_KEYS = Object.keys(LOADING) as SectionName[];
/** Built from one homepage fetch on the server, so they're retried together. */
const HOMEPAGE_GROUP: SectionName[] = ["homepage", "crawlability", "keywords"];

/** When a stream ends, any section that never reported back gets a retryable error instead of an endless skeleton. */
function settleUnfinished(s: OverviewState, names: SectionName[] = SECTION_KEYS): OverviewState {
  const stuck = names.filter((n) => s.sections[n].status === "loading");
  return stuck.length ? withSections(s, stuck, { status: "error", error: "This section didn't finish loading." }) : s;
}

function useOverview(domain: string): OverviewState & { retry: (section: SectionName) => void } {
  // State is tagged with the domain it belongs to; a new domain starts from a fresh state.
  const [state, setState] = useState<OverviewState>(() => fresh(""));
  const retries = useRef<AbortController[]>([]);

  const handlers = useCallback((dom: string, group: SectionName[] | null) => {
    const update = (fn: (s: OverviewState) => OverviewState) => setState((s) => fn(s.key === dom ? s : fresh(dom)));
    const onEvent = (e: OverviewEvent) => {
      if (e.type === "meta") update((s) => ({ ...s, domain: e.domain!, hostname: e.hostname! }));
      else if (e.type === "section" && e.section) {
        const section = e.section;
        const value = e.status === "ok" ? { status: "ok" as const, data: e.data } : { status: "error" as const, error: e.error ?? "Failed" };
        update((s) => ({ ...s, sections: { ...s.sections, [section]: value } as Sections }));
      } else if (e.type === "error") {
        update((s) => (group ? withSections(s, group, { status: "error", error: e.message ?? "Failed" }) : { ...s, fatal: e.message ?? "Failed" }));
      }
    };
    return { update, onEvent };
  }, []);

  useEffect(() => {
    if (!domain) return;
    const ctrl = new AbortController();
    const { update, onEvent } = handlers(domain, null);
    streamOverview(domain, null, ctrl.signal, onEvent)
      .then(() => update((s) => ({ ...settleUnfinished(s), done: true })))
      .catch((err: Error) => {
        if (!ctrl.signal.aborted) update((s) => ({ ...settleUnfinished(s), fatal: err.message, done: true }));
      });
    const pending = retries.current;
    return () => {
      ctrl.abort();
      pending.splice(0).forEach((c) => c.abort());
    };
  }, [domain, handlers]);

  /** Re-run one section (homepage, crawlability and keywords are fetched together). */
  const retry = useCallback(
    (section: SectionName) => {
      const group: SectionName[] = HOMEPAGE_GROUP.includes(section) ? HOMEPAGE_GROUP : [section];
      const { update, onEvent } = handlers(domain, group);
      update((s) => withSections(s, group, { status: "loading" }));
      const ctrl = new AbortController();
      retries.current.push(ctrl);
      streamOverview(domain, group, ctrl.signal, onEvent)
        .then(() => update((s) => settleUnfinished(s, group)))
        .catch((err: Error) => {
          if (!ctrl.signal.aborted) update((s) => withSections(s, group, { status: "error", error: err.message }));
        });
    },
    [domain, handlers],
  );

  return { ...(state.key === domain ? state : fresh(domain)), retry };
}

export function TrafficTool() {
  const params = useSearchParams();
  const router = useRouter();
  const domain = (params.get("domain") ?? "").trim();
  const overview = useOverview(domain);

  useEffect(() => {
    if (domain) addRecent("traffic", domain);
  }, [domain]);

  return (
    <div>
      <PageHeader
        icon={<BarChart3 className="h-7 w-7 text-accent-ink" aria-hidden />}
        title="Website traffic checker"
        description="Popularity rank and trend, an estimated monthly visits range, homepage SEO, tech stack, hosting, and domain history for any website."
      />
      <ToolForm
        initial={domain}
        label="Domain"
        placeholder="Enter a domain, e.g. example.com"
        button="Check traffic"
        // Spin only until the first results arrive; later sections show their own loading state.
        busy={!!domain && !overview.done && SECTION_KEYS.every((n) => overview.sections[n].status === "loading")}
        openSite
        onSubmit={(v) => router.push(`/traffic?domain=${encodeURIComponent(v)}`)}
      />
      <RecentSearches tool="traffic" exclude={domain} className="-mt-3 mb-6" />
      {!domain ? <Intro /> : overview.fatal && !Object.values(overview.sections).some((s) => s.status === "ok") ? <ErrorNote title="Couldn't analyze this domain" message={overview.fatal} /> : <Report overview={overview} />}
    </div>
  );
}

function Intro() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        ["Real popularity data", "Ranks combine several independent popularity sources, averaged over 30 days, so they're hard to manipulate."],
        ["Honest estimates", "Visits are shown as a range with the model published, because every traffic number is an estimate."],
        ["Everything else, live", "We fetch the site right now to read its SEO, tech stack, TLS certificate, DNS and robots.txt."],
      ].map(([t, b]) => (
        <div key={t} className="card p-5">
          <h2 className="font-semibold text-ink">{t}</h2>
          <p className="mt-1 text-sm text-ink-2">{b}</p>
        </div>
      ))}
    </div>
  );
}

function SectionBody<K extends SectionName>({
  state,
  children,
  rows = 4,
  onRetry,
}: {
  state: SectionState<K>;
  children: (data: SectionMap[K]) => React.ReactNode;
  rows?: number;
  onRetry?: () => void;
}) {
  if (state.status === "loading")
    return (
      <div className="space-y-3 p-5">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className={cx("h-4", i % 2 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    );
  if (state.status === "error")
    return (
      <div className="p-5">
        <ErrorNote message={state.error} onRetry={onRetry} />
      </div>
    );
  return <>{children(state.data)}</>;
}

function Report({ overview }: { overview: ReturnType<typeof useOverview> }) {
  const { sections: s, domain, hostname, retry } = overview;
  const [metric, setMetric] = useState<"rank" | "visits">("rank");
  const traffic = s.traffic.status === "ok" ? s.traffic.data : null;
  const home = s.homepage.status === "ok" ? s.homepage.data : null;
  const reg = s.registration.status === "ok" ? s.registration.data : null;
  const hist = s.history.status === "ok" ? s.history.data : null;
  const auth = s.authority.status === "ok" ? s.authority.data : null;
  const rank = traffic?.popularity.latest?.rank ?? null;
  const siteUrl = home?.finalUrl ?? `https://${hostname}/`;

  const chartSeries = useMemo(() => {
    if (!traffic?.estimatesByDay.length) return [];
    return [
      {
        id: metric,
        label: metric === "rank" ? "Popularity rank" : "Est. monthly visits",
        color: "var(--series-1)",
        points: traffic.estimatesByDay.map((d) => ({ x: d.date, y: metric === "rank" ? d.rank : d.visits })),
      },
    ];
  }, [traffic, metric]);

  const exportJson = () => {
    const data = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.status === "ok" ? v.data : { error: v.status === "error" ? v.error : "pending" }]));
    download(`trafficlens-${slug(domain)}.json`, JSON.stringify({ domain, hostname, generatedAt: new Date().toISOString(), ...data }, null, 2), "application/json");
  };

  const ageYears = reg?.ageYears ?? hist?.ageYears ?? null;
  const pending = SECTION_KEYS.filter((n) => s[n].status === "loading");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface">
            <Favicon src={home?.seo.favicon} size={22} fallback={<Globe className="h-5 w-5 text-ink-3" aria-hidden />} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-ink">{hostname}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <a href={siteUrl} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1 text-sm text-accent-ink hover:underline">
                Visit site <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
              {pending.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-3" role="status">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  Loading {pending.length} more section{pending.length === 1 ? "" : "s"}…
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/compare?domains=${encodeURIComponent(domain)}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-surface-2">
            Compare
          </Link>
          <button type="button" onClick={exportJson} disabled={pending.length > 0} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-surface-2 disabled:opacity-50">
            <Download className="h-4 w-4" aria-hidden /> Export JSON
          </button>
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {s.traffic.status === "loading" ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[98px] rounded-[14px]" />)
        ) : s.traffic.status === "error" ? (
          <div className="col-span-2 md:col-span-3">
            <ErrorNote title="Traffic data unavailable" message={s.traffic.error} onRetry={() => retry("traffic")} />
          </div>
        ) : (
          <>
            <Stat
              label="Est. monthly visits (all sources)"
              value={traffic?.estimate ? `~${fmtCompact(traffic.estimate.mid)}` : `< ${fmtCompact(UNRANKED_CEILING)}`}
              sub={
                <>
                  {traffic?.estimate ? `Range ${fmtCompact(traffic.estimate.low)} – ${fmtCompact(traffic.estimate.high)}` : "Not in the top 1M sites"}
                  <span className="block">
                    <MethodLink anchor="other-tools">Why other tools differ</MethodLink>
                  </span>
                </>
              }
              hint="All visits (search, direct, social and referral), estimated from the popularity rank. Tools like Ahrefs show organic search traffic only, from a different model."
            />
            <Stat
              label="Popularity rank (all sources)"
              value={fmtRank(rank)}
              sub={traffic?.popularity.change !== null && traffic?.popularity.change !== undefined ? <><Delta value={traffic.popularity.change} /> over {traffic.popularity.ranks.length} days</> : "Global, all categories"}
            />
            <Stat label="Popularity tier" value={traffic?.tier.label ?? "—"} sub={traffic?.tier.description} />
          </>
        )}
        <Stat label="Domain age" value={s.registration.status === "loading" && s.history.status === "loading" ? <Skeleton className="mt-1 h-7 w-24" /> : fmtYears(ageYears)} sub={reg?.registeredAt ? `Registered ${fmtDate(reg.registeredAt)}` : hist?.firstCapture ? `First archived ${fmtDate(hist.firstCapture)}` : undefined} />
        {auth?.enabled ? (
          <Stat label="Authority (Open PageRank)" value={auth.value ? `${auth.value.score}/10` : "—"} sub={auth.value?.rank ? `Link-graph rank #${fmtNumber(auth.value.rank)}` : "From Common Crawl link graph"} />
        ) : (
          <Stat label="Homepage SEO score" value={home ? `${home.score}/100` : s.homepage.status === "loading" ? <Skeleton className="mt-1 h-7 w-20" /> : "—"} sub={home ? `${home.checks.filter((c) => c.status === "fail").length} failed checks` : undefined} />
        )}
      </div>

      <Card>
        <CardHeader
          title="Popularity trend"
          subtitle={traffic?.popularity.ranks.length ? `Daily popularity rank, ${fmtDate(traffic.popularity.ranks[0].date)} – ${fmtDate(traffic.popularity.latest?.date)}` : undefined}
          source="all sources"
          action={
            traffic?.estimatesByDay.length ? (
              <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Metric">
                {(["rank", "visits"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMetric(m)} aria-pressed={metric === m} className={cx("rounded-md px-2.5 py-1 text-xs", metric === m ? "bg-surface-2 font-medium text-ink" : "text-ink-3 hover:text-ink")}>
                    {m === "rank" ? "Rank" : "Est. visits"}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        />
        <div className="p-5">
          <SectionBody state={s.traffic} rows={5} onRetry={() => retry("traffic")}>
            {(t) =>
              t.estimatesByDay.length ? (
                <>
                  <LineChart
                    series={chartSeries}
                    invertY={metric === "rank"}
                    integer={metric === "rank"}
                    area={metric === "visits"}
                    yFormat={(n, step) =>
                      metric === "rank" ? (n >= 1_000_000 ? `#${fmtCompact(n)}` : `#${fmtNumber(n)}`) : step === undefined ? fmtCompact(n) : fmtAxis(n, step)
                    }
                    xFormat={(x) => fmtDate(x, { month: "short", day: "numeric" })}
                    ariaLabel={`${metric === "rank" ? "Popularity rank" : "Estimated visits"} for ${domain} over the last ${t.estimatesByDay.length} days`}
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
                    <span>{metric === "rank" ? "Lower is better: #1 is the most popular site on the web." : "Modeled from rank; treat as an order-of-magnitude guide."}</span>
                    <MethodLink anchor="traffic" />
                  </div>
                </>
              ) : (
                <div className="py-8 text-center">
                  <p className="font-medium text-ink">{domain} isn&apos;t in the top 1 million sites</p>
                  <p className="mt-1 text-sm text-ink-3">That usually means fewer than ~{fmtCompact(UNRANKED_CEILING)} visits per month. Rankings track registrable domains, so subdomains share their parent&apos;s rank.</p>
                </div>
              )
            }
          </SectionBody>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Top keywords"
          icon={<Search className="h-4 w-4 text-ink-3" aria-hidden />}
          subtitle={keywordsSubtitle(s.keywords.status === "ok" ? s.keywords.data : null)}
          source={
            s.keywords.status !== "ok"
              ? undefined
              : s.keywords.data.source === "dataforseo"
                ? "DataForSEO"
                : s.keywords.data.volumeSource === "google-ads"
                  ? "title & headings + Google Ads"
                  : "title & headings + search suggestions"
          }
        />
        <SectionBody state={s.keywords} rows={5} onRetry={() => retry("keywords")}>
          {(k) => <TopKeywords data={k} />}
        </SectionBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Homepage SEO snapshot" icon={<Stethoscope className="h-4 w-4 text-ink-3" aria-hidden />} source="live fetch" />
          <SectionBody state={s.homepage} rows={6} onRetry={() => retry("homepage")}>
            {(h) => (
              <div className="space-y-4 p-5">
                <div className="flex items-center gap-5">
                  <ScoreGauge score={h.score} size={96} label="Homepage SEO score" />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex flex-wrap gap-1.5">
                      <StatusPill status={h.seo.indexable ? "pass" : "fail"} label={h.seo.indexable ? "Indexable" : "Not indexable"} />
                      <Badge>HTTP {h.http.status}</Badge>
                      {h.http.redirects.length > 0 && <Badge tone="accent">{h.http.redirects.length} redirect{h.http.redirects.length > 1 ? "s" : ""}</Badge>}
                    </div>
                    <p className="mt-2 text-ink-2">
                      {h.content.wordCount.toLocaleString("en-US")} words · {h.links.internal} internal / {h.links.external} external links · {h.images.total} images
                    </p>
                  </div>
                </div>
                <SerpPreview serp={h.serp} favicon={h.seo.favicon} />
                <ChecksList checks={h.checks.filter((c) => c.status === "fail" || c.status === "warn")} limit={5} />
                <Link href={`/analyzer?url=${encodeURIComponent(h.finalUrl)}`} className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
                  Full on-page analysis <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            )}
          </SectionBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Technology stack" icon={<Cpu className="h-4 w-4 text-ink-3" aria-hidden />} source="headers & HTML" />
            <SectionBody state={s.homepage} rows={4} onRetry={() => retry("homepage")}>
              {(h) => (
                <div className="p-5">
                  <TechStack technologies={h.technologies} />
                </div>
              )}
            </SectionBody>
          </Card>
          <Card>
            <CardHeader title="Crawlability" icon={<Link2 className="h-4 w-4 text-ink-3" aria-hidden />} source="robots.txt & sitemaps" />
            <SectionBody state={s.crawlability} rows={4} onRetry={() => retry("crawlability")}>
              {(c) => (
                <div className="p-5">
                  <KeyValue
                    rows={[
                      ["robots.txt", c.robots.found ? <StatusPill status="pass" label="Found" /> : <StatusPill status="info" label="Not found (all bots allowed)" />],
                      [
                        "Search engines",
                        !c.robots.access.googlebot ? (
                          <StatusPill status="fail" label="Googlebot blocked" />
                        ) : !c.robots.access.bingbot ? (
                          <StatusPill status="warn" label="Bingbot blocked" />
                        ) : (
                          <StatusPill status="pass" label="Allowed" />
                        ),
                      ],
                      ["Other bots", c.robots.access.otherBots ? "Allowed" : <StatusPill status="info" label="Blocked (site's choice)" />],
                      [
                        "Pages in XML sitemaps",
                        !c.sitemap.checked.length ? (
                          <StatusPill status="warn" label="No sitemap found" />
                        ) : c.sitemap.partial && c.sitemap.urlCount === 0 ? (
                          <StatusPill status="unknown" label="Too large to count quickly" />
                        ) : (
                          <span key="n" title={c.sitemap.partial ? "Only part of the sitemaps could be read in time, so this is a minimum" : undefined}>
                            {fmtNumber(c.sitemap.urlCount)}
                            {c.sitemap.partial ? "+" : ""}
                          </span>
                        ),
                      ],
                      ["Sitemap last updated", fmtDate(c.sitemap.latestLastmod)],
                      ["Crawl delay (Bing)", c.robots.crawlDelay ? `${c.robots.crawlDelay}s` : "None"],
                    ]}
                  />
                  <Link href={`/audit?url=${encodeURIComponent(siteUrl)}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
                    Run a full site audit <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              )}
            </SectionBody>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Server & performance" icon={<Server className="h-4 w-4 text-ink-3" aria-hidden />} source="live fetch" />
          <SectionBody state={s.homepage} onRetry={() => retry("homepage")}>
            {(h) => (
              <div className="p-5">
                <KeyValue
                  rows={[
                    ["Time to first byte", <span key="t" className="tabular">{fmtMs(h.http.ttfbMs)} <span className="text-ink-3">(from our server)</span></span>],
                    ["HTML size", `${fmtBytes(h.http.htmlBytes)} (${fmtBytes(h.http.transferBytes)} transferred)`],
                    ["Compression", h.http.contentEncoding ?? <StatusPill status="warn" label="None" />],
                    ["Server", h.http.server ?? "Not disclosed"],
                    ["IP address", h.http.remoteAddress ?? "—"],
                    ["Final URL", <span key="u" className="break-all">{h.finalUrl}</span>],
                  ]}
                />
              </div>
            )}
          </SectionBody>
        </Card>
        <Card>
          <CardHeader title="Security" icon={<ShieldCheck className="h-4 w-4 text-ink-3" aria-hidden />} source="TLS handshake & headers" />
          <SectionBody state={s.homepage} onRetry={() => retry("homepage")}>
            {(h) => (
              <div className="p-5">
                <KeyValue
                  rows={[
                    ["HTTPS", h.finalUrl.startsWith("https:") ? <StatusPill status="pass" label="Yes" /> : <StatusPill status="fail" label="No" />],
                    ["Certificate issuer", h.tls?.issuer ?? "—"],
                    ["Certificate expires", h.tls?.validTo ? <span key="e">{fmtDate(h.tls.validTo)} <span className={h.tls.daysRemaining !== null && h.tls.daysRemaining < 14 ? "text-bad-ink" : "text-ink-3"}>({h.tls.daysRemaining} days)</span></span> : "—"],
                    ["TLS version", h.tls?.protocol ?? "—"],
                    ["HSTS", h.http.securityHeaders["strict-transport-security"] ? <StatusPill status="pass" label="Enabled" /> : <StatusPill status="warn" label="Missing" />],
                    ["Content-Security-Policy", h.http.securityHeaders["content-security-policy"] ? <StatusPill status="pass" label="Set" /> : <StatusPill status="info" label="Not set" />],
                  ]}
                />
              </div>
            )}
          </SectionBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Domain registration" icon={<Lock className="h-4 w-4 text-ink-3" aria-hidden />} source="RDAP" />
          <SectionBody state={s.registration} onRetry={() => retry("registration")}>
            {(r) =>
              r ? (
                <div className="p-5">
                  <KeyValue
                    rows={[
                      ["Registrar", r.registrar ?? "Not disclosed"],
                      ["Registered", fmtDate(r.registeredAt)],
                      ["Expires", fmtDate(r.expiresAt)],
                      ["Last updated", fmtDate(r.updatedAt)],
                      ["DNSSEC", r.dnssec === null ? "—" : r.dnssec ? <StatusPill status="pass" label="Signed" /> : <StatusPill status="info" label="Unsigned" />],
                    ]}
                  />
                </div>
              ) : (
                <p className="p-5 text-sm text-ink-3">No registration record was found for {domain}.</p>
              )
            }
          </SectionBody>
        </Card>
        <Card>
          <CardHeader title="DNS & email" icon={<Globe className="h-4 w-4 text-ink-3" aria-hidden />} source="DNS" />
          <SectionBody state={s.dns} onRetry={() => retry("dns")}>
            {(d) => (
              <div className="p-5">
                <KeyValue
                  rows={[
                    ["DNS provider", d.dnsProvider ?? (d.ns.length ? d.ns.slice(0, 2).join(", ") : "—")],
                    ["IPv4 / IPv6", `${d.a.length ? d.a.slice(0, 3).join(", ") : "none"}${d.aaaa.length ? ` · ${d.aaaa.length} IPv6` : " · no IPv6"}`],
                    ["Email provider", d.mailProvider ?? (d.mx.length ? d.mx[0].exchange : "No MX records")],
                    ["SPF", d.spf ? <StatusPill status="pass" label="Published" /> : d.failed.includes("TXT") ? <StatusPill status="unknown" label="Lookup failed" /> : <StatusPill status="warn" label="Missing" />],
                    [
                      "DMARC",
                      d.dmarc ? (
                        <StatusPill status={d.dmarcPolicy === "none" ? "warn" : "pass"} label={`p=${d.dmarcPolicy ?? "?"}`} />
                      ) : d.failed.includes("DMARC") ? (
                        <StatusPill status="unknown" label="Lookup failed" />
                      ) : (
                        <StatusPill status="warn" label="Missing" />
                      ),
                    ],
                    ["CAA", d.caa.length ? d.caa.slice(0, 2).join(", ") : "None"],
                  ]}
                />
              </div>
            )}
          </SectionBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="History" icon={<History className="h-4 w-4 text-ink-3" aria-hidden />} source={<a className="underline-offset-2 hover:underline" href="https://web.archive.org" target="_blank" rel="noreferrer">Internet Archive</a>} />
        <SectionBody state={s.history} rows={2} onRetry={() => retry("history")}>
          {(h) =>
            h.firstCapture ? (
              <div className="p-5">
                <p className="text-sm text-ink-2">
                  First archived on <span className="font-medium text-ink">{fmtDate(h.firstCapture)}</span>
                  {h.years && `, with snapshots in ${h.years.length} different years`}
                  {h.lastCapture && (
                    <>
                      ; latest snapshot <span className="font-medium text-ink">{fmtDate(h.lastCapture)}</span>
                    </>
                  )}
                  .{" "}
                  {h.firstSnapshotUrl && (
                    <a className="text-accent-ink hover:underline" href={h.firstSnapshotUrl} target="_blank" rel="noreferrer">
                      See the oldest snapshot
                    </a>
                  )}
                </p>
                {h.years ? (
                  <YearStrip years={h.years} until={h.checkedYear} />
                ) : (
                  <p className="mt-2 text-xs text-ink-3">The archive didn&apos;t return its year-by-year breakdown in time (common for very large sites). The dates above are complete.</p>
                )}
              </div>
            ) : (
              <p className="p-5 text-sm text-ink-3">The Internet Archive has no snapshots of this domain.</p>
            )
          }
        </SectionBody>
      </Card>

      <Card>
        <CardHeader title="Core Web Vitals" icon={<Gauge className="h-4 w-4 text-ink-3" aria-hidden />} subtitle="Lighthouse lab test plus real Chrome user data, run on demand." source="Google PageSpeed Insights" />
        <div className="p-5">
          <PageSpeedPanel url={siteUrl} />
        </div>
      </Card>
    </div>
  );
}

/** Which years the site has archive snapshots in, from first year to now. */
function YearStrip({ years, until }: { years: number[]; until: number }) {
  if (!years.length) return null;
  const set = new Set(years);
  const first = years[0];
  const last = Math.max(until, years[years.length - 1]);
  const all = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  return (
    <div className="mt-4">
      <div className="inline-block max-w-full">
        <div className="flex flex-wrap gap-1" role="list" aria-label="Years with archived snapshots">
          {all.map((y) => (
            <span
              key={y}
              role="listitem"
              title={`${y}: ${set.has(y) ? "archived" : "no snapshots"}`}
              aria-label={`${y}: ${set.has(y) ? "archived" : "no snapshots"}`}
              className={cx("h-4 w-4 rounded-[3px]", set.has(y) ? "bg-[var(--series-1)]" : "bg-surface-3")}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-ink-3">
          <span>{first}</span>
          <span>{last}</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-ink-3">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--series-1)]" aria-hidden />Archived</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-surface-3" aria-hidden />No snapshots</span>
      </div>
    </div>
  );
}
