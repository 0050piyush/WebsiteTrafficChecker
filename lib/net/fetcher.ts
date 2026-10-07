import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import type { Readable } from "node:stream";
import type { TLSSocket } from "node:tls";
import { assertFetchableUrl, safeLookup } from "./guard";

/**
 * A small HTTP client for fetching *user-supplied* URLs. Unlike `fetch`, it exposes
 * what an SEO tool needs: every redirect hop, time to first byte, bytes on the wire
 * vs. decompressed size, the remote IP and the TLS certificate. All connections go
 * through the SSRF guard.
 */

export const BOT_TOKEN = "TrafficLensBot";
export const USER_AGENT = `Mozilla/5.0 (compatible; ${BOT_TOKEN}/1.0; +https://github.com/0050piyush/WebsiteTrafficChecker)`;

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

export interface FetchOptions {
  method?: "GET" | "HEAD";
  /** Overall timeout for each hop, in milliseconds. */
  timeoutMs?: number;
  /** Maximum decompressed body size; larger bodies are truncated. */
  maxBytes?: number;
  /** 0 returns the 3xx response itself instead of following it. */
  maxRedirects?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  agents?: { http: http.Agent; https: https.Agent };
}

export interface RedirectHop {
  url: string;
  status: number;
  location: string;
}

export interface TlsInfo {
  protocol: string | null;
  cipher: string | null;
  subject: string | null;
  issuer: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysRemaining: number | null;
  altNames: string[];
}

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  redirects: RedirectHop[];
  body: Buffer;
  truncated: boolean;
  /** Bytes received for the final response body, before decompression. */
  transferBytes: number;
  contentEncoding: string | null;
  timing: { ttfbMs: number; totalMs: number };
  remoteAddress: string | null;
  httpVersion: string;
  tls: TlsInfo | null;
}

export class FetchError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly url: string,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

interface HopResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: Buffer;
  truncated: boolean;
  transferBytes: number;
  ttfbMs: number;
  remoteAddress: string | null;
  httpVersion: string;
  tls: TlsInfo | null;
}

function flattenHeaders(raw: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(key === "set-cookie" ? "\n" : ", ") : value;
  }
  return out;
}

function extractTls(socket: TLSSocket): TlsInfo | null {
  if (typeof socket.getPeerCertificate !== "function") return null;
  const cert = socket.getPeerCertificate();
  if (!cert || Object.keys(cert).length === 0) return null;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
  const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
  return {
    protocol: socket.getProtocol?.() ?? null,
    cipher: socket.getCipher?.()?.name ?? null,
    subject: first(cert.subject?.CN),
    issuer: first(cert.issuer?.O) ?? first(cert.issuer?.CN),
    validFrom: validFrom && !isNaN(+validFrom) ? validFrom.toISOString() : null,
    validTo: validTo && !isNaN(+validTo) ? validTo.toISOString() : null,
    daysRemaining: validTo && !isNaN(+validTo) ? Math.floor((+validTo - Date.now()) / 86_400_000) : null,
    altNames: (cert.subjectaltname ?? "")
      .split(",")
      .map((s) => s.trim().replace(/^DNS:/, ""))
      .filter(Boolean),
  };
}

const ERROR_MESSAGES: Record<string, string> = {
  ENOTFOUND: "Domain name could not be resolved (DNS lookup failed)",
  EAI_AGAIN: "DNS lookup timed out",
  ECONNREFUSED: "Connection refused by the server",
  ECONNRESET: "Connection was reset by the server",
  EHOSTUNREACH: "Host is unreachable",
  ENETUNREACH: "Network is unreachable",
  ETIMEDOUT: "Connection timed out",
  TIMEOUT: "Request timed out",
  CERT_HAS_EXPIRED: "TLS certificate has expired",
  DEPTH_ZERO_SELF_SIGNED_CERT: "TLS certificate is self-signed",
  SELF_SIGNED_CERT_IN_CHAIN: "TLS certificate chain contains a self-signed certificate",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "TLS certificate chain is incomplete",
  ERR_TLS_CERT_ALTNAME_INVALID: "TLS certificate does not match the hostname",
  HPE_INVALID_HEADER_TOKEN: "Server sent an invalid HTTP header",
};

