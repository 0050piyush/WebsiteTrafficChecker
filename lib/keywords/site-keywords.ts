import { parse } from "tldts";
import { mapLimit } from "../concurrency";
import { fetchSuggestions, type SuggestSource } from "../sources/autocomplete";
import { STOPWORDS, type NGram } from "../seo/text";
import type { Market } from "../markets";

/**
 * Free "top keywords" for a site. Without a ranking database we can't know where a site
 * ranks, but we can find the phrases it targets (brand, title, headings) and check which
 * ones people actually search for: search engines only autocomplete real, popular queries,
 * and the more popular a query, the fewer letters you need to type before it's suggested.
 */

export type KeywordOrigin = "brand" | "title" | "h1" | "h2" | "content";

export interface TargetKeyword {
  keyword: string;
  /** 0–100: how readily search engines suggest it. Relative, NOT a search volume. */
  demand: number;
  level: "High" | "Medium" | "Low";
  /** The shortest prefix we typed that still brought the phrase up. */
  typedPrefix: string;
  foundIn: KeywordOrigin[];
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

/**
 * Prefixes to type, longest first: the whole phrase, then about 3/4 of it, then about half.
 * `weight` is what being suggested at that length is worth: the fewer letters needed, the
 * more popular the query.
 */
export function probePrefixes(phrase: string): { prefix: string; weight: number }[] {
  const out: { prefix: string; weight: number }[] = [];
  for (const [fraction, weight] of [
    [1, 0.3],
    [0.75, 0.6],
    [0.5, 1],
  ]) {
    const prefix = phrase.slice(0, Math.ceil(phrase.length * fraction)).trimEnd();
    if (prefix.length >= 3 && !out.some((p) => p.prefix === prefix)) out.push({ prefix, weight });
  }
  return out;
}

/** Suggested after half the letters at #1 → 100; only when typed in full, at #10 → 13. */
export function demandScore(weight: number, position: number): number {
  return Math.max(1, Math.round((weight / (1 + 0.15 * (position - 1))) * 100));
}

export function demandLevel(demand: number): TargetKeyword["level"] {
  return demand >= 55 ? "High" : demand >= 25 ? "Medium" : "Low";
}

export interface SiteKeywordsResult {
  keywords: TargetKeyword[];
  candidates: number;
  engine: SuggestSource;
}

export async function estimateSiteKeywords(site: SiteText, market: Market, { signal, limit = 10 }: { signal?: AbortSignal; limit?: number } = {}): Promise<SiteKeywordsResult> {
  const candidates = candidateKeywords(site);
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

  const scored = await mapLimit(
    candidates,
    4,
    async (c): Promise<TargetKeyword | null> => {
      let best: { prefix: string; weight: number; position: number } | null = null;
      for (const { prefix, weight } of probePrefixes(c.keyword)) {
        let list: string[];
        try {
          list = await suggest(prefix);
        } catch {
          break;
        }
        const position = suggestedAt(c.keyword, list);
        // Not suggested at this length means it won't be with fewer letters either.
        if (position === null) break;
        best = { prefix, weight, position };
      }
      if (!best) return null;
      const demand = demandScore(best.weight, best.position);
      return { keyword: c.keyword, demand, level: demandLevel(demand), typedPrefix: best.prefix, foundIn: c.foundIn };
    },
    signal,
  );
  if (candidates.length && !anyAnswer) throw new Error("Search suggestions are unavailable right now");

  const keywords = scored
    .filter((k): k is TargetKeyword => !!k)
    .sort((a, b) => b.demand - a.demand || ORIGIN_ORDER.indexOf(a.foundIn[0]) - ORIGIN_ORDER.indexOf(b.foundIn[0]))
    .slice(0, limit);
  return { keywords, candidates: candidates.length, engine };
}
