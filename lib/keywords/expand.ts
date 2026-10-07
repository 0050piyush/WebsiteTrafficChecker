import { mapLimit, withTimeout } from "../concurrency";
import { fetchSuggestions, SUGGEST_SOURCES, type SuggestOptions, type SuggestSource } from "../sources/autocomplete";
import { STOPWORDS, tokenize } from "../seo/text";

export const QUESTION_WORDS = ["how", "what", "why", "when", "where", "who", "which", "can", "does", "is", "are", "will", "should"];
export const PREPOSITIONS = ["for", "with", "without", "to", "near", "like", "vs", "versus", "or", "and"];
const PREFIX_MODIFIERS = ["best", "top", "free", "cheap", "how to"];
/** Generic modifiers that say nothing about the sub-topic, so they never name a cluster. */
const CLUSTER_IGNORE = new Set(["best", "top", "free", "cheap", "cheapest", "good", "great", "near", "new", "online", "list"]);

export type KeywordGroup = "Questions" | "Comparisons" | "Prepositions" | "Long-tail" | "Related";
export type Intent = "Informational" | "Commercial" | "Transactional" | "Navigational";

export interface KeywordIdea {
  keyword: string;
  /** 0–100, relative within this result set. NOT search volume. */
  score: number;
  sources: SuggestSource[];
  /** Best (lowest) autocomplete position seen, 1-based. */
  bestPosition: number;
  appearances: number;
  words: number;
  group: KeywordGroup;
  intent: Intent;
  cluster: string;
}

export interface KeywordReport {
  seed: string;
  options: SuggestOptions & { depth: "quick" | "deep"; sources: SuggestSource[] };
  ideas: KeywordIdea[];
  clusters: { name: string; count: number }[];
  sourceStatus: { source: SuggestSource; queries: number; ok: number; failed: number; suggestions: number; error?: string }[];
  queriesRun: number;
  elapsedMs: number;
}

export function buildQueries(seed: string, depth: "quick" | "deep"): string[] {
  const s = seed.trim().toLowerCase();
  const queries = [s, `${s} `, ...QUESTION_WORDS.map((w) => `${w} ${s}`), ...PREPOSITIONS.map((p) => `${s} ${p} `)];
  if (depth === "deep") {
    queries.push(...PREFIX_MODIFIERS.map((m) => `${m} ${s}`));
    queries.push(..."abcdefghijklmnopqrstuvwxyz".split("").map((l) => `${s} ${l}`));
  }
  return [...new Set(queries)];
}

const INTENT_RULES: [Intent, RegExp][] = [
  ["Transactional", /\b(buy|price|prices|pricing|cost|cheap|cheapest|deal|deals|discount|coupon|promo|order|for sale|purchase|shop|subscription|hire|download|free trial|near me|rent|book)\b/i],
  ["Commercial", /\b(best|top|review|reviews|vs|versus|compare|comparison|alternative|alternatives|recommended|rated|ranking|which is better)\b/i],
  ["Navigational", /\b(login|log in|sign in|signup|sign up|website|official|app|account|contact|customer service|phone number|address|hours)\b|\.(com|net|org|io)\b/i],
];

export function classifyIntent(keyword: string): Intent {
  for (const [intent, re] of INTENT_RULES) if (re.test(keyword)) return intent;
  return "Informational";
}

export function classifyGroup(keyword: string): KeywordGroup {
  const k = ` ${keyword.toLowerCase()} `;
  const first = keyword.toLowerCase().split(/\s+/)[0];
  if (QUESTION_WORDS.includes(first) || k.includes("?") || /\b(how to|what is|why do|is it)\b/.test(k)) return "Questions";
  if (/\s(vs\.?|versus|or|alternative|alternatives|compared to|comparison)\s/.test(k)) return "Comparisons";
  if (/\s(for|with|without|to|near|like|from|in|on)\s/.test(k)) return "Prepositions";
  if (keyword.trim().split(/\s+/).length >= 4) return "Long-tail";
  return "Related";
}

/**
 * Score: each appearance contributes 1/(position) — the top suggestion for a query is
 * the most popular completion — summed across queries and engines, then normalized.
 */
