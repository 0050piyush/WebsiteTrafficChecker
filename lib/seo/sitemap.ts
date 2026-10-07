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
  {
    maxSitemaps = 10,
    maxUrls = 50_000,
    concurrency = 1,
    deadline,
  }: {
    maxSitemaps?: number;
    maxUrls?: number;
    /** Sitemaps fetched in parallel. */
    concurrency?: number;
    /** Epoch ms after which no new sitemaps are fetched (the result is marked partial). */
    deadline?: number;
  } = {},
): Promise<SitemapCollection> {
  const queue = [...new Set(roots)];
  const seen = new Set<string>();
  const urls: SitemapCollection["urls"] = [];
  const seenUrls = new Set<string>();
  const sitemapsFetched: string[] = [];
  const errors: SitemapCollection["errors"] = [];
  let attempted = 0;
  let partial = false;

  while (queue.length) {
    if (deadline && Date.now() >= deadline) {
      partial = true;
      break;
    }
    const batch: string[] = [];
    while (queue.length && batch.length < concurrency) {
      const next = queue.shift()!;
      if (seen.has(next)) continue;
      if (attempted >= maxSitemaps) {
        partial = true;
        queue.length = 0;
        break;
      }
      seen.add(next);
      attempted++;
      batch.push(next);
    }
    const results = await Promise.allSettled(batch.map((u) => fetchText(u)));
    results.forEach((result, i) => {
      const url = batch[i];
      if (result.status === "rejected") {
        errors.push({ url, error: (result.reason as Error)?.message ?? "Failed" });
        return;
      }
      if (result.value.status !== 200) {
        errors.push({ url, error: `HTTP ${result.value.status}` });
        return;
      }
      sitemapsFetched.push(url);
      const parsed = parseSitemap(sitemapBodyToText(result.value.body));
      if (parsed.kind === "unknown") {
        errors.push({ url, error: "Not a valid XML sitemap" });
      } else if (parsed.kind === "index") {
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
    });
  }
  return { urls, sitemapsFetched, errors, partial };
}
