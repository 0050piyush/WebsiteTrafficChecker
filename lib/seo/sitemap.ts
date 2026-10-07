import { gunzipSync } from "node:zlib";

/** Minimal, fast XML sitemap parser (urlset and sitemapindex). */

export interface ParsedSitemap {
  kind: "urlset" | "index" | "unknown";
  entries: { loc: string; lastmod: string | null }[];
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

export function parseSitemap(xml: string): ParsedSitemap {
  const kind = /<sitemapindex[\s>]/i.test(xml) ? "index" : /<urlset[\s>]/i.test(xml) ? "urlset" : "unknown";
  const entries: ParsedSitemap["entries"] = [];
  const blockRe = kind === "index" ? /<sitemap[\s>][\s\S]*?<\/sitemap>/gi : /<url[\s>][\s\S]*?<\/url>/gi;
  for (const block of xml.match(blockRe) ?? []) {
    const loc = /<loc>([\s\S]*?)<\/loc>/i.exec(block)?.[1];
    if (!loc) continue;
    const lastmod = /<lastmod>([\s\S]*?)<\/lastmod>/i.exec(block)?.[1];
    entries.push({ loc: decodeXmlEntities(loc), lastmod: lastmod ? decodeXmlEntities(lastmod) : null });
  }
  return { kind, entries };
}

/** Decode a sitemap body, transparently gunzipping .xml.gz files. */
export function sitemapBodyToText(body: Buffer): string {
  if (body.length > 2 && body[0] === 0x1f && body[1] === 0x8b) {
    try {
      return gunzipSync(body, { maxOutputLength: 60 * 1024 * 1024 }).toString("utf8");
    } catch {
      return "";
    }
  }
  return body.toString("utf8");
}

export interface SitemapCollection {
  urls: { loc: string; lastmod: string | null }[];
  sitemapsFetched: string[];
  errors: { url: string; error: string }[];
  /** True when limits stopped us before reading everything. */
  partial: boolean;
}

export async function collectSitemapUrls(
  roots: string[],
  fetchText: (url: string) => Promise<{ status: number; body: Buffer }>,
  { maxSitemaps = 10, maxUrls = 50_000 }: { maxSitemaps?: number; maxUrls?: number } = {},
): Promise<SitemapCollection> {
  const queue = [...new Set(roots)];
  const seen = new Set<string>();
  const urls: SitemapCollection["urls"] = [];
  const seenUrls = new Set<string>();
  const sitemapsFetched: string[] = [];
  const errors: SitemapCollection["errors"] = [];
  let partial = false;

  while (queue.length) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    if (sitemapsFetched.length >= maxSitemaps) {
      partial = true;
      break;
    }
    seen.add(next);
    try {
      const res = await fetchText(next);
      if (res.status !== 200) {
        errors.push({ url: next, error: `HTTP ${res.status}` });
        continue;
      }
      sitemapsFetched.push(next);
      const parsed = parseSitemap(sitemapBodyToText(res.body));
      if (parsed.kind === "unknown") {
        errors.push({ url: next, error: "Not a valid XML sitemap" });
        continue;
      }
      if (parsed.kind === "index") {
        for (const e of parsed.entries) if (!seen.has(e.loc)) queue.push(e.loc);
      } else {
        for (const e of parsed.entries) {
          if (urls.length >= maxUrls) {
            partial = true;
            break;
          }
          if (!seenUrls.has(e.loc)) {
            seenUrls.add(e.loc);
            urls.push(e);
          }
        }
      }
    } catch (err) {
      errors.push({ url: next, error: (err as Error).message });
    }
  }
  return { urls, sitemapsFetched, errors, partial };
}