export function aggregateSuggestions(
  seed: string,
  results: { source: SuggestSource; query: string; suggestions: string[] }[],
): KeywordIdea[] {
  const map = new Map<string, { raw: number; sources: Set<SuggestSource>; best: number; appearances: number }>();
  const seedNorm = seed.trim().toLowerCase();
  for (const r of results) {
    r.suggestions.forEach((s, i) => {
      const key = s.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || key.length > 120) return;
      const entry = map.get(key) ?? { raw: 0, sources: new Set<SuggestSource>(), best: Infinity, appearances: 0 };
      entry.raw += 1 / (i + 1);
      entry.sources.add(r.source);
      entry.best = Math.min(entry.best, i + 1);
      entry.appearances++;
      map.set(key, entry);
    });
  }
  const max = Math.max(1e-9, ...[...map.values()].map((v) => v.raw * (1 + 0.25 * (v.sources.size - 1))));
  const ideas: KeywordIdea[] = [...map.entries()].map(([keyword, v]) => ({
    keyword,
    score: Math.max(1, Math.round(((v.raw * (1 + 0.25 * (v.sources.size - 1))) / max) * 100)),
    sources: [...v.sources],
    bestPosition: v.best,
    appearances: v.appearances,
    words: keyword.split(/\s+/).length,
    group: classifyGroup(keyword),
    intent: classifyIntent(keyword),
    cluster: "",
  }));
  assignClusters(seedNorm, ideas);
  return ideas.sort((a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword));
}

/** Group ideas by their most common modifier term (the word that isn't the seed). */
export function assignClusters(seed: string, ideas: KeywordIdea[]): void {
  const seedTokens = new Set(tokenize(seed));
  const termsOf = (k: string) =>
    [...new Set(tokenize(k).filter((t) => !seedTokens.has(t) && !STOPWORDS.has(t) && t.length > 2 && !QUESTION_WORDS.includes(t) && !CLUSTER_IGNORE.has(t) && !/^\d+$/.test(t)))];
  const df = new Map<string, number>();
  for (const idea of ideas) for (const t of termsOf(idea.keyword)) df.set(t, (df.get(t) ?? 0) + 1);
  for (const idea of ideas) {
    const terms = termsOf(idea.keyword).filter((t) => (df.get(t) ?? 0) >= 2);
    terms.sort((a, b) => (df.get(b) ?? 0) - (df.get(a) ?? 0) || a.localeCompare(b));
    idea.cluster = terms[0] ?? (termsOf(idea.keyword).length ? "Other" : seed);
  }
}

export async function generateKeywordIdeas(
  seedRaw: string,
  { hl = "en", gl = "us", depth = "quick", sources = ["google", "bing", "duckduckgo", "youtube"] as SuggestSource[], signal }: Partial<SuggestOptions> & { depth?: "quick" | "deep"; sources?: SuggestSource[]; signal?: AbortSignal } = {},
): Promise<KeywordReport> {
  const started = Date.now();
  const seed = seedRaw.trim().replace(/\s+/g, " ").slice(0, 80);
  const queries = buildQueries(seed, depth);
  const opts = { hl, gl };
  const valid = sources.filter((s) => SUGGEST_SOURCES.some((x) => x.id === s));

  const perSource = await Promise.all(
    valid.map(async (source) => {
      let ok = 0;
      let failed = 0;
      let error: string | undefined;
      const results = await mapLimit(
        queries,
        3,
        async (query) => {
          // Stop hammering an engine that is clearly refusing us.
          if (failed >= 4 && ok === 0) return { source, query, suggestions: [] as string[] };
          try {
            const suggestions = await withTimeout(fetchSuggestions(source, query, opts, signal), 8000, "timeout");
            ok++;
            return { source, query, suggestions };
          } catch (err) {
            failed++;
            error = (err as Error).message;
            return { source, query, suggestions: [] as string[] };
          }
        },
        signal,
      );
      const flat = results.filter(Boolean);
      return {
        results: flat,
        status: { source, queries: queries.length, ok, failed, suggestions: flat.reduce((s, r) => s + r.suggestions.length, 0), error: ok === 0 ? error : undefined },
      };
    }),
  );

  const ideas = aggregateSuggestions(
    seed,
    perSource.flatMap((p) => p.results),
  );
  const clusterCounts = new Map<string, number>();
  for (const i of ideas) clusterCounts.set(i.cluster, (clusterCounts.get(i.cluster) ?? 0) + 1);
  const clusters = [...clusterCounts.entries()]
    .filter(([name]) => name !== "Other")
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);

  return {
    seed,
    options: { hl, gl, depth, sources: valid },
    ideas,
    clusters,
    sourceStatus: perSource.map((p) => p.status),
    queriesRun: queries.length * valid.length,
    elapsedMs: Date.now() - started,
  };
}
