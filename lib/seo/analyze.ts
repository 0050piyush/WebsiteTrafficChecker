import { decodeBody, fetchUrl, FetchError, type RedirectHop, type TlsInfo } from "../net/fetcher";
import { extractPage, looksClientRendered, robotsDirectives, type ExtractedImage, type ExtractedLink } from "./extract";
import { runChecks, type Check } from "./checks";
import { detectTechnologies, type DetectedTech } from "./tech";
import { parseRobots, robotsAccess, type RobotsAccess, type RobotsTxt } from "./robots";
import { readability, topNGrams, truncateToPixels, textPixelWidth, SERP_DESCRIPTION_MAX_PX, SERP_TITLE_MAX_PX, type NGram, type Readability } from "./text";

export interface PageReport {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  http: {
    status: number;
    statusText: string;
    redirects: RedirectHop[];
    ttfbMs: number;
    totalMs: number;
    htmlBytes: number;
    transferBytes: number;
    contentType: string | null;
    contentEncoding: string | null;
    httpVersion: string;
    remoteAddress: string | null;
    server: string | null;
    cacheControl: string | null;
    xRobotsTag: string | null;
    securityHeaders: Record<string, string | null>;
  };
  tls: TlsInfo | null;
  seo: {
    title: string | null;
    titlePx: number;
    metaDescription: string | null;
    descriptionPx: number;
    canonical: string | null;
    metaRobots: string | null;
    indexable: boolean;
    noindexSource: string | null;
    lang: string | null;
    viewport: string | null;
    charset: string | null;
    hreflang: { lang: string; href: string }[];
    headings: { level: number; text: string }[];
    favicon: string | null;
    generator: string | null;
  };
  serp: { title: string; titleTruncated: boolean; description: string; descriptionTruncated: boolean; breadcrumb: string };
  content: {
    wordCount: number;
    readability: Readability | null;
    keywords: { one: NGram[]; two: NGram[]; three: NGram[] };
  };
  links: { total: number; internal: number; external: number; nofollow: number; items: ExtractedLink[] };
  images: { total: number; missingAlt: number; items: ExtractedImage[] };
  social: { openGraph: Record<string, string>; twitter: Record<string, string> };
  structuredData: { jsonLd: { types: string[]; valid: boolean; error?: string }[]; microdataTypes: string[] };
  technologies: DetectedTech[];
  /** `allowed` is whether Googlebot may crawl the URL; `access` breaks it down per bot. */
  robotsTxt: { url: string; found: boolean; allowed: boolean | null; access: RobotsAccess | null; sitemaps: string[] };
  /** The server sends a near-empty shell and builds the content with JavaScript. */
  jsRendered: boolean;
  mixedContent: string[];
  checks: Check[];
  score: number;
  keyword: string | null;
}

export class AnalyzeError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function fetchRobots(origin: string, signal?: AbortSignal): Promise<{ url: string; robots: RobotsTxt | null; status: number | null; raw: string | null }> {
  const url = `${origin}/robots.txt`;
  try {
    const res = await fetchUrl(url, { timeoutMs: 8000, maxBytes: 512 * 1024, maxRedirects: 5, signal });
    if (res.status >= 200 && res.status < 300 && !/text\/html/i.test(res.headers["content-type"] ?? "")) {
      const raw = decodeBody(res.body, res.headers["content-type"]);
      return { url, robots: parseRobots(raw), status: res.status, raw };
    }
    return { url, robots: null, status: res.status, raw: null };
  } catch {
    return { url, robots: null, status: null, raw: null };
  }
}

function breadcrumbFor(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
    return [u.hostname.replace(/^www\./, ""), ...parts].join(" › ").slice(0, 120);
  } catch {
    return url;
  }
}

