import { jsonError, limit, json } from "@/lib/api";
import { runPageSpeed } from "@/lib/sources/pagespeed";
import { parseUrlInput } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** GET /api/v1/pagespeed?url=https://example.com&strategy=mobile|desktop — Lighthouse + Chrome UX Report data. */
export async function GET(request: Request) {
  const limited = limit(request, "pagespeed", 10);
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const url = parseUrlInput(params.get("url") ?? "");
  if (!url) return jsonError(400, "Enter a valid http(s) URL", "INVALID_URL");
  const strategy = params.get("strategy") === "desktop" ? "desktop" : "mobile";
  try {
    return json(await runPageSpeed(url, strategy));
  } catch (err) {
    const status = (err as { status?: number }).status;
    return jsonError(status === 429 ? 503 : 502, (err as Error).message, "PAGESPEED_FAILED");
  }
}
