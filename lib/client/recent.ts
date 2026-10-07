/** Per-browser list of recent searches. Storage may be unavailable; never throw. */
const KEY = "trafficlens:recent";

export interface RecentItem {
  tool: "traffic" | "audit" | "analyzer" | "keywords" | "compare";
  query: string;
  at: number;
}

export function getRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentItem[]) : [];
    return Array.isArray(list) ? list.slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function addRecent(tool: RecentItem["tool"], query: string): void {
  try {
    const list = getRecent().filter((r) => !(r.tool === tool && r.query === query));
    list.unshift({ tool, query, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12)));
  } catch {
    /* storage unavailable */
  }
}
