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
  return data.source === "dataforseo" ? <RankedList data={data} /> : <SiteList data={data} />;
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
                  <td className="w-full max-w-0 py-2.5 pl-5 pr-2 wrap-anywhere">
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

function SiteList({ data }: { data: Extract<KeywordsSection, { source: "site" }> }) {
  const estimated = data.volumeSource === "estimate";
  return (
    <div>
      {data.note && (
        <p className="mx-5 mt-4 flex gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn-ink">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {data.note}
        </p>
      )}
      {data.keywords.length ? (
        <div className="mt-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="py-2 pl-5 pr-2 font-medium">Keyword</th>
                <th className="px-2 py-2 font-medium">Demand</th>
                <th className="py-2 pl-2 pr-5 text-right font-medium sm:whitespace-nowrap" title={estimated ? "Rough estimates of monthly searches" : "Average monthly searches, from Google Ads"}>
                  Volume{estimated && <span className="font-normal"> (est.)</span>}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.keywords.map((k) => (
                <tr key={k.keyword}>
                  <td className="w-full max-w-0 py-2.5 pl-5 pr-2 wrap-anywhere">
                    <Link href={ideasHref(k.keyword, data.market)} className="font-medium text-ink hover:text-accent-ink hover:underline">
                      {k.keyword}
                    </Link>
                    <div className="truncate text-xs text-ink-3">{k.foundIn.map((o) => ORIGIN_LABEL[o]).join(" · ")}</div>
                  </td>
                  <td className="px-2 py-2.5">
                    <DemandBar keyword={k} />
                  </td>
                  <td className="tabular whitespace-nowrap py-2.5 pl-2 pr-5 text-right">
                    {k.estimated ? (
                      <span title={`Rough estimate${k.typedPrefix ? `: suggested after typing “${k.typedPrefix}”` : ""}. Can be off by 10× or more.`}>~{fmtCompact(k.volume)}</span>
                    ) : (
                      fmtCompact(k.volume)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-6 text-sm text-ink-2">
          {data.jsRendered
            ? "This homepage builds its content with JavaScript, so there was too little text to find the phrases it targets."
            : estimated
              ? "None of the phrases in this homepage's title and headings come up in search suggestions yet. That's common for new or niche sites."
              : "None of the phrases in this homepage's title and headings get measurable Google searches yet. That's common for new or niche sites."}
        </p>
      )}
      <Footer market={data.market} keyword={data.keywords[0]?.keyword}>
        {estimated ? (
          <>
            Found in the site&apos;s brand, title and headings. Volumes are rough estimates from how readily {data.engine === "duckduckgo" ? "DuckDuckGo" : "Google"} suggests each phrase and can be off
            by 10× or more.
          </>
        ) : (
          <>Found in the site&apos;s brand, title and headings. Volumes are average monthly Google searches {inMarket(data.market)}, from Google Ads Keyword Planner.</>
        )}
      </Footer>
    </div>
  );
}

/** Bar on a log scale: 10 searches a month is empty, a million or more is full. */
function DemandBar({ keyword: k }: { keyword: TargetKeyword }) {
  const tone = k.level === "High" ? "bg-accent" : k.level === "Medium" ? "bg-accent/70" : "bg-accent/40";
  const width = Math.min(100, Math.max(4, ((Math.log10(Math.max(10, k.volume)) - 1) / 5) * 100));
  return (
    <div className="flex items-center gap-2 sm:w-44">
      <div className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-accent-soft sm:block" aria-hidden>
        <div className={cx("h-full rounded-full", tone)} style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs text-ink-2 sm:w-14 sm:text-right">{k.level}</span>
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
