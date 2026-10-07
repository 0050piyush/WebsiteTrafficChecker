/**
 * Per-browser list of recent searches, kept in localStorage. Storage may be
 * unavailable (private mode, blocked site data); nothing here ever throws.
 */
const KEY = "trafficlens:recent";
const CHANGE_EVENT = "trafficlens:recent-change";
const MAX_STORED = 30;

export type RecentTool = "traffic" | "audit" | "analyzer" | "keywords" | "compare";

export interface RecentItem {
  tool: RecentTool;
  query: string;
  at: number;
}

const EMPTY: RecentItem[] = [];
let cachedRaw: string | null = null;
let cachedList: RecentItem[] = EMPTY;

/** Stable snapshot: returns the same array until storage actually changes. */
export function getRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cachedRaw) return cachedList;
    cachedRaw = raw;
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    cachedList = Array.isArray(parsed) ? parsed.filter((r): r is RecentItem => !!r && typeof r.query === "string" && typeof r.tool === "string") : EMPTY;
    return cachedList;
  } catch {
    return EMPTY;
  }
}

export function getServerRecent(): RecentItem[] {
  return EMPTY;
}

export function subscribeRecent(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function write(list: RecentItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_STORED)));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* storage unavailable */
  }
}

export function addRecent(tool: RecentTool, query: string): void {
  const q = query.trim();
  if (!q) return;
  write([{ tool, query: q, at: Date.now() }, ...getRecent().filter((r) => !(r.tool === tool && r.query.toLowerCase() === q.toLowerCase()))]);
}

export function removeRecent(tool: RecentTool, query: string): void {
  write(getRecent().filter((r) => !(r.tool === tool && r.query === query)));
}

/** Clear one tool's history, or everything when no tool is given. */
export function clearRecent(tool?: RecentTool): void {
  write(tool ? getRecent().filter((r) => r.tool !== tool) : []);
}
