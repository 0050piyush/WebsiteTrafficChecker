import { parse } from "tldts";

export interface DomainInput {
  /** Hostname exactly as it should be fetched, e.g. "blog.example.com". */
  hostname: string;
  /** Registrable domain (eTLD+1), e.g. "example.com". Rankings are keyed on this. */
  domain: string;
}

/**
 * Accepts anything a person might paste — "Example.com", "https://www.example.com/page?x",
 * "example.com:443" — and returns a clean hostname plus its registrable domain.
 */
export function parseDomainInput(raw: string): DomainInput | null {
  const input = raw.trim();
  if (!input || input.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const info = parse(hostname);
  if (info.isIp || !info.domain || !info.publicSuffix) return null;
  if (!info.isIcann && !info.isPrivate) return null;
  return { hostname, domain: info.domain };
}

/** Normalize a URL typed by a user; adds https:// when the scheme is missing. */
export function parseUrlInput(raw: string): string | null {
  const input = raw.trim();
  if (!input || input.length > 2048) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && process.env.ALLOW_PRIVATE_HOSTS !== "true") return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

/** Resolve a link found on a page into a crawlable absolute URL (no fragment). */
export function resolveLink(href: string, base: string | URL): string | null {
  const trimmed = href.trim();
  if (!trimmed || /^(javascript|mailto|tel|data|sms|ftp|blob|about|file):/i.test(trimmed) || trimmed.startsWith("#")) return null;
  try {
    const url = new URL(trimmed, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

export function stripWww(hostname: string): string {
  return hostname.replace(/^www\./, "");
}

/** Same site for crawl purposes: identical host, ignoring a leading "www.". */
export function isSameSite(a: string | URL, b: string | URL): boolean {
  try {
    const ha = typeof a === "string" ? new URL(a).hostname : a.hostname;
    const hb = typeof b === "string" ? new URL(b).hostname : b.hostname;
    return stripWww(ha) === stripWww(hb);
  } catch {
    return false;
  }
}

export function registrableDomain(hostname: string): string | null {
  return parse(hostname).domain ?? null;
}
