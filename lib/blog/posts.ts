import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Marked, type Tokens } from "marked";
import { BANNED_PHRASES, MAX_WORDS, MIN_SOURCES, MIN_WORDS } from "./style";
import { MOTIFS, type Motif } from "./cover";

/**
 * Blog posts are Markdown files in content/blog, named YYYY-MM-DD-slug.md, with YAML
 * front matter. They're read at build time, so publishing a post is a commit + deploy.
 */

export const POSTS_DIR = path.join(process.cwd(), "content", "blog");
/** Addresses under /blog that are pages, not posts. */
const RESERVED_SLUGS = ["page", "how-we-write", "rss", "rss-xml", "feed"];
const FILE_RE = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

export interface PostSource {
  publisher: string;
  title: string;
  url: string;
}

export interface KeyFact {
  text: string;
  /** 1-based indexes into `sources`; every key fact needs at least two. */
  sources: number[];
}

/** The generated cover illustration (see components/blog/CoverArt.tsx). */
export interface PostCover {
  motif: Motif;
  /** Short label on the image; defaults to the first tag. */
  kicker: string;
  /** One key number, e.g. "3.6 GW". Optional. */
  stat: string | null;
  statLabel: string | null;
  /** Describes the image for screen readers and search engines. */
  alt: string;
}

export interface PostMeta {
  slug: string;
  file: string;
  title: string;
  description: string;
  /** ISO 8601 publish time. */
  date: string;
  updated: string | null;
  tags: string[];
  keyFacts: KeyFact[];
  sources: PostSource[];
  cover: PostCover;
  draft: boolean;
  readingMinutes: number;
  words: number;
}

