import { jsonError, limit, json } from "@/lib/api";
import { generateKeywordIdeas } from "@/lib/keywords/expand";
import { SUGGEST_SOURCES, type SuggestSource } from "@/lib/sources/autocomplete";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/v1/keywords?q=seed[&hl=en&gl=us&depth=quick|deep&sources=google,bing,duckduckgo,youtube,amazon] */
export async function GET(request: Request) {
  const limited = limit(request, "keywords", 10);
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  if (q.length < 2) return jsonError(400, "Enter a seed keyword of at least 2 characters", "INVALID_QUERY");
  if (q.length > 80) return jsonError(400, "Seed keyword must be 80 characters or fewer", "INVALID_QUERY");
  const hl = /^[a-z]{2}$/i.test(params.get("hl") ?? "") ? params.get("hl")!.toLowerCase() : "en";
  const gl = /^[a-z]{2}$/i.test(params.get("gl") ?? "") ? params.get("gl")!.toLowerCase() : "us";
  const depth = params.get("depth") === "deep" ? "deep" : "quick";
  const valid = new Set(SUGGEST_SOURCES.map((s) => s.id));
  const requested = (params.get("sources") ?? "google,bing,duckduckgo,youtube").split(",").filter((s): s is SuggestSource => valid.has(s as SuggestSource));
  if (!requested.length) return jsonError(400, "Pick at least one suggestion source", "INVALID_SOURCES");

  const report = await generateKeywordIdeas(q, { hl, gl, depth, sources: requested, signal: request.signal });
  if (!report.ideas.length && report.sourceStatus.every((s) => s.ok === 0)) {
    return jsonError(502, `No suggestion source responded (${report.sourceStatus.map((s) => `${s.source}: ${s.error ?? "failed"}`).join("; ")})`, "SOURCES_UNAVAILABLE");
  }
  return json(report);
}
