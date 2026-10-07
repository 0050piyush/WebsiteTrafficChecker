"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "./ui";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  initialSort,
  pageSize = 50,
  empty = "Nothing to show",
  minWidth = 720,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T, index: number) => string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  pageSize?: number;
  empty?: ReactNode;
  minWidth?: number;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, columns, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const shown = sorted.slice(current * pageSize, current * pageSize + pageSize);

  const toggleSort = (key: string) => {
    setPage(0);
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cx("whitespace-nowrap px-3 py-2.5 font-medium first:pl-5 last:pr-5", c.align === "right" && "text-right")} aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className={cx("inline-flex items-center gap-1 hover:text-ink", sort?.key === c.key && "text-ink")}>
                      {c.header}
                      {sort?.key === c.key && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.length ? (
              shown.map((row, i) => (
                <tr key={rowKey(row, current * pageSize + i)} className="hover:bg-surface-2/60">
                  {columns.map((c) => (
                    <td key={c.key} className={cx("px-3 py-2.5 align-top first:pl-5 last:pr-5", c.align === "right" && "tabular text-right", c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-5 py-10 text-center text-ink-3">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-xs text-ink-3">
          <span className="tabular">
            {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} of {sorted.length.toLocaleString("en-US")}
          </span>
          <div className="flex gap-1">
            <button type="button" onClick={() => setPage(current - 1)} disabled={current === 0} className="rounded-md p-1.5 hover:bg-surface-2 disabled:opacity-40" aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} className="rounded-md p-1.5 hover:bg-surface-2 disabled:opacity-40" aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: ReactNode }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line px-3" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cx("-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors", active === t.id ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function FilterInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-9 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-accent sm:w-64"
    />
  );
}
