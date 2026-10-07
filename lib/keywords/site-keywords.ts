import { parse } from "tldts";
import { mapLimit } from "../concurrency";
import { fetchSuggestions, type SuggestSource } from "../sources/autocomplete";
import { STOPWORDS, type NGram } from "../seo/text";
import type { Market } from "../markets";

/**
 * "Top keywords" for a site without a ranking database: the phrases it targets (brand,
 * title, headings) that people actually search for, with monthly search volumes from
 * Google Ads Keyword Planner, or rough estimates from search suggestions until that's set up.
 */

export type KeywordOrigin = "brand" | "title" | "h1" | "h2" | "content";

export interface TargetKeyword {
  keyword: string;
  /** Average monthly searches: from Google Ads, or a rough estimate when `estimated`. */
  volume: number;
  estimated: boolean;
  /** High: 10K+ searches a month, Medium: 1K–10K, Low: under 1K. */
  level: "High" | "Medium" | "Low";
  foundIn: KeywordOrigin[];
  /** Estimates only: the shortest prefix that brought the phrase up in search suggestions. */
  typedPrefix?: string;
}

export interface SiteText {
  domain: string;
  title: string | null;
  siteName?: string | null;
  headings: { level: number; text: string }[];
  phrases?: NGram[];
}

interface Candidate {
  keyword: string;
  foundIn: KeywordOrigin[];
}

const ORIGIN_ORDER: KeywordOrigin[] = ["brand", "title", "h1", "h2", "content"];
/** Words that can't start or end a search phrase on their own ("is it", "for the"). */
const FUNCTION_WORDS = new Set("a an the and or of to in on for with at by from is it its this that be are was as if so we you your our my i".split(" "));
/** Navigation and boilerplate text that's on every site and says nothing about it. */
const BOILERPLATE = new Set([
  "home", "homepage", "home page", "welcome", "menu", "main menu", "navigation", "search", "login", "log in", "sign in", "sign up", "register",
  "contact", "contact us", "about", "about us", "privacy", "privacy policy", "terms", "terms of service", "terms of use", "cookies", "cookie policy",
  "skip to content", "skip to main content", "read more", "learn more", "more", "blog", "news", "faq", "help", "support", "shop", "cart", "my account",
  "follow us", "subscribe", "newsletter", "get started", "untitled", "index",
  // Generic section headings.
  "how it works", "features", "our features", "pricing", "testimonials", "what our customers say", "our services", "services", "our team", "our clients",
  "why choose us", "what we do", "who we are", "get in touch", "stay connected", "recent posts", "latest posts", "popular posts", "related posts",
  "latest news", "categories", "tags", "archives", "frequently asked questions", "resources", "products", "solutions", "overview",
]);

/** Crude plural folding, enough to match "websites" with "website". */
const stem = (word: string) => word.replace(/ies$/, "y").replace(/([^s])s$/, "$1");