export interface Post extends PostMeta {
  markdown: string;
  html: string;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const safeHref = (href: string) => (/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(href) ? href : null);
export const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const markdown = new Marked({ gfm: true });
markdown.use({
  renderer: {
    // Posts are plain Markdown: raw HTML is dropped rather than trusted.
    html() {
      return "";
    },
    heading({ tokens, depth }: Tokens.Heading) {
      const inner = this.parser.parseInline(tokens);
      return `<h${depth} id="${headingId(inner)}">${inner}</h${depth}>\n`;
    },
    link({ href, title, tokens }: Tokens.Link) {
      const inner = this.parser.parseInline(tokens);
      const url = safeHref(href);
      if (!url) return inner;
      const external = /^https?:\/\//i.test(url);
      return `<a href="${escapeHtml(url)}"${title ? ` title="${escapeHtml(title)}"` : ""}${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${inner}</a>`;
    },
    // We don't republish other outlets' images; only our own (site-relative) ones.
    image({ href, text }: Tokens.Image) {
      return href.startsWith("/") && !href.startsWith("//") ? `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}" loading="lazy">` : "";
    },
  },
});

export function renderMarkdown(source: string): string {
  return markdown.parse(source, { async: false });
}

export function countWords(text: string): number {
  return (text.replace(/[#>*_`[\]()-]/g, " ").match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

const asString = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v.trim() : "");

export function parsePost(file: string, raw: string): Post {
  const m = FILE_RE.exec(file);
  if (!m) throw new Error(`${file}: file names must look like 2026-10-07-short-slug.md`);
  const { data, content } = matter(raw);
  const words = countWords(content);
  const tags = Array.isArray(data.tags) ? data.tags.map((t: unknown) => String(t)) : [];
  const c = (data.cover ?? {}) as Record<string, unknown>;
  return {
    slug: m[2],
    file,
    title: asString(data.title),
    description: asString(data.description),
    date: asString(data.date),
    updated: asString(data.updated) || null,
    tags,
    keyFacts: Array.isArray(data.keyFacts)
      ? data.keyFacts.map((k: { text?: unknown; sources?: unknown }) => ({ text: asString(k?.text), sources: Array.isArray(k?.sources) ? k.sources.map(Number) : [] }))
      : [],
    sources: Array.isArray(data.sources)
      ? data.sources.map((s: { publisher?: unknown; title?: unknown; url?: unknown }) => ({ publisher: asString(s?.publisher), title: asString(s?.title), url: asString(s?.url) }))
      : [],
    cover: {
      motif: (MOTIFS as readonly string[]).includes(String(c.motif)) ? (c.motif as Motif) : ("" as Motif),
      kicker: asString(c.kicker) || tags[0] || "",
      stat: asString(c.stat) || null,
      statLabel: asString(c.statLabel) || null,
      alt: asString(c.alt),
    },
    draft: data.draft === true,
    readingMinutes: Math.max(1, Math.round(words / 230)),
    words,
    markdown: content,
    html: renderMarkdown(content),
  };
}

/** Problems that keep a post from being published. Empty means it passes. */
export function validatePost(post: Post): string[] {
  const problems: string[] = [];
  const fileDate = post.file.slice(0, 10);
  if (RESERVED_SLUGS.includes(post.slug)) problems.push(`"${post.slug}" is a reserved address; pick another slug`);
  if (!post.title || post.title.length > 110) problems.push("title is missing or longer than 110 characters");
  if (post.description.length < 50 || post.description.length > 170) problems.push("description must be 50–170 characters");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(post.date) || isNaN(Date.parse(post.date))) problems.push("date must be an ISO 8601 time with a time zone");
  else if (post.date.slice(0, 10) !== fileDate) problems.push(`date ${post.date} doesn't match the file name date ${fileDate}`);
  if (post.updated && isNaN(Date.parse(post.updated))) problems.push("updated must be an ISO 8601 time");
  if (!post.tags.length || post.tags.length > 5) problems.push("needs 1–5 tags");

  if (post.sources.length < MIN_SOURCES) problems.push(`needs at least ${MIN_SOURCES} sources`);
  const hosts = new Set<string>();
  post.sources.forEach((s, i) => {
    if (!s.publisher || !s.title) problems.push(`source ${i + 1} needs a publisher and title`);
    try {
      const u = new URL(s.url);
      if (u.protocol !== "https:") problems.push(`source ${i + 1} must be an https URL`);
      hosts.add(u.hostname.replace(/^www\./, ""));
    } catch {
      problems.push(`source ${i + 1} has an invalid URL`);
    }
  });
  if (hosts.size < MIN_SOURCES) problems.push(`sources must come from at least ${MIN_SOURCES} different websites`);

  if (!post.cover.motif) problems.push(`cover.motif must be one of: ${MOTIFS.join(", ")}`);
  if (post.cover.kicker.length > 22) problems.push("cover.kicker must be 22 characters or fewer");
  if (post.cover.stat && post.cover.stat.length > 9) problems.push("cover.stat must be 9 characters or fewer (one short number)");
  if (post.cover.statLabel && post.cover.statLabel.length > 48) problems.push("cover.statLabel must be 48 characters or fewer");
  if (post.cover.statLabel && !post.cover.stat) problems.push("cover.statLabel needs a cover.stat");
  if (post.cover.alt.length < 20 || post.cover.alt.length > 200) problems.push("cover.alt must describe the image in 20–200 characters");

  if (post.keyFacts.length < 3) problems.push("needs at least 3 key facts");
  post.keyFacts.forEach((k, i) => {
    if (!k.text) problems.push(`key fact ${i + 1} is empty`);
    const refs = [...new Set(k.sources)];
    if (refs.some((n) => !Number.isInteger(n) || n < 1 || n > post.sources.length)) problems.push(`key fact ${i + 1} cites a source that doesn't exist`);
    const factHosts = new Set(refs.map((n) => post.sources[n - 1]?.url).filter(Boolean).map((u) => new URL(u!).hostname.replace(/^www\./, "")));
    if (factHosts.size < 2) problems.push(`key fact ${i + 1} must be confirmed by sources on two different websites`);
  });

  if (post.words < MIN_WORDS || post.words > MAX_WORDS) problems.push(`body has ${post.words} words; keep it between ${MIN_WORDS} and ${MAX_WORDS}`);
  if (/^#\s/m.test(post.markdown)) problems.push("don't use a top-level # heading in the body; the title is the H1");
  if (!/^##\s/m.test(post.markdown)) problems.push("break the body up with at least one ## section heading");
  if (/<[a-z][^>]*>/i.test(post.markdown)) problems.push("raw HTML isn't allowed in posts");
  const lower = `${post.title}\n${post.description}\n${post.markdown}`.toLowerCase();
  for (const phrase of BANNED_PHRASES) if (lower.includes(phrase)) problems.push(`uses the banned phrase "${phrase}"`);
  return problems;
}

function readAll(): Post[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(POSTS_DIR).filter((f) => FILE_RE.test(f));
  } catch {
    return [];
  }
  return files.map((f) => parsePost(f, fs.readFileSync(path.join(POSTS_DIR, f), "utf8")));
}

let cache: Post[] | null = null;

/** Published posts, newest first. Drafts and future-dated posts are left out. */
export function getAllPosts(): Post[] {
  if (!cache || process.env.NODE_ENV === "development") {
    const now = Date.now();
    cache = readAll()
      .filter((p) => !p.draft && Date.parse(p.date) <= now)
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }
  return cache;
}

/** Every post file, including drafts (for validation). */
export function getAllPostFiles(): Post[] {
  return readAll();
}

export function getPost(slug: string): Post | null {
  return getAllPosts().find((p) => p.slug === slug) ?? null;
}

export function toMeta(post: Post): PostMeta {
  const { markdown: _m, html: _h, ...meta } = post;
  void _m;
  void _h;
  return meta;
}

/** Up to `n` other posts, preferring ones that share a tag. */
export function relatedPosts(post: Post, n = 3): PostMeta[] {
  const others = getAllPosts().filter((p) => p.slug !== post.slug);
  const shared = (p: Post) => p.tags.filter((t) => post.tags.includes(t)).length;
  return others
    .map((p, i) => ({ p, score: shared(p) * 100 - i }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(({ p }) => toMeta(p));
}

export const POSTS_PER_PAGE = 12;

export function pageCount(): number {
  return Math.max(1, Math.ceil(getAllPosts().length / POSTS_PER_PAGE));
}

export function postsForPage(page: number): PostMeta[] {
  return getAllPosts()
    .slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE)
    .map(toMeta);
}

export function formatPostDate(iso: string, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }): string {
  return new Date(iso).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}
