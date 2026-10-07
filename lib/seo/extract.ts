import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { contentHash, countWords } from "./text";
import { isSameSite, resolveLink } from "../url";

/** Everything the analyzer and the crawler need to know about one HTML document. */
export interface ExtractedPage {
  title: string | null;
  titleCount: number;
  metaDescription: string | null;
  metaDescriptionCount: number;
  metaRobots: string | null;
  metaKeywords: string | null;
  canonical: string | null;
  canonicalCount: number;
  lang: string | null;
  charset: string | null;
  viewport: string | null;
  generator: string | null;
  baseHref: string | null;
  headings: { level: number; text: string }[];
  h1: string[];
  links: ExtractedLink[];
  images: ExtractedImage[];
  scripts: string[];
  stylesheets: string[];
  hreflang: { lang: string; href: string }[];
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  jsonLd: { types: string[]; valid: boolean; error?: string }[];
  microdataTypes: string[];
  favicon: string | null;
  ampHtml: string | null;
  /** All visible text (for word count). */
  wordCount: number;
  /** Main content text (for readability and keyword analysis), capped in length. */
  mainText: string;
  contentHash: string;
  mixedContent: string[];
  iframes: number;
  forms: { action: string | null; insecure: boolean }[];
  inlineStyleBytes: number;
  inlineScriptBytes: number;
}

export interface ExtractedLink {
  href: string;
  text: string;
  rel: string[];
  internal: boolean;
  nofollow: boolean;
  /** Where the link lives: main content or navigation chrome. */
  inNav: boolean;
}

export interface ExtractedImage {
  src: string;
  alt: string | null;
  width: string | null;
  height: string | null;
  loading: string | null;
}

const NON_CONTENT = "script, style, noscript, template, svg, iframe, object, canvas";

function cleanText(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** Visible text in document order, with a space between text nodes. Iterative to survive deep DOMs. */
function collectText(root: cheerio.Cheerio<AnyNode>): string {
  const parts: string[] = [];
  const stack: AnyNode[] = root.toArray().reverse();
  while (stack.length) {
    const node = stack.pop()!;
    if (node.type === "text") {
      const t = (node as unknown as { data: string }).data;
      if (t && t.trim()) parts.push(t.trim());
    } else if ("children" in node && Array.isArray(node.children)) {
      for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i] as AnyNode);
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function flattenJsonLdTypes(value: unknown, out: Set<string>, depth = 0): void {
  if (depth > 6 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const v of value) flattenJsonLdTypes(v, out, depth + 1);
    return;
  }
  const obj = value as Record<string, unknown>;
  const t = obj["@type"];
  if (typeof t === "string") out.add(t);
  else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.add(x));
  if (obj["@graph"]) flattenJsonLdTypes(obj["@graph"], out, depth + 1);
  for (const [k, v] of Object.entries(obj)) {
    if (k !== "@graph" && typeof v === "object") flattenJsonLdTypes(v, out, depth + 1);
  }
}

