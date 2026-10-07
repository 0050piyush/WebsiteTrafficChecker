import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import type { KeywordsSection } from "@/lib/overview";
import type { KeywordOrigin, TargetKeyword } from "@/lib/keywords/site-keywords";
import type { Market } from "@/lib/markets";
import { fmtCompact, fmtNumber, pathOf } from "@/lib/client/format";
import { MethodLink, cx } from "../ui";

const ORIGIN_LABEL: Record<KeywordOrigin, string> = { brand: "Brand name", title: "Page title", h1: "Main heading", h2: "Subheading", content: "Page text" };

/** "in the United States", "in Germany". */
const inMarket = (market: Market) => `in ${["United States", "United Kingdom", "Netherlands"].includes(market.name) ? "the " : ""}${market.name}`;

const ideasHref = (keyword: string, market: Market) => `/keywords?${new URLSearchParams({ q: keyword, gl: market.gl, hl: market.hl })}`;

/** One line for the card header: what the list is and where it comes from. */
export function keywordsSubtitle(data: KeywordsSection | null): string {
  if (!data) return "What people search for to find this site";
  return data.source === "dataforseo" ? `Google organic rankings ${inMarket(data.market)}` : `Phrases this site targets that people search for ${inMarket(data.market)}`;
}

export function TopKeywords({ data }: { data: KeywordsSection }) {
  return data.source === "dataforseo" ? <RankedList data={data} /> : <EstimatedList data={data} />;
}

function RankedList({ data }: { data: Extract<KeywordsSection, { source: "dataforseo" }> }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 px-5 pt-4 sm:max-w-md">
        <MiniStat label="Organic keywords" value={fmtNumber(data.totalKeywords)} />
        <MiniStat label="Organic traffic / month" value={data.organicTraffic === null ? "—" : `~${fmtCompact(data.organicTraffic)}`} />
      </div>
      {data.keywords.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="py-2 pl-5 pr-2 font-medium">Keyword</th>
                <th className="px-1.5 py-2 text-right font-medium sm:px-2">
                  <abbr title="Position" className="no-underline sm:hidden">Pos.</abbr>
                  <span className="hidden sm:inline">Position</span>
                </th>
                <th className="px-1.5 py-2 text-right font-medium sm:px-2">Volume</th>
                <th className="py-2 pl-1.5 pr-5 text-right font-medium sm:pl-2">Traffic</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.keywords.map((k) => (
                <tr key={k.keyword}>
                  <td className="w-full max-w-0 py-2.5 pl-5 pr-2">
                    <Link href={ideasHref(k.keyword, data.market)} className="font-medium text-ink hover:text-accent-ink hover:underline">
                      {k.keyword}
                    </Link>
                    {k.url && (
                      <div className="truncate text-xs text-ink-3" title={k.url}>
                        {pathOf(k.url) === "/" ? "Homepage" : pathOf(k.url)}
                      </div>
                    )}
                  </td>
                  <td className="tabular px-1.5 py-2.5 text-right sm:px-2">{k.position}</td>
                  <td className="tabular px-1.5 py-2.5 text-right sm:px-2">{k.volume === null ? "—" : fmtCompact(k.volume)}</td>
                  <td className="tabular py-2.5 pl-1.5 pr-5 text-right sm:pl-2">{k.traffic === null ? "—" : fmtNumber(k.traffic)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-6 text-sm text-ink-2">No Google rankings found for this domain {inMarket(data.market)}.</p>
      )}
      <Footer market={data.market} keyword={data.keywords[0]?.keyword}>
        Position, monthly search volume and estimated visits from Google {inMarket(data.market)}, from DataForSEO&apos;s ranking database.
      </Footer>
    </div>
  );
}

function EstimatedList({ data }: { data: Extract<KeywordsSection, { source: "estimated" }> }) {
  const rows = Math.ceil(data.keywords.length / 2);
  return (
    <div>
      {data.note && (
        <p className="mx-5 mt-4 flex gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn-ink">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {data.note}
        </p>
      )}
      {data.keywords.length ? (
        // Two columns on wide screens, read top to bottom like a ranked list.
        <ol className="lg:grid lg:grid-flow-col lg:gap-x-8 lg:px-5" style={{ gridTemplateRows: `repeat(${rows}, auto)` }}>
          {data.keywords.map((k, i) => (
            <li key={k.keyword} className={cx("flex items-center gap-3 border-line px-5 py-2.5 lg:px-0", i > 0 && "border-t", i === rows && "lg:border-t-0")}>
              <span className="tabular w-5 shrink-0 text-xs text-ink-3">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={ideasHref(k.keyword, data.market)} className="font-medium text-ink hover:text-accent-ink hover:underline">
                  {k.keyword}
                </Link>
                <div className="truncate text-xs text-ink-3">{k.foundIn.map((o) => ORIGIN_LABEL[o]).join(" · ")}</div>
              </div>
              <DemandBar keyword={k} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-5 py-6 text-sm text-ink-2">
          {data.jsRendered
            ? "This homepage builds its content with JavaScript, so there was too little text to find the phrases it targets."
            : "None of the phrases in this homepage's title and headings come up in search suggestions yet. That's common for new or niche sites."}
        </p>
      )}
      <Footer market={data.market} keyword={data.keywords[0]?.keyword} anchor="top-keywords">
        Found in the site&apos;s brand, title and headings, then ranked by how readily {data.engine === "google" ? "Google" : "DuckDuckGo"} suggests each one. Exact positions and search volumes
        need a paid ranking database.
      </Footer>
    </div>
  );
}

function DemandBar({ keyword: k }: { keyword: TargetKeyword }) {
  const tone = k.level === "High" ? "bg-accent" : k.level === "Medium" ? "bg-accent/70" : "bg-accent/40";
  return (
    <div className="flex w-32 shrink-0 items-center gap-2 sm:w-40" title={`Search demand ${k.demand}/100: suggested after typing “${k.typedPrefix}”`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-accent-soft" aria-hidden>
        <div className={cx("h-full rounded-full", tone)} style={{ width: `${k.demand}%` }} />
      </div>
      <span className="w-14 text-right text-xs text-ink-2">{k.level}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="text-lg font-semibold tracking-tight text-ink">{value}</div>
    </div>
  );
}

function Footer({ market, keyword, anchor = "top-keywords", children }: { market: Market; keyword?: string; anchor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-5 py-3 text-xs text-ink-3">
      <p className="max-w-2xl">
        {children} <MethodLink anchor={anchor} />
      </p>
      {keyword && (
        <Link href={ideasHref(keyword, market)} className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
          More keyword ideas <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
