import { jsonError, limit, apiLimitPerMinute, ndjson, json } from "@/lib/api";
import { runOverview, type SectionEvent } from "@/lib/overview";
import { parseDomainInput } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/v1/overview?domain=example.com[&format=json]
 * Streams one NDJSON line per section as soon as it is ready (default), or returns
 * all sections in one JSON object with format=json.
 */
export async function GET(request: Request) {
  const limited = limit(request, "overview", Math.max(5, Math.floor(apiLimitPerMinute() / 3)));
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const target = parseDomainInput(params.get("domain") ?? "");
  if (!target) return jsonError(400, "Enter a valid domain name, e.g. example.com", "INVALID_DOMAIN");

  if (params.get("format") === "json") {
    const sections: Record<string, unknown> = {};
    await runOverview(target, (e: SectionEvent) => {
      sections[e.section] = e.status === "ok" ? { status: "ok", data: e.data, ms: e.ms } : { status: "error", error: e.error, ms: e.ms };
    }, request.signal);
    return json({ domain: target.domain, hostname: target.hostname, generatedAt: new Date().toISOString(), sections });
  }

  return ndjson(request, async (send, signal) => {
    send({ type: "meta", domain: target.domain, hostname: target.hostname });
    await runOverview(target, (e) => send({ type: "section", ...e }), signal);
    send({ type: "done" });
  });
}
