"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Search, Sparkles, Check as CheckIcon } from "lucide-react";
import type { Intent, KeywordGroup, KeywordIdea, KeywordReport } from "@/lib/keywords/expand";
import type { SuggestSource } from "@/lib/sources/autocomplete";
import { errorMessage } from "@/lib/client/ndjson";
import { addRecent } from "@/lib/client/recent";
import { download, slug, toCsv } from "@/lib/client/csv";
import { fmtDuration } from "@/lib/client/format";
import { Checkbox, ToolForm } from "../ToolForm";
import { RecentSearches } from "../RecentSearches";
import { AdSlot } from "../AdSlot";
import { DataTable, FilterInput, Tabs, type Column } from "../DataTable";
import { Badge, Card, ErrorNote, MethodLink, Meter, PageHeader, Skeleton, StatusPill, cx } from "../ui";

const SOURCES: { id: SuggestSource; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "bing", label: "Bing" },
  { id: "youtube", label: "YouTube" },
  { id: "duckduckgo", label: "DuckDuckGo" },
  { id: "amazon", label: "Amazon (US)" },
];

const COUNTRIES: [string, string][] = [
  ["us", "United States"],
  ["gb", "United Kingdom"],
  ["ca", "Canada"],
  ["au", "Australia"],
  ["in", "India"],
  ["ie", "Ireland"],
  ["nz", "New Zealand"],
  ["za", "South Africa"],
  ["de", "Germany"],
  ["fr", "France"],
  ["es", "Spain"],
  ["it", "Italy"],
  ["nl", "Netherlands"],
  ["se", "Sweden"],
  ["br", "Brazil"],
  ["mx", "Mexico"],
  ["jp", "Japan"],
];

const LANGUAGES: [string, string][] = [
  ["en", "English"],
  ["de", "German"],
  ["fr", "French"],
  ["es", "Spanish"],
  ["it", "Italian"],
  ["nl", "Dutch"],
  ["sv", "Swedish"],
  ["pt", "Portuguese"],
  ["ja", "Japanese"],
  ["hi", "Hindi"],
];

const INTENT_TONE: Record<Intent, "neutral" | "accent" | "good" | "warn"> = {
  Informational: "neutral",
  Commercial: "accent",
  Transactional: "good",
  Navigational: "warn",
};

const SOURCE_SHORT: Record<SuggestSource, string> = { google: "G", bing: "B", youtube: "YT", duckduckgo: "DDG", amazon: "A" };

type GroupTab = "all" | KeywordGroup;

