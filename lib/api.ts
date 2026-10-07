import { clientKey, rateLimit } from "./rate-limit";

export function jsonError(status: number, message: string, code = "ERROR", headers: Record<string, string> = {}): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store", ...headers } });
}

export function json(data: unknown, init: { status?: number; maxAge?: number } = {}): Response {
  return Response.json(data, {
    status: init.status ?? 200,
    headers: { "cache-control": init.maxAge ? `public, max-age=${init.maxAge}` : "no-store" },
  });
}

/** Per-IP limit for a named bucket. Returns an error response when exceeded. */
export function limit(request: Request, bucket: string, max: number, windowMs = 60_000): Response | null {
  const key = `${bucket}:${clientKey(request.headers)}`;
  const r = rateLimit(key, max, windowMs);
  if (r.ok) return null;
  return jsonError(429, `Too many requests. Try again in ${r.retryAfterSec}s.`, "RATE_LIMITED", { "retry-after": String(r.retryAfterSec) });
}

export function apiLimitPerMinute(): number {
  const n = Number(process.env.API_RATE_LIMIT_PER_MINUTE);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

/**
 * Stream newline-delimited JSON. The handler receives a `send` function and an
 * AbortSignal that fires when the client disconnects, so long jobs stop promptly.
 */
export function ndjson(
  request: Request,
  run: (send: (obj: unknown) => void, signal: AbortSignal) => Promise<void>,
  onDone?: () => void,
): Response {
  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal?.addEventListener("abort", () => abort.abort(), { once: true });
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        } catch {
          closed = true;
        }
      };
      // Keep proxies from timing out idle connections during slow steps.
      const heartbeat = setInterval(() => send({ type: "heartbeat" }), 15_000);
      try {
        await run(send, abort.signal);
      } catch (err) {
        if (!abort.signal.aborted) send({ type: "error", message: (err as Error).message || "Unexpected error" });
      } finally {
        clearInterval(heartbeat);
        onDone?.();
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
    cancel() {
      closed = true;
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

export function boolParam(v: string | null, fallback: boolean): boolean {
  if (v === null) return fallback;
  return !["0", "false", "no", "off"].includes(v.toLowerCase());
}
