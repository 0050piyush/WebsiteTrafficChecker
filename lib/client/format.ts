const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-US");

export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return compact.format(n);
}

export function fmtNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return full.format(Math.round(n));
}

/**
 * Compact axis label with just enough decimals for the tick spacing, so neighbouring
 * ticks never print the same text (13.05M vs 13.1M instead of 13.1M twice).
 */
export function fmtAxis(n: number, step?: number): string {
  const abs = Math.abs(n);
  const [div, suffix] = abs >= 1e9 ? [1e9, "B"] : abs >= 1e6 ? [1e6, "M"] : abs >= 1e3 ? [1e3, "K"] : [1, ""];
  const scaledStep = step ? step / div : 1;
  const decimals = scaledStep >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(scaledStep) - 1e-9));
  return `${Number((n / div).toFixed(decimals)).toLocaleString("en-US", { maximumFractionDigits: decimals })}${suffix}`;
}

export function fmtRank(n: number | null | undefined): string {
  return n ? `#${full.format(n)}` : "—";
}

export function fmtBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtMs(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)} s` : `${Math.round(n)} ms`;
}

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(+d) ? "—" : d.toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function fmtYears(years: number | null | undefined): string {
  if (years === null || years === undefined) return "—";
  if (years < 1) return `${Math.max(1, Math.round(years * 12))} months`;
  return `${years >= 10 ? Math.floor(years) : years.toFixed(1)} years`;
}

export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url;
  }
}