export async function analyzePage(inputUrl: string, opts: { keyword?: string; signal?: AbortSignal } = {}): Promise<PageReport> {
  let res;
  try {
    res = await fetchUrl(inputUrl, { timeoutMs: 20_000, maxBytes: 8 * 1024 * 1024, signal: opts.signal });
  } catch (err) {
    const e = err as FetchError;
    throw new AnalyzeError(e.message, e.code ?? "FETCH_FAILED");
  }

  const contentType = res.headers["content-type"] ?? null;
  if (contentType && !/html|xml/i.test(contentType) && res.status < 400) {
    throw new AnalyzeError(`The URL returned ${contentType.split(";")[0]}, not an HTML page.`, "NOT_HTML");
  }

  const html = decodeBody(res.body, contentType);
  const page = extractPage(html, res.finalUrl);
  const origin = new URL(res.finalUrl).origin;
  const robotsResult = await fetchRobots(origin, opts.signal);
  // No robots.txt (any answer but a parsed file) means everything may be crawled; a failed fetch means unknown.
  const access: RobotsAccess | null = robotsResult.robots
    ? robotsAccess(robotsResult.robots, res.finalUrl)
    : robotsResult.status !== null
      ? { googlebot: true, bingbot: true, otherBots: true }
      : null;
  const robotsAllowed = access ? access.googlebot : null;
  const jsRendered = looksClientRendered(html, page);

  const xRobotsTag = res.headers["x-robots-tag"] ?? null;
  const metaDirectives = robotsDirectives(page.metaRobots, null);
  const headerDirectives = robotsDirectives(null, xRobotsTag);
  const noindex = metaDirectives.noindex || headerDirectives.noindex;
  const noindexSource = metaDirectives.noindex ? "meta robots tag" : headerDirectives.noindex ? "X-Robots-Tag header" : null;

  const { checks, score } = runChecks({
    url: res.finalUrl,
    status: res.status,
    redirectCount: res.redirects.length,
    ttfbMs: res.timing.ttfbMs,
    htmlBytes: res.body.length,
    compressed: !!res.contentEncoding && res.contentEncoding !== "identity",
    headers: res.headers,
    hasDoctype: /^\s*(<!--[\s\S]*?-->\s*)*<!doctype html/i.test(html.slice(0, 2000)),
    page,
    noindex,
    noindexSource,
    robotsAccess: access,
    jsRendered,
    keyword: opts.keyword?.trim() || undefined,
  });

  const technologies = detectTechnologies({ html, headers: res.headers, scripts: page.scripts, generator: page.generator });
  const serpTitle = truncateToPixels(page.title || page.h1[0] || res.finalUrl, 20, SERP_TITLE_MAX_PX);
  const serpDesc = truncateToPixels(page.metaDescription || page.mainText.slice(0, 300) || "", 14, SERP_DESCRIPTION_MAX_PX);
  const h = res.headers;

  return {
    url: inputUrl,
    finalUrl: res.finalUrl,
    fetchedAt: new Date().toISOString(),
    http: {
      status: res.status,
      statusText: res.statusText,
      redirects: res.redirects,
      ttfbMs: res.timing.ttfbMs,
      totalMs: res.timing.totalMs,
      htmlBytes: res.body.length,
      transferBytes: res.transferBytes,
      contentType,
      contentEncoding: res.contentEncoding,
      httpVersion: res.httpVersion,
      remoteAddress: res.remoteAddress,
      server: h["server"] ?? null,
      cacheControl: h["cache-control"] ?? null,
      xRobotsTag,
      securityHeaders: {
        "strict-transport-security": h["strict-transport-security"] ?? null,
        "content-security-policy": h["content-security-policy"] ? h["content-security-policy"].slice(0, 300) : null,
        "x-content-type-options": h["x-content-type-options"] ?? null,
        "x-frame-options": h["x-frame-options"] ?? null,
        "referrer-policy": h["referrer-policy"] ?? null,
        "permissions-policy": h["permissions-policy"] ? h["permissions-policy"].slice(0, 300) : null,
      },
    },
    tls: res.tls,
    seo: {
      title: page.title,
      titlePx: page.title ? textPixelWidth(page.title, 20) : 0,
      metaDescription: page.metaDescription,
      descriptionPx: page.metaDescription ? textPixelWidth(page.metaDescription, 14) : 0,
      canonical: page.canonical,
      metaRobots: page.metaRobots,
      indexable: !noindex && res.status >= 200 && res.status < 300 && robotsAllowed !== false,
      noindexSource,
      lang: page.lang,
      viewport: page.viewport,
      charset: page.charset,
      hreflang: page.hreflang.slice(0, 100),
      headings: page.headings.slice(0, 200),
      favicon: page.favicon,
      generator: page.generator,
    },
    serp: {
      title: serpTitle.text,
      titleTruncated: serpTitle.truncated,
      description: serpDesc.text,
      descriptionTruncated: serpDesc.truncated,
      breadcrumb: breadcrumbFor(res.finalUrl),
    },
    content: {
      wordCount: page.wordCount,
      readability: readability(page.mainText),
      keywords: { one: topNGrams(page.mainText, 1), two: topNGrams(page.mainText, 2), three: topNGrams(page.mainText, 3, 10) },
    },
    links: {
      total: page.links.length,
      internal: page.links.filter((l) => l.internal).length,
      external: page.links.filter((l) => !l.internal).length,
      nofollow: page.links.filter((l) => l.nofollow).length,
      items: page.links.slice(0, 500),
    },
    images: { total: page.images.length, missingAlt: page.images.filter((i) => i.alt === null).length, items: page.images.slice(0, 200) },
    social: { openGraph: page.openGraph, twitter: page.twitter },
    structuredData: { jsonLd: page.jsonLd, microdataTypes: page.microdataTypes },
    technologies,
    robotsTxt: { url: robotsResult.url, found: !!robotsResult.robots, allowed: robotsAllowed, access, sitemaps: robotsResult.robots?.sitemaps ?? [] },
    jsRendered,
    mixedContent: page.mixedContent,
    checks,
    score,
    keyword: opts.keyword?.trim() || null,
  };
}
