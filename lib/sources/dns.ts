import { Resolver } from "node:dns/promises";

export interface DnsInfo {
  a: string[];
  aaaa: string[];
  cname: string[];
  mx: { exchange: string; priority: number }[];
  ns: string[];
  txt: string[];
  caa: string[];
  spf: string | null;
  dmarc: string | null;
  dmarcPolicy: string | null;
  mailProvider: string | null;
  dnsProvider: string | null;
}

const MAIL_PROVIDERS: [RegExp, string][] = [
  [/google\.com$|googlemail\.com$/i, "Google Workspace"],
  [/outlook\.com$|protection\.outlook\.com$/i, "Microsoft 365"],
  [/zoho\.(?:com|eu|in)$/i, "Zoho Mail"],
  [/protonmail\.ch$|proton\.me$/i, "Proton Mail"],
  [/pphosted\.com$/i, "Proofpoint"],
  [/mimecast\.com$/i, "Mimecast"],
  [/amazonaws\.com$|amazonses\.com$/i, "Amazon SES/WorkMail"],
  [/mailgun\.org$/i, "Mailgun"],
  [/messagingengine\.com$/i, "Fastmail"],
  [/yandex\.(?:net|ru)$/i, "Yandex Mail"],
  [/secureserver\.net$/i, "GoDaddy"],
  [/icloud\.com$/i, "iCloud Mail"],
  [/mx\.cloudflare\.net$/i, "Cloudflare Email Routing"],
  [/barracudanetworks\.com$/i, "Barracuda"],
];

const DNS_PROVIDERS: [RegExp, string][] = [
  [/cloudflare\.com$/i, "Cloudflare"],
  [/awsdns/i, "Amazon Route 53"],
  [/azure-dns\./i, "Azure DNS"],
  [/googledomains\.com$|ns-cloud-[a-z0-9]+\.googledomains\.com$|google\.com$/i, "Google Cloud DNS"],
  [/domaincontrol\.com$/i, "GoDaddy"],
  [/registrar-servers\.com$/i, "Namecheap"],
  [/nsone\.net$/i, "NS1"],
  [/ultradns\./i, "UltraDNS"],
  [/dynect\.net$/i, "Oracle Dyn"],
  [/akam\.net$|akamaiedge\.net$/i, "Akamai"],
  [/vercel-dns\.com$/i, "Vercel"],
  [/netlify\.com$/i, "Netlify"],
  [/digitalocean\.com$/i, "DigitalOcean"],
  [/linode\.com$/i, "Akamai Linode"],
  [/hetzner\.(?:com|de)$/i, "Hetzner"],
  [/ovh\.net$/i, "OVHcloud"],
  [/wixdns\.net$/i, "Wix"],
  [/squarespacedns\.com$/i, "Squarespace"],
  [/hostgator\.com$/i, "HostGator"],
  [/bluehost\.com$/i, "Bluehost"],
  [/name-services\.com$/i, "Enom"],
  [/dnsimple\.com$/i, "DNSimple"],
  [/dnsmadeeasy\.com$/i, "DNS Made Easy"],
];

function detect(names: string[], table: [RegExp, string][]): string | null {
  for (const n of names) {
    const host = n.replace(/\.$/, "");
    for (const [re, label] of table) if (re.test(host)) return label;
  }
  return null;
}

export async function getDnsInfo(hostname: string, domain: string): Promise<DnsInfo> {
  const resolver = new Resolver({ timeout: 4000, tries: 2 });
  const safe = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const [a, aaaa, cname, mx, ns, txt, caa, dmarcTxt] = await Promise.all([
    safe(resolver.resolve4(hostname), [] as string[]),
    safe(resolver.resolve6(hostname), [] as string[]),
    safe(resolver.resolveCname(hostname), [] as string[]),
    safe(resolver.resolveMx(domain), [] as { exchange: string; priority: number }[]),
    safe(resolver.resolveNs(domain), [] as string[]),
    safe(resolver.resolveTxt(domain), [] as string[][]),
    safe(resolver.resolveCaa(domain), [] as { critical: number; issue?: string; issuewild?: string; iodef?: string }[]),
    safe(resolver.resolveTxt(`_dmarc.${domain}`), [] as string[][]),
  ]);
  const txtFlat = txt.map((parts) => parts.join(""));
  const dmarc = dmarcTxt.map((p) => p.join("")).find((t) => /^v=DMARC1/i.test(t)) ?? null;
  const mxSorted = [...mx].sort((x, y) => x.priority - y.priority);
  return {
    a,
    aaaa,
    cname,
    mx: mxSorted,
    ns: ns.map((n) => n.toLowerCase()).sort(),
    txt: txtFlat.slice(0, 30),
    caa: caa.map((c) => (c.issue ? `issue ${c.issue}` : c.issuewild ? `issuewild ${c.issuewild}` : c.iodef ? `iodef ${c.iodef}` : "")).filter(Boolean),
    spf: txtFlat.find((t) => /^v=spf1/i.test(t)) ?? null,
    dmarc,
    dmarcPolicy: dmarc ? (/;\s*p=(\w+)/i.exec(dmarc)?.[1]?.toLowerCase() ?? null) : null,
    mailProvider: detect(mxSorted.map((m) => m.exchange), MAIL_PROVIDERS),
    dnsProvider: detect(ns, DNS_PROVIDERS),
  };
}