export function extractPage(html: string, pageUrl: string): ExtractedPage {
  const $ = cheerio.load(html);

  const baseHref = $("base[href]").first().attr("href") ?? null;
  let base = pageUrl;
  if (baseHref) {
    try {
      base = new URL(baseHref, pageUrl).href;
    } catch {
      /* keep page URL */
    }
  }
  const abs = (href: string | undefined) => (href ? resolveLink(href, base) : null);
  const meta = (name: string) => {
    const el = $(`meta[name="${name}" i]`);
    return { value: el.length ? cleanText(el.first().attr("content")) : null, count: el.length };
  };

  const titles = $("head title, title").filter((_, el) => $(el).parents("svg").length === 0);
  const description = meta("description");
  const canonicals = $('link[rel~="canonical" i]');

  const headings: { level: number; text: string }[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    headings.push({ level: Number(el.tagName.slice(1)), text: cleanText($(el).text()).slice(0, 300) });
  });

  const links: ExtractedLink[] = [];
  $("a[href]").each((_, el) => {
    const $el = $(el);
    const href = abs($el.attr("href"));
    if (!href) return;
    const rel = ($el.attr("rel") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const text = cleanText($el.text()) || cleanText($el.attr("aria-label")) || cleanText($el.find("img[alt]").first().attr("alt")) || "";
    links.push({
      href,
      text: text.slice(0, 200),
      rel,
      internal: isSameSite(href, pageUrl),
      nofollow: rel.includes("nofollow") || rel.includes("ugc") || rel.includes("sponsored"),
      inNav: $el.closest("nav, header, footer").length > 0,
    });
  });

  const images: ExtractedImage[] = [];
  $("img").each((_, el) => {
    const $el = $(el);
    const raw = $el.attr("src") || $el.attr("data-src") || $el.attr("srcset")?.split(/\s+/)[0];
    const src = abs(raw);
    if (!src) return;
    const alt = $el.attr("alt");
    images.push({
      src,
      alt: alt === undefined ? null : cleanText(alt),
      width: $el.attr("width") ?? null,
      height: $el.attr("height") ?? null,
      loading: $el.attr("loading") ?? null,
    });
  });

  const scripts = $("script[src]")
    .map((_, el) => abs($(el).attr("src")))
    .get()
    .filter((s): s is string => !!s);
  const stylesheets = $('link[rel~="stylesheet" i][href]')
    .map((_, el) => abs($(el).attr("href")))
    .get()
    .filter((s): s is string => !!s);

  const hreflang: { lang: string; href: string }[] = [];
  $('link[rel~="alternate" i][hreflang]').each((_, el) => {
    const href = abs($(el).attr("href"));
    if (href) hreflang.push({ lang: ($(el).attr("hreflang") ?? "").toLowerCase(), href });
  });

  const openGraph: Record<string, string> = {};
  $('meta[property^="og:" i]').each((_, el) => {
    const key = ($(el).attr("property") ?? "").toLowerCase();
    if (!(key in openGraph)) openGraph[key] = cleanText($(el).attr("content"));
  });
  const twitter: Record<string, string> = {};
  $('meta[name^="twitter:" i], meta[property^="twitter:" i]').each((_, el) => {
    const key = ($(el).attr("name") ?? $(el).attr("property") ?? "").toLowerCase();
    if (!(key in twitter)) twitter[key] = cleanText($(el).attr("content"));
  });

  const jsonLd: ExtractedPage["jsonLd"] = [];
  $('script[type="application/ld+json" i]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const types = new Set<string>();
      flattenJsonLdTypes(parsed, types);
      jsonLd.push({ types: [...types], valid: true });
    } catch (err) {
      jsonLd.push({ types: [], valid: false, error: (err as Error).message.slice(0, 160) });
    }
  });
  const microdataTypes = [
    ...new Set(
      $("[itemtype]")
        .map((_, el) => ($(el).attr("itemtype") ?? "").split("/").pop() ?? "")
        .get()
        .filter(Boolean),
    ),
  ];

  const faviconHref = $('link[rel~="icon" i], link[rel="shortcut icon" i], link[rel~="apple-touch-icon" i]').first().attr("href");

  const isHttps = pageUrl.startsWith("https:");
  const mixedContent = isHttps
    ? [
        ...new Set(
          $("img[src], script[src], iframe[src], audio[src], video[src], source[src], link[rel~='stylesheet' i][href]")
            .map((_, el) => $(el).attr("src") ?? $(el).attr("href") ?? "")
            .get()
            .filter((u) => /^http:\/\//i.test(u.trim())),
        ),
      ].slice(0, 50)
    : [];

  const forms = $("form")
    .map((_, el) => {
      const action = $(el).attr("action") ?? null;
      const resolved = action ? resolveLink(action, base) : null;
      return { action: resolved, insecure: !!resolved && resolved.startsWith("http:") && isHttps };
    })
    .get();

  let inlineScriptBytes = 0;
  $("script:not([src])").each((_, el) => {
    const type = ($(el).attr("type") ?? "").toLowerCase();
    if (!type || type.includes("javascript") || type === "module") inlineScriptBytes += $(el).text().length;
  });
  let inlineStyleBytes = 0;
  $("style").each((_, el) => {
    inlineStyleBytes += $(el).text().length;
  });

  const iframes = $("iframe").length;

  // Text: drop non-content elements once, then measure.
  $(NON_CONTENT).remove();
  const body: cheerio.Cheerio<AnyNode> = $("body").length ? $("body") : $.root();
  const allText = collectText(body);
  let mainRoot: cheerio.Cheerio<AnyNode> = $("main, [role='main'], article").first();
  if (!mainRoot.length) {
    const clone = $(body.toArray()).clone();
    clone.find("nav, header, footer, aside, [role='navigation'], [role='banner'], [role='contentinfo']").remove();
    mainRoot = clone;
  }
  const mainText = collectText(mainRoot).slice(0, 100_000);

  return {
    title: titles.length ? cleanText(titles.first().text()) : null,
    titleCount: titles.length,
    metaDescription: description.value,
    metaDescriptionCount: description.count,
    metaRobots: [meta("robots").value, meta("googlebot").value].filter(Boolean).join(", ") || null,
    metaKeywords: meta("keywords").value,
    canonical: canonicals.length ? abs(canonicals.first().attr("href")) : null,
    canonicalCount: canonicals.length,
    lang: $("html").attr("lang")?.trim() || null,
    charset: $("meta[charset]").attr("charset") ?? (/charset=([\w-]+)/i.exec($('meta[http-equiv="content-type" i]').attr("content") ?? "")?.[1] || null),
    viewport: meta("viewport").value,
    generator: meta("generator").value,
    baseHref,
    headings,
    h1: headings.filter((h) => h.level === 1).map((h) => h.text),
    links,
    images,
    scripts,
    stylesheets,
    hreflang,
    openGraph,
    twitter,
    jsonLd,
    microdataTypes,
    favicon: abs(faviconHref) ?? null,
    ampHtml: abs($('link[rel="amphtml" i]').attr("href")) ?? null,
    wordCount: countWords(allText),
    mainText,
    contentHash: contentHash(mainText || allText),
    mixedContent,
    iframes,
    forms,
    inlineStyleBytes,
    inlineScriptBytes,
  };
}