export function normalizePhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}'&+.\s-]/gu, " ")
    // Strip punctuation around words, but keep "c++" and "m&s".
    .replace(/(^|\s)[-'.&+]+|[-'.&]+(?=\s|$)|(^|\s)\++(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function acceptable(phrase: string): boolean {
  const words = phrase.split(" ");
  if (phrase.length < 3 || phrase.length > 60 || words.length > 6) return false;
  if (BOILERPLATE.has(phrase) || /^[\d\s.]+$/.test(phrase)) return false;
  if (words.length === 1) return !STOPWORDS.has(phrase);
  if (words.every((w) => FUNCTION_WORDS.has(w))) return false;
  return !FUNCTION_WORDS.has(words[words.length - 1]) && !["and", "or", "of", "for", "with", "to", "by"].includes(words[0]);
}

/** Split a title like "Product Name | Brand – Tagline? Yes!" into its separate phrases. */
export function titleSegments(title: string): string[] {
  return title
    .split(/\s[|–—\-:·•»/]\s|[|–—·•»]|[?!]\s|[?!]$|:\s/)
    .map(normalizePhrase)
    .filter(Boolean);
}

/** The brand as people type it: "is-it-down.co.uk" → "is it down", "isitdownrightnow". */
export function brandOf(domain: string): string[] {
  const info = parse(domain);
  const label = info.domainWithoutSuffix ?? domain.split(".")[0];
  const out = [label.replace(/-/g, " ")];
  if (label.includes("-")) out.push(label.replace(/-/g, ""));
  return out;
}

export function candidateKeywords(site: SiteText, max = 14): Candidate[] {
  const found = new Map<string, Set<KeywordOrigin>>();
  // The site's topic, from its brand, title and main heading. Subheadings and body text
  // only count when they're on topic, so "Popular posts" doesn't become a top keyword.
  const topic = new Set<string>();
  const learnTopic = (phrase: string) => phrase.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w)).forEach((w) => topic.add(stem(w)));
  const onTopic = (phrase: string) => phrase.split(" ").some((w) => topic.has(stem(w)));
  const h1s = site.headings.filter((h) => h.level === 1).slice(0, 2);
  for (const text of [...brandOf(site.domain), site.siteName ?? "", site.title ?? "", ...h1s.map((h) => h.text)]) learnTopic(normalizePhrase(text));

  const add = (raw: string, origin: KeywordOrigin) => {
    const phrase = normalizePhrase(raw).replace(/(\s\d{4})+$/, ""); // drop a trailing year: "best laptops 2026"
    if (!acceptable(phrase)) return;
    if ((origin === "h2" || origin === "content") && !onTopic(phrase)) return;
    const set = found.get(phrase) ?? new Set<KeywordOrigin>();
    set.add(origin);
    found.set(phrase, set);
  };
  /** A long title phrase is often a short query plus extras: "is it down right now" → "is it down". */
  const addWithStems = (segment: string, origin: KeywordOrigin) => {
    add(segment, origin);
    const words = segment.split(" ");
    if (words.length >= 4) for (const n of [3, 2]) add(words.slice(0, n).join(" "), origin);
  };

  for (const b of brandOf(site.domain)) add(b, "brand");
  if (site.siteName) add(site.siteName, "brand");
  if (site.title) for (const seg of titleSegments(site.title)) addWithStems(seg, "title");
  for (const h of h1s) for (const seg of titleSegments(h.text)) addWithStems(seg, "h1");
  for (const h of site.headings.filter((h) => h.level === 2).slice(0, 6)) add(h.text, "h2");
  for (const p of (site.phrases ?? []).filter((p) => p.count >= 3).slice(0, 4)) add(p.phrase, "content");

  // Brand and title phrases describe the whole site; they go first.
  const rank = (origins: Set<KeywordOrigin>) => Math.min(...[...origins].map((o) => ORIGIN_ORDER.indexOf(o)));
  return [...found.entries()]
    .map(([keyword, origins]) => ({ keyword, foundIn: ORIGIN_ORDER.filter((o) => origins.has(o)), order: rank(origins) }))
    .sort((a, b) => a.order - b.order)
    .slice(0, max)
    .map(({ keyword, foundIn }) => ({ keyword, foundIn }));
}