export function KeywordsTool() {
  const params = useSearchParams();
  const router = useRouter();
  const q = (params.get("q") ?? "").trim();
  const gl = params.get("gl") ?? "us";
  const hl = params.get("hl") ?? "en";
  const depth = params.get("depth") === "deep" ? "deep" : "quick";
  const sourcesParam = params.get("sources") ?? "google,bing,youtube,duckduckgo";
  const [form, setForm] = useState({ gl, hl, depth, sources: new Set(sourcesParam.split(",") as SuggestSource[]) });

  const key = q ? `${q}|${gl}|${hl}|${depth}|${sourcesParam}` : "";
  const [loaded, setLoaded] = useState<{ key: string; report: KeywordReport | null; error: string | null }>({ key: "", report: null, error: null });
  const state = loaded.key === key ? { ...loaded, loading: false } : { key, report: null, error: null, loading: !!key };

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    addRecent("keywords", q);
    fetch(`/api/v1/keywords?${new URLSearchParams({ q, gl, hl, depth, sources: sourcesParam })}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorMessage(res));
        setLoaded({ key, report: await res.json(), error: null });
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setLoaded({ key, report: null, error: (err as Error).message });
      });
    return () => ctrl.abort();
  }, [key, q, gl, hl, depth, sourcesParam]);

  const submit = (value: string) => {
    const sources = [...form.sources].filter(Boolean).join(",") || "google";
    router.push(`/keywords?${new URLSearchParams({ q: value, gl: form.gl, hl: form.hl, depth: form.depth, sources })}`);
  };

  return (
    <div>
      <PageHeader
        icon={<Sparkles className="h-7 w-7 text-accent-ink" aria-hidden />}
        title="Keyword generator"
        description="Find hundreds of real searches around a topic, straight from search engine autocomplete, grouped into questions, comparisons and topic clusters, with search intent for each."
      />
      <ToolForm initial={q} label="Seed keyword" placeholder="Enter a seed keyword, e.g. coffee grinder" button="Find keywords" busy={state.loading} onSubmit={submit}>
        <label className="inline-flex items-center gap-2">
          Country
          <select value={form.gl} onChange={(e) => setForm((f) => ({ ...f, gl: e.target.value }))} className="h-8 rounded-md border border-line bg-bg px-2 text-sm text-ink">
            {COUNTRIES.map(([c, name]) => (
              <option key={c} value={c}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-2">
          Language
          <select value={form.hl} onChange={(e) => setForm((f) => ({ ...f, hl: e.target.value }))} className="h-8 rounded-md border border-line bg-bg px-2 text-sm text-ink">
            {LANGUAGES.map(([c, name]) => (
              <option key={c} value={c}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-2">
          Depth
          <select value={form.depth} onChange={(e) => setForm((f) => ({ ...f, depth: e.target.value === "deep" ? "deep" : "quick" }))} className="h-8 rounded-md border border-line bg-bg px-2 text-sm text-ink">
            <option value="quick">Quick (~25 queries per source)</option>
            <option value="deep">Deep (+ A–Z, ~55 per source)</option>
          </select>
        </label>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {SOURCES.map((s) => (
            <Checkbox
              key={s.id}
              checked={form.sources.has(s.id)}
              onChange={(v) =>
                setForm((f) => {
                  const next = new Set(f.sources);
                  if (v) next.add(s.id);
                  else next.delete(s.id);
                  return { ...f, sources: next };
                })
              }
            >
              {s.label}
            </Checkbox>
          ))}
        </span>
      </ToolForm>
      <RecentSearches tool="keywords" exclude={q} className="-mt-3 mb-6" />

      {state.error && <ErrorNote title="Couldn't fetch keyword ideas" message={state.error} />}
      {state.loading && (
        <div className="space-y-3">
          <p className="text-sm text-ink-3">Querying search engines… this takes 5–20 seconds.</p>
          <Skeleton className="h-12 rounded-[14px]" />
          <Skeleton className="h-96 rounded-[14px]" />
        </div>
      )}
      {state.report && <KeywordResults report={state.report} />}
      {!q && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["What people actually type", "Autocomplete suggestions are real, popular searches. We query each engine with question words, prepositions and modifiers to surface the long tail."],
            ["Grouped for you", "Questions for FAQ and blog ideas, comparisons for “vs” pages, and topic clusters to plan content hubs."],
            ["Honest scoring", "The suggest score reflects how prominently engines suggest a phrase. It's a relative signal, not a search-volume estimate."],
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

function KeywordResults({ report }: { report: KeywordReport }) {
  const [group, setGroup] = useState<GroupTab>("all");
  const [intent, setIntent] = useState<Intent | "all">("all");
  const [cluster, setCluster] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [copied, setCopied] = useState(false);

  const groupCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of report.ideas) c.set(i.group, (c.get(i.group) ?? 0) + 1);
    return c;
  }, [report.ideas]);

  const rows = report.ideas.filter(
    (i) =>
      (group === "all" || i.group === group) &&
      (intent === "all" || i.intent === intent) &&
      (!cluster || i.cluster === cluster) &&
      (!filter || i.keyword.includes(filter.toLowerCase())),
  );

  const columns: Column<KeywordIdea>[] = [
    {
      key: "keyword",
      header: "Keyword",
      sortValue: (i) => i.keyword,
      render: (i) => (
        <span className="flex items-center gap-2">
          <span className="text-ink">{i.keyword}</span>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(i.keyword)}`}
            target="_blank"
            rel="noreferrer"
            className="text-ink-3 hover:text-accent-ink"
            title="See the live results page"
            aria-label={`Search Google for ${i.keyword}`}
          >
            <Search className="h-3.5 w-3.5" />
          </a>
        </span>
      ),
    },
    { key: "score", header: "Suggest score", sortValue: (i) => i.score, render: (i) => <Meter value={i.score} label={`Best position #${i.bestPosition}, seen ${i.appearances}×`} /> },
    { key: "intent", header: "Intent", sortValue: (i) => i.intent, render: (i) => <Badge tone={INTENT_TONE[i.intent]}>{i.intent}</Badge> },
    { key: "group", header: "Type", sortValue: (i) => i.group, render: (i) => <span className="text-xs text-ink-2">{i.group}</span> },
    { key: "words", header: "Words", align: "right", sortValue: (i) => i.words, render: (i) => i.words },
    {
      key: "sources",
      header: "Sources",
      sortValue: (i) => i.sources.length,
      render: (i) => (
        <span className="flex gap-1">
          {i.sources.map((s) => (
            <span key={s} title={SOURCES.find((x) => x.id === s)?.label} className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-2">
              {SOURCE_SHORT[s]}
            </span>
          ))}
        </span>
      ),
    },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rows.map((r) => r.keyword).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink">{report.ideas.length.toLocaleString("en-US")} keyword ideas</span> for “{report.seed}” from {report.queriesRun} autocomplete queries in {fmtDuration(report.elapsedMs)}.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {report.sourceStatus.map((s) => (
            <StatusPill
              key={s.source}
              status={s.ok === 0 ? "fail" : s.failed ? "warn" : "pass"}
              label={`${SOURCES.find((x) => x.id === s.source)?.label}: ${s.ok === 0 ? "unavailable" : `${s.suggestions} suggestions`}`}
            />
          ))}
        </div>
      </div>

      {report.clusters.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium text-ink-3">Topic clusters</div>
          <div className="flex flex-wrap gap-1.5">
            {report.clusters.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setCluster((cur) => (cur === c.name ? null : c.name))}
                aria-pressed={cluster === c.name}
                className={cx("rounded-full border px-3 py-1 text-xs transition-colors", cluster === c.name ? "border-transparent bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:text-ink")}
              >
                {c.name} <span className="opacity-70">{c.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Card>
        <Tabs<GroupTab>
          active={group}
          onChange={setGroup}
          tabs={[
            { id: "all", label: `All (${report.ideas.length})` },
            ...(["Questions", "Comparisons", "Prepositions", "Long-tail", "Related"] as KeywordGroup[]).map((g) => ({ id: g, label: `${g} (${groupCounts.get(g) ?? 0})` })),
          ]}
        />
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <FilterInput value={filter} onChange={setFilter} placeholder="Filter keywords" />
          <select value={intent} onChange={(e) => setIntent(e.target.value as Intent | "all")} className="h-9 rounded-lg border border-line bg-bg px-2 text-sm text-ink" aria-label="Intent filter">
            <option value="all">All intents</option>
            <option value="Informational">Informational</option>
            <option value="Commercial">Commercial</option>
            <option value="Transactional">Transactional</option>
            <option value="Navigational">Navigational</option>
          </select>
          {cluster && (
            <button type="button" onClick={() => setCluster(null)} className="text-sm text-accent-ink hover:underline">
              Clear cluster “{cluster}”
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-surface-2">
              {copied ? <CheckIcon className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? "Copied" : `Copy ${rows.length}`}
            </button>
            <button
              type="button"
              onClick={() =>
                download(
                  `keywords-${slug(report.seed)}.csv`,
                  toCsv(rows.map((r) => ({ keyword: r.keyword, suggest_score: r.score, intent: r.intent, type: r.group, cluster: r.cluster, words: r.words, sources: r.sources.join(" "), best_position: r.bestPosition }))),
                )
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-surface-2"
            >
              <Download className="h-4 w-4" aria-hidden /> CSV
            </button>
          </div>
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(i) => i.keyword} initialSort={{ key: "score", dir: "desc" }} pageSize={50} minWidth={640} empty="No keywords match these filters." />
        <div className="border-t border-line px-5 py-3">
          <MethodLink anchor="keywords">How the suggest score and intent are computed</MethodLink>
        </div>
      </Card>
      <AdSlot />
    </div>
  );
}
