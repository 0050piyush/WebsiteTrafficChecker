import type { Metadata } from "next";
import { Braces } from "lucide-react";
import { Badge, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "REST API",
  description: "Free JSON API for website traffic estimates, SEO page analysis, site audits, link checking and keyword ideas.",
};

const ENDPOINTS: { method: "GET" | "POST"; path: string; summary: string; params: [string, string][]; example: string; notes?: string }[] = [
  {
    method: "GET",
    path: "/api/v1/overview",
    summary: "Everything about a domain: traffic, top keywords, homepage SEO, tech stack, crawlability, registration, DNS and history.",
    params: [
      ["domain", "Required. A domain or URL, e.g. example.com"],
      ["format", "Optional. json returns one object; the default streams NDJSON, one line per section as it completes."],
      ["sections", "Optional. Comma-separated subset to run: traffic, homepage, crawlability, keywords, registration, dns, history, authority."],
    ],
    example: "curl -N 'https://YOUR-HOST/api/v1/overview?domain=example.com'",
  },
  {
    method: "GET",
    path: "/api/v1/traffic",
    summary: "Popularity rank history and estimated monthly visits for up to 8 domains.",
    params: [["domains", "Required. Comma-separated list, e.g. a.com,b.com"]],
    example: "curl 'https://YOUR-HOST/api/v1/traffic?domains=github.com,gitlab.com'",
  },
  {
    method: "GET",
    path: "/api/v1/analyze",
    summary: "Full on-page SEO report for one URL with 40+ scored checks.",
    params: [
      ["url", "Required. Page URL."],
      ["keyword", "Optional. Target keyword to evaluate placement and density."],
    ],
    example: "curl 'https://YOUR-HOST/api/v1/analyze?url=https://example.com/&keyword=example'",
  },
  {
    method: "POST",
    path: "/api/v1/links",
    summary: "HTTP status of up to 150 URLs (HEAD with GET fallback).",
    params: [["body", '{ "urls": ["https://…", …] }']],
    example: `curl -X POST 'https://YOUR-HOST/api/v1/links' -H 'content-type: application/json' -d '{"urls":["https://example.com/"]}'`,
  },
  {
    method: "GET",
    path: "/api/v1/audit",
    summary: "Live site crawl. Streams NDJSON events (start, info, page, phase, progress) and ends with a done event containing the full report.",
    params: [
      ["url", "Required. Start URL."],
      ["maxPages", "Optional, to crawl fewer pages. Free: up to 200 (the default, set by MAX_AUDIT_PAGES). Pro and Agency: no page limit unless you set one. Every audit stops after about 5 minutes."],
      ["concurrency", "Optional. 1–5, default 4."],
      ["respectRobots, checkExternal, checkResources, useSitemap", "Optional booleans (1/0), all default 1."],
    ],
    example: "curl -N 'https://YOUR-HOST/api/v1/audit?url=https://example.com&maxPages=50'",
    notes: "One running audit per client IP, 10 audits per hour.",
  },
  {
    method: "GET",
    path: "/api/v1/keywords",
    summary: "Keyword ideas from search engine autocomplete, with suggest score, intent, type and cluster.",
    params: [
      ["q", "Required. Seed keyword."],
      ["gl / hl", "Optional. Country and language codes, default us / en."],
      ["depth", "Optional. quick (default) or deep."],
      ["sources", "Optional. Comma-separated: google, bing, youtube, duckduckgo, amazon."],
    ],
    example: "curl 'https://YOUR-HOST/api/v1/keywords?q=coffee+grinder&depth=deep'",
  },
  {
    method: "GET",
    path: "/api/v1/pagespeed",
    summary: "Lighthouse scores, lab metrics, Chrome UX Report field data and top opportunities.",
    params: [
      ["url", "Required. Page URL."],
      ["strategy", "Optional. mobile (default) or desktop."],
    ],
    example: "curl 'https://YOUR-HOST/api/v1/pagespeed?url=https://example.com&strategy=mobile'",
  },
  {
    method: "GET",
    path: "/api/v1/status",
    summary: "Configured integrations and limits.",
    params: [],
    example: "curl 'https://YOUR-HOST/api/v1/status'",
  },
];

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        icon={<Braces className="h-7 w-7 text-accent-ink" aria-hidden />}
        title="REST API"
        description="Every tool in TrafficLens is available as a JSON API. No key is required; requests are rate limited per IP. Self-host to remove the limits."
      />
      <div className="card mb-8 p-5 text-sm text-ink-2">
        <p>
          Errors use HTTP status codes with a JSON body: <code className="rounded bg-surface-2 px-1">{'{ "error": { "code": "INVALID_URL", "message": "…" } }'}</code>. Rate-limited responses return <code>429</code> with a{" "}
          <code>Retry-After</code> header. Streaming endpoints return <code>application/x-ndjson</code>: read them line by line (<code>curl -N</code>).
        </p>
      </div>
      <div className="space-y-6">
        {ENDPOINTS.map((e) => (
          <section key={e.path} id={e.path.split("/").pop()} className="card scroll-mt-20 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
              <Badge tone={e.method === "GET" ? "good" : "accent"} className="font-mono">
                {e.method}
              </Badge>
              <code className="text-sm font-semibold text-ink">{e.path}</code>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <p className="text-ink-2">{e.summary}</p>
              {e.params.length > 0 && (
                <dl className="divide-y divide-line rounded-lg border border-line">
                  {e.params.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-1 gap-1 px-3 py-2 sm:grid-cols-[14rem_minmax(0,1fr)]">
                      <dt>
                        <code className="text-xs text-ink">{k}</code>
                      </dt>
                      <dd className="text-ink-2">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {e.notes && <p className="text-xs text-ink-3">{e.notes}</p>}
              <pre className="overflow-x-auto rounded-lg bg-surface-2 px-3 py-2.5 font-mono text-xs text-ink">{e.example}</pre>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
