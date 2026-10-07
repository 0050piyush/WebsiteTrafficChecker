"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { displayQuery, siteUrlFor } from "@/lib/client/site";

export function ToolForm({
  initial,
  placeholder,
  label,
  button = "Analyze",
  busy,
  onSubmit,
  children,
  inputMode,
  openSite,
}: {
  initial: string;
  placeholder: string;
  label: string;
  button?: string;
  busy?: boolean;
  onSubmit: (value: string) => void;
  children?: ReactNode;
  inputMode?: "url" | "text";
  /** Show a link that opens the typed website in a new tab. */
  openSite?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const siteUrl = openSite ? siteUrlFor(value) : null;
  // Keep the box in sync when the URL changes (back/forward navigation).
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setValue(initial);
  }
  useEffect(() => {
    if (!initial) document.getElementById("tool-input")?.focus();
  }, [initial]);

  return (
    <form
      className="card mb-6 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (v) onSubmit(v);
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-bg px-3 focus-within:border-accent">
          <Search className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          <label htmlFor="tool-input" className="sr-only">
            {label}
          </label>
          <input
            id="tool-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            inputMode={inputMode === "url" ? "url" : "text"}
            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
          />
          {siteUrl && (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent-ink hover:bg-accent-soft"
              title={`Open ${displayQuery(siteUrl)} in a new tab`}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Open site</span>
              <span className="sr-only sm:hidden">Open site in a new tab</span>
            </a>
          )}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {button}
        </button>
      </div>
      {children && <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-sm text-ink-2">{children}</div>}
    </form>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
      {children}
    </label>
  );
}
