"use client";

import { useState } from "react";

export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

/** Horizontal bars, labeled at the tip, with a per-bar hover/focus readout. */
export function BarList({ items, total, ariaLabel }: { items: BarItem[]; total?: number; ariaLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...items.map((i) => i.value));
  const sum = total ?? items.reduce((s, i) => s + i.value, 0);
  return (
    <ul className="space-y-1.5" aria-label={ariaLabel}>
      {items.map((item, idx) => {
        const pct = sum ? Math.round((item.value / sum) * 1000) / 10 : 0;
        return (
          <li
            key={item.label}
            tabIndex={0}
            className="group relative grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 rounded-md px-1 py-0.5 outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent"
            onPointerEnter={() => setActive(idx)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(idx)}
            onBlur={() => setActive(null)}
            aria-label={`${item.label}: ${item.value.toLocaleString("en-US")} (${pct}%)`}
          >
            <span className="truncate text-xs text-ink-2">{item.label}</span>
            <span className="block h-3" aria-hidden>
              <span className="block h-3 rounded-r" style={{ width: `${(item.value / max) * 100}%`, minWidth: item.value ? 3 : 0, background: item.color ?? "var(--series-1)" }} />
            </span>
            <span className="tabular text-xs text-ink">{item.value.toLocaleString("en-US")}</span>
            {active === idx && (
              <span className="pointer-events-none absolute -top-8 left-32 z-10 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-md" role="status">
                <span className="font-semibold text-ink">{item.value.toLocaleString("en-US")}</span> <span className="text-ink-3">{item.label} · {pct}%</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
