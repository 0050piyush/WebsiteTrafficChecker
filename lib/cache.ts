/** In-memory TTL cache with LRU eviction and in-flight request de-duplication. */
export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>();

  constructor(
    private readonly maxEntries = 500,
    private readonly defaultTtlMs = 60 * 60 * 1000,
  ) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh LRU position.
    this.store.delete(key);
    this.store.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V, ttlMs = this.defaultTtlMs): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expires: Date.now() + ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Memoize an async producer. Concurrent callers share one in-flight promise;
 * failures are never cached.
 */
export function memoizeAsync<T>(cache: TtlCache<Promise<T>>, key: string, produce: () => Promise<T>, ttlMs?: number): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit;
  const promise = produce();
  cache.set(key, promise, ttlMs);
  promise.catch(() => cache.delete(key));
  return promise;
}
