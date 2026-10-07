import dns from "node:dns";
import ipaddr from "ipaddr.js";

/**
 * SSRF protection. Every user-supplied URL is fetched through these checks so the
 * server can never be used to reach loopback, private networks or cloud metadata
 * endpoints. The DNS check runs at connect time (via `safeLookup`), which also
 * defeats DNS-rebinding tricks where a name resolves differently on a second lookup.
 */

const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);

export class BlockedUrlError extends Error {
  readonly code = "BLOCKED_URL";
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

export function allowPrivateHosts(): boolean {
  return process.env.ALLOW_PRIVATE_HOSTS === "true";
}

export function isPublicIp(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  let addr = ipaddr.parse(address);
  if (addr.kind() === "ipv6") {
    const v6 = addr as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) addr = v6.toIPv4Address();
  }
  return addr.range() === "unicast";
}

export function assertFetchableUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError(`Only http and https URLs are supported (got ${url.protocol})`);
  }
  if (url.username || url.password) {
    throw new BlockedUrlError("URLs with embedded credentials are not allowed");
  }
  if (allowPrivateHosts()) return;

  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) {
    throw new BlockedUrlError(`Port ${port} is not allowed`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (ipaddr.isValid(host)) {
    if (!isPublicIp(host)) throw new BlockedUrlError(`${host} is not a public address`);
    return;
  }
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    !host.includes(".")
  ) {
    throw new BlockedUrlError(`${host} is not a public hostname`);
  }
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family?: number,
) => void;

/** Drop-in replacement for dns.lookup that refuses non-public addresses. */
export function safeLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const list = addresses as dns.LookupAddress[];
    if (!list.length) {
      const e: NodeJS.ErrnoException = new Error(`getaddrinfo ENOTFOUND ${hostname}`);
      e.code = "ENOTFOUND";
      return callback(e, []);
    }
    if (!allowPrivateHosts()) {
      const blocked = list.find((a) => !isPublicIp(a.address));
      if (blocked) {
        const e = new BlockedUrlError(`${hostname} resolves to a non-public address`) as unknown as NodeJS.ErrnoException;
        return callback(e, []);
      }
    }
    if (options.all) callback(null, list);
    else callback(null, list[0].address, list[0].family);
  });
}