function toFetchError(err: unknown, url: string): FetchError {
  if (err instanceof FetchError) return err;
  const e = err as NodeJS.ErrnoException & { code?: string };
  const code = e?.code ?? "FETCH_FAILED";
  if (code === "BLOCKED_URL") return new FetchError(e.message, code, url);
  if (code === "ABORT_ERR" || e?.name === "AbortError") return new FetchError("Request was cancelled", "ABORTED", url);
  return new FetchError(ERROR_MESSAGES[code] ?? e?.message ?? "Request failed", code, url);
}

function decompressor(encoding: string): zlib.Gunzip | zlib.Inflate | zlib.BrotliDecompress | null {
  const opts = { finishFlush: zlib.constants.Z_SYNC_FLUSH };
  switch (encoding) {
    case "gzip":
    case "x-gzip":
      return zlib.createGunzip(opts);
    case "deflate":
      return zlib.createInflate(opts);
    case "br":
      return zlib.createBrotliDecompress({ finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH });
    default:
      return null;
  }
}

function requestOnce(url: URL, opts: FetchOptions, followingRedirects: boolean): Promise<HopResult> {
  assertFetchableUrl(url);
  const isHttps = url.protocol === "https:";
  const mod = isHttps ? https : http;
  const method = opts.method ?? "GET";
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;

  return new Promise<HopResult>((resolve, reject) => {
    let settled = false;
    const start = performance.now();
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(toFetchError(err, url.href));
    };

    const req = mod.request(
      url,
      {
        method,
        agent: opts.agents ? (isHttps ? opts.agents.https : opts.agents.http) : false,
        lookup: safeLookup as unknown as http.RequestOptions["lookup"],
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "accept-encoding": "gzip, deflate, br",
          ...opts.headers,
        },
      },
      (res) => {
        const ttfbMs = performance.now() - start;
        const headers = flattenHeaders(res.headers);
        const tls = isHttps ? extractTls(res.socket as TLSSocket) : null;
        const remoteAddress = res.socket?.remoteAddress ?? null;
        const base = {
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? "",
          headers,
          ttfbMs,
          remoteAddress,
          httpVersion: res.httpVersion,
          tls,
        };

        const isFollowedRedirect = followingRedirects && REDIRECT_CODES.has(base.status) && !!headers["location"];
        if (method === "HEAD" || isFollowedRedirect) {
          res.resume();
          settled = true;
          cleanup();
          resolve({ ...base, body: Buffer.alloc(0), truncated: false, transferBytes: 0 });
          return;
        }

        let transferBytes = 0;
        res.on("data", (chunk: Buffer) => {
          transferBytes += chunk.length;
        });
        const encoding = (headers["content-encoding"] ?? "").toLowerCase().trim();
        const decoder = decompressor(encoding);
        const stream: Readable = decoder ? res.pipe(decoder) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;

        const finish = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve({ ...base, body: Buffer.concat(chunks), truncated, transferBytes });
        };

        stream.on("data", (chunk: Buffer) => {
          if (settled) return;
          size += chunk.length;
          if (size > maxBytes) {
            truncated = true;
            chunks.push(chunk.subarray(0, chunk.length - (size - maxBytes)));
            finish();
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", finish);
        stream.on("error", (err) => {
          // A corrupt or truncated compressed stream still gives us usable bytes.
          if (chunks.length) finish();
          else fail(err);
        });
        res.on("close", () => {
          if (res.complete) return;
          if (chunks.length) finish();
          else fail(new FetchError("Connection closed before the response finished", "ECONNRESET", url.href));
        });
      },
    );

    const timer = setTimeout(() => {
      req.destroy(new FetchError(`Request timed out after ${Math.round(timeoutMs / 1000)}s`, "TIMEOUT", url.href));
    }, timeoutMs);
    const onAbort = () => req.destroy(Object.assign(new Error("Request was cancelled"), { code: "ABORT_ERR" }));
    if (opts.signal) {
      if (opts.signal.aborted) {
        clearTimeout(timer);
        reject(new FetchError("Request was cancelled", "ABORTED", url.href));
        return;
      }
      opts.signal.addEventListener("abort", onAbort, { once: true });
    }
    function cleanup() {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    }

    req.on("error", fail);
    req.end();
  });
}

