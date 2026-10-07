/**
 * fetch() wrapper for calls to fixed, trusted public APIs (not user-supplied URLs,
 * which must go through lib/net/fetcher). Adds a timeout and a descriptive UA.
 */
export class SourceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SourceError";
  }
}

export const API_USER_AGENT = "TrafficLens/1.0 (+https://github.com/0050piyush/WebsiteTrafficChecker)";

export async function getJson<T = unknown>(
  url: string,
  { timeoutMs = 10_000, headers = {}, signal }: { timeoutMs?: number; headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<{ status: number; data: T | null }> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": API_USER_AGENT, ...headers },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    redirect: "follow",
  }).catch((err: Error) => {
    throw new SourceError(err.name === "TimeoutError" ? "The data source timed out" : `The data source is unreachable (${err.message})`);
  });
  if (res.status === 404) return { status: 404, data: null };
  if (res.status === 429) throw new SourceError("The data source is rate limiting requests; try again in a minute", 429);
  if (!res.ok) throw new SourceError(`The data source returned HTTP ${res.status}`, res.status);
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) as T };
  } catch {
    throw new SourceError("The data source returned invalid JSON", res.status);
  }
}
