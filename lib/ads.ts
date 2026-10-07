/**
 * Google AdSense settings. Ads appear only when both values are set (they're read at build
 * time, so redeploy after changing them), and only to visitors on the Free plan.
 *   NEXT_PUBLIC_ADSENSE_CLIENT  your publisher ID, e.g. ca-pub-1234567890123456
 *   NEXT_PUBLIC_ADSENSE_SLOT    a responsive display ad unit's slot ID, e.g. 1234567890
 */
export const ADSENSE_CLIENT = (process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "").trim();
export const ADSENSE_SLOT = (process.env.NEXT_PUBLIC_ADSENSE_SLOT ?? "").trim();

const CLIENT_RE = /^ca-pub-\d{10,20}$/;
const SLOT_RE = /^\d{6,12}$/;

export function adsConfigured(client = ADSENSE_CLIENT, slot = ADSENSE_SLOT): boolean {
  return CLIENT_RE.test(client) && SLOT_RE.test(slot);
}

/** The ads.txt line Google needs to authorize this site's ad inventory, or null without a publisher ID. */
export function adsTxt(client = ADSENSE_CLIENT): string | null {
  if (!CLIENT_RE.test(client)) return null;
  return `google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`;
}
