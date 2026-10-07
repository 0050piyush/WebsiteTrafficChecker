/**
 * Fixed-window, per-instance rate limiting. Good enough to stop a single client from
 * turning the crawler into a traffic cannon; put a shared store (e.g. Redis) behind
 * this interface if you run many instances.
 */
const windows = new Map<string, { count: number; resetAt: number }>();
const active = new Map<string, number>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    if (windows.size > 10_000) {
      for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
    }
    return { ok: true, retryAfterSec: 0 };
  }
  if (w.count >= max) return { ok: false, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  w.count++;
  return { ok: true, retryAfterSec: 0 };
}

/** Track long-running jobs (audits) per client. Returns a release function, or null if over the limit. */
export function acquireSlot(key: string, maxConcurrent: number): (() => void) | null {
  const n = active.get(key) ?? 0;
  if (n >= maxConcurrent) return null;
  active.set(key, n + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (active.get(key) ?? 1) - 1;
    if (left <= 0) active.delete(key);
    else active.set(key, left);
  };
}

export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "local";
}
