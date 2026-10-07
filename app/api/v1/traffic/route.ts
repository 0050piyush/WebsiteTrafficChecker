import { jsonError, limit, apiLimitPerMinute, json } from "@/lib/api";
import { buildTrafficSection } from "@/lib/overview";
import { getTrancoRanks } from "@/lib/sources/tranco";
import { parseDomainInput } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_DOMAINS = 8;

/** GET /api/v1/traffic?domains=a.com,b.com — popularity rank, history and visit estimates (max 8). */
export async function GET(request: Request) {
  const limited = limit(request, "traffic", apiLimitPerMinute());
  if (limited) return limited;
  const raw = (new URL(request.url).searchParams.get("domains") ?? new URL(request.url).searchParams.get("domain") ?? "")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (!raw.length) return jsonError(400, "Pass one or more domains, e.g. ?domains=example.com,example.org", "MISSING_DOMAINS");
  if (raw.length > MAX_DOMAINS) return jsonError(400, `Compare up to ${MAX_DOMAINS} domains at a time.`, "TOO_MANY_DOMAINS");

  const seen = new Set<string>();
  const results = await Promise.all(
    raw.map(async (input) => {
      const target = parseDomainInput(input);
      if (!target) return { input, ok: false as const, error: "Not a valid domain" };
      if (seen.has(target.domain)) return { input, domain: target.domain, ok: false as const, error: "Duplicate domain" };
      seen.add(target.domain);
      try {
        return { input, domain: target.domain, ok: true as const, data: buildTrafficSection(await getTrancoRanks(target.domain)) };
      } catch (err) {
        return { input, domain: target.domain, ok: false as const, error: (err as Error).message };
      }
    }),
  );
  return json({ generatedAt: new Date().toISOString(), results });
}
