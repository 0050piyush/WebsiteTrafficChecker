import { json } from "@/lib/api";
import { maxAuditPages } from "@/lib/limits";
import { SUGGEST_SOURCES } from "@/lib/sources/autocomplete";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/status — which optional integrations are configured, and limits. */
export async function GET() {
  return json({
    ok: true,
    version: "1.0.0",
    integrations: {
      popularity: true,
      rdap: true,
      wayback: true,
      dns: true,
      pagespeed: { enabled: true, apiKey: !!process.env.PAGESPEED_API_KEY },
      openPageRank: { enabled: !!process.env.OPENPAGERANK_API_KEY },
    },
    limits: { maxAuditPages: maxAuditPages(), compareDomains: 8, linkCheck: 150 },
    keywordSources: SUGGEST_SOURCES,
  });
}