/** Fetch a URL, following redirects (re-validating every hop) up to `maxRedirects`. */
export async function fetchUrl(input: string, opts: FetchOptions = {}): Promise<FetchResult> {
  let current: URL;
  try {
    current = new URL(input);
  } catch {
    throw new FetchError("Invalid URL", "INVALID_URL", input);
  }
  const maxRedirects = opts.maxRedirects ?? 10;
  const redirects: RedirectHop[] = [];
  const seen = new Set<string>([current.href]);
  const totalStart = performance.now();

  for (;;) {
    // Bodies of redirects we are going to follow are not downloaded.
    const hop = await requestOnce(current, opts, maxRedirects > 0);
    const location = hop.headers["location"];
    if (REDIRECT_CODES.has(hop.status) && location && maxRedirects > 0) {
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new FetchError(`Invalid redirect location: ${location}`, "BAD_REDIRECT", current.href);
      }
      redirects.push({ url: current.href, status: hop.status, location: next.href });
      if (seen.has(next.href)) throw new FetchError("Redirect loop detected", "REDIRECT_LOOP", input);
      if (redirects.length > maxRedirects) throw new FetchError("Too many redirects", "TOO_MANY_REDIRECTS", input);
      seen.add(next.href);
      current = next;
      continue;
    }
    return {
      url: input,
      finalUrl: current.href,
      status: hop.status,
      statusText: hop.statusText,
      headers: hop.headers,
      redirects,
      body: hop.body,
      truncated: hop.truncated,
      transferBytes: hop.transferBytes,
      contentEncoding: hop.headers["content-encoding"] ?? null,
      timing: { ttfbMs: Math.round(hop.ttfbMs), totalMs: Math.round(performance.now() - totalStart) },
      remoteAddress: hop.remoteAddress,
      httpVersion: hop.httpVersion,
      tls: hop.tls,
    };
  }
}

/** Lightweight status probe used by link checkers: HEAD first, GET fallback. */
export async function probeUrl(
  url: string,
  opts: Pick<FetchOptions, "timeoutMs" | "signal" | "agents"> = {},
): Promise<{ status: number; finalUrl: string; redirects: number; error?: string; code?: string }> {
  try {
    let res = await fetchUrl(url, { ...opts, method: "HEAD", maxRedirects: 5 });
    // Many servers mishandle HEAD; confirm failures with a small GET.
    if (res.status === 405 || res.status === 403 || res.status === 501 || res.status >= 500 || res.status === 404) {
      res = await fetchUrl(url, { ...opts, method: "GET", maxRedirects: 5, maxBytes: 16 * 1024 });
    }
    return { status: res.status, finalUrl: res.finalUrl, redirects: res.redirects.length };
  } catch (err) {
    const e = toFetchError(err, url);
    return { status: 0, finalUrl: url, redirects: 0, error: e.message, code: e.code };
  }
}

/** Decode a response body using the declared or sniffed charset. */
export function decodeBody(body: Buffer, contentType?: string | null): string {
  let charset = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  if (!charset) {
    const head = body.subarray(0, 4096).toString("latin1");
    charset =
      /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ??
      /<\?xml[^>]+encoding=["']([\w-]+)/i.exec(head)?.[1];
  }
  try {
    return new TextDecoder(charset ?? "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

export function createAgents(maxSockets = 6) {
  return {
    http: new http.Agent({ keepAlive: true, maxSockets }),
    https: new https.Agent({ keepAlive: true, maxSockets }),
  };
}
