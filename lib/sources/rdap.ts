import { TtlCache, memoizeAsync } from "../cache";
import { getJson, SourceError } from "./http";

/**
 * Domain registration data via RDAP, the structured successor to WHOIS. We look up
 * the authoritative RDAP server for the TLD in IANA's bootstrap registry, and fall
 * back to the rdap.org redirector.
 */

export interface RdapInfo {
  domain: string;
  registrar: string | null;
  registeredAt: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
  ageYears: number | null;
  status: string[];
  nameservers: string[];
  dnssec: boolean | null;
  source: string;
}

const BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";
const bootstrapCache = new TtlCache<Promise<Map<string, string>>>(1, 24 * 60 * 60 * 1000);
const cache = new TtlCache<Promise<RdapInfo | null>>(2000, 24 * 60 * 60 * 1000);

async function bootstrap(): Promise<Map<string, string>> {
  return memoizeAsync(bootstrapCache, "dns", async () => {
    const { data } = await getJson<{ services: [string[], string[]][] }>(BOOTSTRAP_URL, { timeoutMs: 10_000 });
    const map = new Map<string, string>();
    for (const [tlds, urls] of data?.services ?? []) {
      const base = urls.find((u) => u.startsWith("https://")) ?? urls[0];
      if (base) for (const tld of tlds) map.set(tld.toLowerCase(), base.endsWith("/") ? base : `${base}/`);
    }
    return map;
  });
}

type VCard = [string, unknown[]];
interface RdapEntity {
  roles?: string[];
  vcardArray?: VCard;
  publicIds?: { type: string; identifier: string }[];
  entities?: RdapEntity[];
}
interface RdapResponse {
  ldhName?: string;
  events?: { eventAction: string; eventDate: string }[];
  entities?: RdapEntity[];
  nameservers?: { ldhName?: string }[];
  status?: string[];
  secureDNS?: { delegationSigned?: boolean };
}

function vcardName(entity: RdapEntity): string | null {
  const props = entity.vcardArray?.[1];
  if (!Array.isArray(props)) return null;
  for (const p of props) {
    if (Array.isArray(p) && p[0] === "fn" && typeof p[3] === "string" && p[3].trim()) return p[3].trim();
  }
  for (const p of props) {
    if (Array.isArray(p) && p[0] === "org" && typeof p[3] === "string" && p[3].trim()) return p[3].trim();
  }
  return null;
}

export function parseRdap(domain: string, json: unknown, source: string): RdapInfo {
  const r = (json ?? {}) as RdapResponse;
  const event = (name: string) => r.events?.find((e) => e.eventAction?.toLowerCase() === name)?.eventDate ?? null;
  const registeredAt = event("registration");
  const registrarEntity = r.entities?.find((e) => e.roles?.includes("registrar"));
  const registered = registeredAt ? new Date(registeredAt) : null;
  return {
    domain,
    registrar: registrarEntity ? vcardName(registrarEntity) : null,
    registeredAt: registered && !isNaN(+registered) ? registered.toISOString() : null,
    expiresAt: event("expiration"),
    updatedAt: event("last changed") ?? event("last update of rdap database"),
    ageYears: registered && !isNaN(+registered) ? Math.round(((Date.now() - +registered) / (365.25 * 86_400_000)) * 10) / 10 : null,
    status: r.status ?? [],
    nameservers: (r.nameservers ?? []).map((n) => (n.ldhName ?? "").toLowerCase()).filter(Boolean),
    dnssec: r.secureDNS?.delegationSigned ?? null,
    source,
  };
}

export function getRdap(domain: string): Promise<RdapInfo | null> {
  return memoizeAsync(cache, domain, async () => {
    const tld = domain.split(".").pop()!.toLowerCase();
    let base: string | undefined;
    try {
      base = (await bootstrap()).get(tld);
    } catch {
      base = undefined;
    }
    const urls = [base ? `${base}domain/${domain}` : null, `https://rdap.org/domain/${domain}`].filter((u): u is string => !!u);
    let lastError: unknown = null;
    for (const url of urls) {
      try {
        const { status, data } = await getJson(url, { timeoutMs: 10_000, headers: { accept: "application/rdap+json, application/json" } });
        if (status === 404 || !data) return null;
        return parseRdap(domain, data, new URL(url).hostname);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new SourceError("No RDAP server is available for this TLD");
  });
}