/**
 * True when the server sends a near-empty shell and the content is built by JavaScript
 * in the browser (single-page apps such as instagram.com). Crawlers that don't run
 * JavaScript see only the shell, so raw-HTML content checks must be read in that light.
 */
export function looksClientRendered(html: string, page: Pick<ExtractedPage, "wordCount" | "inlineScriptBytes" | "scripts">): boolean {
  if (page.wordCount >= 250) return false;
  const emptyAppRoot = /<(div|main)\b[^>]*\bid=["'](root|app|__next|__nuxt|react-root|svelte|mount|application)["'][^>]*>\s*<\/\1>/i.test(html);
  const heavyScripts = page.inlineScriptBytes > 30_000 || page.scripts.length >= 8;
  const noscriptAsksForJs = /<noscript\b[^>]*>[\s\S]{0,600}?javascript/i.test(html);
  return emptyAppRoot || heavyScripts || noscriptAsksForJs;
}

/** Parse robots directives from meta tags and the X-Robots-Tag header. */
export function robotsDirectives(metaRobots: string | null, xRobotsTag: string | null | undefined) {
  const all = `${metaRobots ?? ""},${xRobotsTag ?? ""}`.toLowerCase();
  // X-Robots-Tag can be prefixed with a user agent ("googlebot: noindex").
  const tokens = all.split(/[,;]/).map((t) => t.replace(/^[\w-]+:\s*(?=no|none|all)/, "").trim());
  return {
    noindex: tokens.includes("noindex") || tokens.includes("none"),
    nofollow: tokens.includes("nofollow") || tokens.includes("none"),
  };
}
