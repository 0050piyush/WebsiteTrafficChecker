/** Text statistics used by the page analyzer: word counts, readability and n-grams. */

export const STOPWORDS = new Set(
  (
    "a about above after again against all am an and any are aren't as at be because been before being below between both but by " +
    "can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has " +
    "hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in " +
    "into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours " +
    "ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them " +
    "themselves then there there's these they they'd they'll they're they've this those through to too under until up very was " +
    "wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's will " +
    "with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves also just get got may might must " +
    "one us like new use used using via within without per yet"
  ).split(/\s+/),
);

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(WORD_RE) ?? []).map((w) => w.replace(/[’]/g, "'").replace(/^['-]+|['-]+$/g, "")).filter(Boolean);
}

export function countWords(text: string): number {
  return text.match(WORD_RE)?.length ?? 0;
}

/** Heuristic English syllable counter (good enough for Flesch scores). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

export interface Readability {
  sentences: number;
  words: number;
  avgWordsPerSentence: number;
  fleschReadingEase: number;
  label: string;
}

export function readability(text: string): Readability | null {
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
  if (words.length < 30) return null;
  const sentences = Math.max(1, (text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? []).length);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const wps = words.length / sentences;
  const spw = syllables / words.length;
  const score = Math.max(0, Math.min(100, 206.835 - 1.015 * wps - 84.6 * spw));
  const label =
    score >= 80 ? "Very easy" : score >= 70 ? "Easy" : score >= 60 ? "Plain English" : score >= 50 ? "Fairly difficult" : score >= 30 ? "Difficult" : "Very difficult";
  return {
    sentences,
    words: words.length,
    avgWordsPerSentence: Math.round(wps * 10) / 10,
    fleschReadingEase: Math.round(score),
    label,
  };
}

export interface NGram {
  phrase: string;
  count: number;
  /** Share of all words in the text covered by this phrase, in percent. */
  density: number;
}

export function topNGrams(text: string, n: 1 | 2 | 3, limit = 15): NGram[] {
  const tokens = tokenize(text).filter((t) => !/^\d+$/.test(t));
  const total = tokens.length;
  if (!total) return [];
  const counts = new Map<string, number>();
  for (let i = 0; i + n <= tokens.length; i++) {
    const gram = tokens.slice(i, i + n);
    if (STOPWORDS.has(gram[0]) || STOPWORDS.has(gram[n - 1])) continue;
    if (gram.some((t) => t.length < 2)) continue;
    const key = gram.join(" ");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= (n === 1 ? 2 : 2))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([phrase, count]) => ({ phrase, count, density: Math.round(((count * n) / total) * 10000) / 100 }));
}

/** Fast 32-bit FNV-1a hash of normalized text, for duplicate-content detection. */
export function contentHash(text: string): string {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Approximate rendered width in pixels of text set in Arial, which is what Google
 * uses for result titles (20px) and snippets (14px). Truncation is pixel-based, not
 * character-based, so "WWWW" truncates far sooner than "iiii".
 */
const ARIAL_WIDTHS: Record<string, number> = (() => {
  const table: Record<string, number> = {};
  const set = (chars: string, w: number) => {
    for (const c of chars) table[c] = w;
  };
  set(" !,./:;I[\\]fijlt'|", 278);
  set("ijl", 222);
  set("\"", 355);
  set("#$0123456789?L_abdeghnopqu", 556);
  set("%", 889);
  set("&ABEKPSVXY", 667);
  set("()-`r", 333);
  set("*", 389);
  set("+<=>~", 584);
  set("@", 1015);
  set("CDHNRUw", 722);
  set("FTZ", 611);
  set("GOQ", 778);
  set("J", 500);
  set("M", 833);
  set("W", 944);
  set("^", 469);
  set("ckvsxyz", 500);
  set("m", 833);
  set("{}", 334);
  return table;
})();

export function textPixelWidth(text: string, fontSizePx: number): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    units += ARIAL_WIDTHS[ch] ?? (code > 0x2e80 ? 1000 : 556);
  }
  return Math.round((units / 1000) * fontSizePx);
}

export const SERP_TITLE_MAX_PX = 600;
export const SERP_DESCRIPTION_MAX_PX = 920;

/** Truncate text the way a results page would, appending an ellipsis. */
export function truncateToPixels(text: string, fontSizePx: number, maxPx: number): { text: string; truncated: boolean } {
  if (textPixelWidth(text, fontSizePx) <= maxPx) return { text, truncated: false };
  const ellipsis = textPixelWidth(" ...", fontSizePx);
  let out = "";
  for (const ch of text) {
    if (textPixelWidth(out + ch, fontSizePx) + ellipsis > maxPx) break;
    out += ch;
  }
  const cut = out.lastIndexOf(" ");
  return { text: `${(cut > out.length * 0.6 ? out.slice(0, cut) : out).trimEnd()} ...`, truncated: true };
}
