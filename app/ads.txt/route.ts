import { adsTxt } from "@/lib/ads";

export const dynamic = "force-static";

/** GET /ads.txt: authorizes Google to sell ads on this site (IAB ads.txt standard). */
export function GET() {
  const body = adsTxt();
  if (!body) return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
