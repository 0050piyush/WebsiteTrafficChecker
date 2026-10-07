import { jsonError, limit, apiLimitPerMinute, json } from "@/lib/api";
import { analyzePage, AnalyzeError } from "@/lib/seo/analyze";
import { parseUrlInput } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/v1/analyze?url=https://example.com/page[&keyword=target phrase] */
export async function GET(request: Request) {
  const limited = limit(request, "analyze", Math.max(5, Math.floor(apiLimitPerMinute() / 2)));
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const url = parseUrlInput(params.get("url") ?? "");
  if (!url) return jsonError(400, "Enter a valid http(s) URL", "INVALID_URL");
  const keyword = (params.get("keyword") ?? "").trim().slice(0, 100) || undefined;
  try {
    return json(await analyzePage(url, { keyword, signal: request.signal }));
  } catch (err) {
    const e = err as AnalyzeError;
    const status = e.code === "BLOCKED_URL" || e.code === "NOT_HTML" ? 400 : 502;
    return jsonError(status, e.message, e.code ?? "ANALYZE_FAILED");
  }
}
