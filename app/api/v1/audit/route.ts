import { boolParam, jsonError, limit, ndjson } from "@/lib/api";
import { runAudit, DEFAULT_AUDIT_OPTIONS } from "@/lib/audit/crawler";
import { acquireSlot, clientKey } from "@/lib/rate-limit";
import { parseUrlInput } from "@/lib/url";
import { maxAuditPages } from "@/lib/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/v1/audit?url=https://example.com&maxPages=100
 *   [&concurrency=4&respectRobots=1&checkExternal=1&checkResources=1&useSitemap=1]
 * Streams NDJSON events: start, info, page, phase, progress, then done (full report).
 */
export async function GET(request: Request) {
  const limited = limit(request, "audit", 10, 60 * 60 * 1000);
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const url = parseUrlInput(params.get("url") ?? "");
  if (!url) return jsonError(400, "Enter a valid http(s) URL", "INVALID_URL");

  const cap = maxAuditPages();
  const requested = Number(params.get("maxPages") ?? DEFAULT_AUDIT_OPTIONS.maxPages);
  const options = {
    maxPages: Math.min(cap, Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : DEFAULT_AUDIT_OPTIONS.maxPages)),
    concurrency: Math.min(5, Math.max(1, Number(params.get("concurrency")) || DEFAULT_AUDIT_OPTIONS.concurrency)),
    respectRobots: boolParam(params.get("respectRobots"), true),
    checkExternal: boolParam(params.get("checkExternal"), true),
    checkResources: boolParam(params.get("checkResources"), true),
    useSitemap: boolParam(params.get("useSitemap"), true),
  };

  const release = acquireSlot(`audit:${clientKey(request.headers)}`, 1);
  if (!release) return jsonError(429, "You already have an audit running. Wait for it to finish or cancel it.", "AUDIT_IN_PROGRESS");

  return ndjson(
    request,
    async (send, signal) => {
      const report = await runAudit(url, options, (e) => send(e), signal);
      send({ type: "done", report });
    },
    release,
  );
}
