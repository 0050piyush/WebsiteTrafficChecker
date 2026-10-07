import { jsonError, limit, json } from "@/lib/api";
import { mapLimit } from "@/lib/concurrency";
import { probeUrl } from "@/lib/net/fetcher";
import { parseUrlInput } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_URLS = 150;

/** POST /api/v1/links  { "urls": ["https://…", …] } — HTTP status of up to 150 links. */
export async function POST(request: Request) {
  const limited = limit(request, "links", 6);
  if (limited) return limited;
  let body: { urls?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Body must be JSON: { \"urls\": [...] }", "INVALID_BODY");
  }
  if (!Array.isArray(body.urls) || !body.urls.length) return jsonError(400, "Provide a non-empty urls array", "MISSING_URLS");
  const urls = [...new Set(body.urls.filter((u): u is string => typeof u === "string").map((u) => parseUrlInput(u)).filter((u): u is string => !!u))].slice(0, MAX_URLS);

  const results = await mapLimit(
    urls,
    8,
    async (url) => {
      const r = await probeUrl(url, { timeoutMs: 10_000, signal: request.signal });
      return { url, status: r.status, finalUrl: r.finalUrl, redirects: r.redirects, error: r.error ?? null, code: r.code ?? null };
    },
    request.signal,
  );
  return json({ checked: results.filter(Boolean).length, truncated: body.urls.length > MAX_URLS, results: results.filter(Boolean) });
}