const compact = (s: string) => normalizePhrase(s).replace(/\.(com|net|org|io|co|app|dev)$/, "").replace(/[\s.'-]/g, "");

/** Position (1-based) of `phrase` among suggestions, ignoring spacing and a trailing .com. */
export function suggestedAt(phrase: string, suggestions: string[]): number | null {
  const target = compact(phrase);
  const i = suggestions.findIndex((s) => compact(s) === target);
  return i === -1 ? null : i + 1;
}

/** Variations of the phrase itself ("isitdown", "isitdownrightnow.com") aren't competitors. */
function countCompetitors(phrase: string, suggestions: string[]): number {
  const target = compact(phrase);
  return suggestions.filter((s) => {
    const c = compact(s);
    return !c.startsWith(target) && !target.startsWith(c);
  }).length;
}

/**
 * Rough monthly searches from search suggestions. Only popular queries get suggested
 * after a letter or two ("a" → amazon), so the fewer letters needed, the more searches.
 * An unusual prefix ("isitd") has little competition, so a phrase that wins there gets
 * less credit than one that beats nine other popular queries. Calibrated on a handful of
 * known volumes; expect it to be off by up to 10×, which is why it's always labeled.
 */
export function estimateVolume(prefixLength: number, position: number, competitors: number): number {
  const effective = prefixLength + 3 * (1 - Math.min(10, Math.max(0, competitors)) / 10);
  const log = 7.6 - 0.45 * effective - Math.log10(Math.max(1, position));
  const v = 10 ** Math.min(8, Math.max(1, log));
  // One significant figure: anything more would claim precision we don't have.
  const unit = 10 ** Math.floor(Math.log10(v));
  return Math.round(v / unit) * unit;
}

export function volumeLevel(volume: number): TargetKeyword["level"] {
  return volume >= 10_000 ? "High" : volume >= 1_000 ? "Medium" : "Low";
}

export type VolumeSource = "google-ads" | "estimate";

/** Looks up real monthly search volumes; null means no data for that keyword. */
export type VolumeLookup = (keywords: string[]) => Promise<Map<string, number | null>>;

export interface SiteKeywordsResult {
  keywords: TargetKeyword[];
  candidates: number;
  volumeSource: VolumeSource;
  /** Which autocomplete engine the estimates came from (estimates only). */
  engine: SuggestSource | null;
  note?: string;
}

const byVolume = (a: TargetKeyword, b: TargetKeyword) => b.volume - a.volume || ORIGIN_ORDER.indexOf(a.foundIn[0]) - ORIGIN_ORDER.indexOf(b.foundIn[0]);

/**
 * The site's top keywords with monthly search volumes: real ones from `volumes` (Google
 * Ads Keyword Planner) when it's available, otherwise rough estimates from search suggestions.
 */
export async function findSiteKeywords(
  site: SiteText,
  market: Market,
  { signal, limit = 10, volumes }: { signal?: AbortSignal; limit?: number; volumes?: VolumeLookup } = {},
): Promise<SiteKeywordsResult> {
  const candidates = candidateKeywords(site, 12);
  let note: string | undefined;

  if (volumes && candidates.length) {
    try {
      const found = await volumes(candidates.map((c) => c.keyword));
      const keywords = candidates.flatMap((c): TargetKeyword[] => {
        const volume = found.get(c.keyword);
        return volume ? [{ keyword: c.keyword, volume, estimated: false, level: volumeLevel(volume), foundIn: c.foundIn }] : [];
      });
      return { keywords: keywords.sort(byVolume).slice(0, limit), candidates: candidates.length, volumeSource: "google-ads", engine: null };
    } catch (err) {
      if (signal?.aborted) throw err;
      console.warn(`[keywords] Google Ads volumes failed: ${(err as Error).message}`);
      note = "Google Ads search volumes are unavailable right now, so volumes are rough estimates.";
    }
  }

  const opts = { hl: market.hl, gl: market.gl };
  let engine: SuggestSource = "google";
  let googleFailures = 0;
  let anyAnswer = false;

  const suggest = async (q: string): Promise<string[]> => {
    if (engine === "google") {
      try {
        const list = await fetchSuggestions("google", q, opts, signal);
        anyAnswer = true;
        return list;
      } catch (err) {
        if (signal?.aborted) throw err;
        // Google refusing us (rate limit, block): switch to DuckDuckGo for the rest.
        if (++googleFailures >= 2) engine = "duckduckgo";
      }
    }
    const list = await fetchSuggestions("duckduckgo", q, opts, signal);
    anyAnswer = true;
    return list;
  };

  /** The shortest prefix that still brings the phrase up, found by binary search. */
  const shortestPrefix = async (phrase: string) => {
    const full = await suggest(phrase);
    const fullPosition = suggestedAt(phrase, full);
    // Never suggested, even typed in full: too few searches to count.
    if (fullPosition === null) return null;
    let best = { prefix: phrase, position: fullPosition, list: full };
    let lo = 1;
    let hi = phrase.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const prefix = phrase.slice(0, mid);
      const list = await suggest(prefix);
      const position = suggestedAt(phrase, list);
      if (position === null) lo = mid + 1;
      else {
        best = { prefix, position, list };
        hi = mid - 1;
      }
    }
    return best;
  };

  const scored = await mapLimit(
    candidates,
    4,
    async (c): Promise<TargetKeyword | null> => {
      let best: Awaited<ReturnType<typeof shortestPrefix>>;
      try {
        best = await shortestPrefix(c.keyword);
      } catch (err) {
        if (signal?.aborted) throw err;
        return null;
      }
      if (!best) return null;
      const volume = estimateVolume(best.prefix.length, best.position, countCompetitors(c.keyword, best.list));
      return { keyword: c.keyword, volume, estimated: true, level: volumeLevel(volume), foundIn: c.foundIn, typedPrefix: best.prefix };
    },
    signal,
  );
  if (candidates.length && !anyAnswer) throw new Error("Search suggestions are unavailable right now");

  const keywords = scored.filter((k): k is TargetKeyword => !!k).sort(byVolume).slice(0, limit);
  return { keywords, candidates: candidates.length, volumeSource: "estimate", engine, ...(note ? { note } : {}) };
}
