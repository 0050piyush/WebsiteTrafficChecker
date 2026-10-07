"use client";

import { useState } from "react";
import type { Check, CheckStatus } from "@/lib/seo/checks";
import { StatusIcon, cx } from "../ui";

const ORDER: Record<CheckStatus, number> = { fail: 0, warn: 1, info: 2, pass: 3 };

export function ChecksList({ checks, limit }: { checks: Check[]; limit?: number }) {
  const sorted = [...checks].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  return (
    <ul className="divide-y divide-line">
      {shown.map((c) => (
        <CheckRow key={c.id} check={c} />
      ))}
    </ul>
  );
}

function CheckRow({ check }: { check: Check }) {
  const [open, setOpen] = useState(false);
  const expandable = !!check.fix;
  return (
    <li className="py-2.5">
      <button
        type="button"
        className={cx("flex w-full items-start gap-2.5 text-left", expandable ? "cursor-pointer" : "cursor-default")}
        onClick={() => expandable && setOpen((v) => !v)}
        aria-expanded={expandable ? open : undefined}
      >
        <StatusIcon status={check.status} className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-sm font-medium text-ink">{check.title}</span>
            {check.value && <span className="max-w-full truncate text-xs text-ink-3 sm:max-w-[50%]">{check.value}</span>}
          </span>
          <span className="mt-0.5 block text-sm text-ink-2">{check.message}</span>
          {open && check.fix && (
            <span className="mt-1.5 block rounded-md bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-ink-2">
              <span className="font-sans font-medium text-ink">How to fix: </span>
              {check.fix}
            </span>
          )}
        </span>
        {expandable && <span className="mt-0.5 text-xs text-accent-ink">{open ? "Hide" : "Fix"}</span>}
      </button>
    </li>
  );
}

export function CheckSummary({ checks }: { checks: Check[] }) {
  const count = (s: CheckStatus) => checks.filter((c) => c.status === s).length;
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <span className="inline-flex items-center gap-1.5"><StatusIcon status="fail" />{count("fail")} failed</span>
      <span className="inline-flex items-center gap-1.5"><StatusIcon status="warn" />{count("warn")} warnings</span>
      <span className="inline-flex items-center gap-1.5"><StatusIcon status="pass" />{count("pass")} passed</span>
    </div>
  );
}
