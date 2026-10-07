import { TtlCache, memoizeAsync } from "../cache";
import { getJson } from "./http";

/**
 * Search-engine autocomplete endpoints. Suggestions are what real people type, ranked
 * by each engine by popularity, which makes them the best free keyword signal there is.
 */

export type SuggestSource = "google" | "youtube" | "bing" | "duckduckgo" | "amazon";

export const SUGGEST_SOURCES: { id: SuggestSource; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "youtube", label: "YouTube" },
  { id: "bing", label: "Bing" },
  { id: "duckduckgo", label: "DuckDuckGo" },
  { id: "amazon", label: "Amazon" },
];

export interface SuggestOptions {
  /** Interface language, e.g. "en". */
  hl: string;
  /** Country, e.g. "us". */
  gl: string;
}

const cache = new TtlCache<Promise<string[]>>(20_000, 6 * 60 * 60 * 1000);

/** OpenSearch suggestion format: ["query", ["suggestion 1", "suggestion 2", ...], ...] */
export function parseOpenSearch(json: unknown): string[] {
  if (!Array.isArray(json) || !Array.isArray(json[1])) return [];
  return (json[1] as unknown[])
    .map((s) => (typeof s === "string" ? s : Array.isArray(s) && typeof s[0] === "string" ? s[0] : ""))
    .map((s) => s.replace(/<\/?b>/g, "").trim())
    .filter(Boolean);
}

export function parseDuckDuckGo(json: unknown): string[] {
  // type=list returns OpenSearch format; the default returns [{ phrase }].
  if (Array.isArray(json) && json.length && typeof json[0] === "object" && json[0] !== null && !Array.isArray(json[0])) {
    return (json as { phrase?: string }[]).map((x) => x.phrase ?? "").filter(Boolean);
  }
  return parseOpenSearch(json);
}

export function parseAmazon(json: unknown): string[] {
  const list = (json as { suggestions?: { value?: string }[] })?.suggestions;
  return Array.isArray(list) ? list.map((s) => s.value ?? "").filter(Boolean) : [];
}

function endpoint(source: SuggestSource, q: string, { hl, gl }: SuggestOptions): string {
  const query = encodeURIComponent(q);
  switch (source) {
    case "google":
      return `https://suggestqueries.google.com/complete/search?client=firefox&hl=${hl}&gl=${gl}&ie=utf-8&oe=utf-8&q=${query}`;
    case "youtube":
      return `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=${hl}&gl=${gl}&ie=utf-8&oe=utf-8&q=${query}`;
    case "bing":
      return `https://api.bing.com/osjson.aspx?query=${query}&market=${hl}-${gl.toUpperCase()}`;
    case "duckduckgo":
      return `https://duckduckgo.com/ac/?q=${query}&type=list&kl=${gl}-${hl}`;
    case "amazon":
      return `https://completion.amazon.com/api/2017/suggestions?mid=ATVPDKIKX0DER&alias=aps&prefix=${query}`;
  }
}

export function fetchSuggestions(source: SuggestSource, query: string, opts: SuggestOptions, signal?: AbortSignal): Promise<string[]> {
  return memoizeAsync(cache, `${source}|${opts.hl}|${opts.gl}|${query}`, async () => {
    const { data } = await getJson(endpoint(source, query, opts), { timeoutMs: 6000, signal, headers: { accept: "application/json, text/javascript, */*" } });
    if (source === "amazon") return parseAmazon(data);
    if (source === "duckduckgo") return parseDuckDuckGo(data);
    return parseOpenSearch(data);
  });
}
