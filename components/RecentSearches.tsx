"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ExternalLink, History, X } from "lucide-react";
import { clearRecent, getRecent, getServerRecent, removeRecent, subscribeRecent, type RecentTool } from "@/lib/client/recent";
import { displayQuery, siteUrlFor } from "@/lib/client/site";
import { cx } from "./ui";

const TOOLS: Record<RecentTool, { label: string; path: string; param: string; isSite: boolean }> = {
  traffic: { label: "Traffic", path: "/traffic", param: "domain", isSite: true },
  audit: { label: "Audit", path: "/audit", param: "url", isSite: true },
  analyzer: { label: "Page", path: "/analyzer", param: "url", isSite: true },
  keywords: { label: "Keywords", path: "/keywords", param: "q", isSite: false },
  compare: { label: "Compare", path: "/compare", param: "domains", isSite: false },
};

/**
 * The last few searches made in this browser. Each chip re-runs the search; website
 * entries also get a link that opens the site itself in a new tab.
 */
export function RecentSearches({ tool, exclude, limit = 5, className }: { tool?: RecentTool; exclude?: string; limit?: number; className?: string }) {
  const all = useSyncExternalStore(subscribeRecent, getRecent, getServerRecent);
  const items = all.filter((r) => (!tool || r.tool === tool) && r.query.toLowerCase() !== exclude?.toLowerCase()).slice(0, limit);
  if (!items.length) return null;

  return (
    <div className={cx("flex flex-wrap items-center gap-2 text-sm", className)} aria-label="Recent searches">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-3">
        <History className="h-3.5 w-3.5" aria-hidden />
        Recent
      </span>
      {items.map((r) => {
        const meta = TOOLS[r.tool];
        const site = meta.isSite ? siteUrlFor(r.query) : null;
        const label = displayQuery(r.query);
        return (
          <span key={`${r.tool}:${r.query}`} className="inline-flex max-w-full items-center rounded-full border border-line bg-surface text-ink-2">
            <Link
              href={`${meta.path}?${meta.param}=${encodeURIComponent(r.query)}`}
              className="flex min-w-0 items-center gap-1.5 py-1 pl-3 pr-1 hover:text-ink"
              title={`Search again: ${label}`}
            >
              {!tool && <span className="text-xs text-ink-3">{meta.label}</span>}
              <span className="max-w-[14rem] truncate">{label}</span>
            </Link>
            {site && (
              <a
                href={site}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="rounded-full p-1 text-ink-3 hover:bg-surface-2 hover:text-accent-ink"
                title={`Open ${label} in a new tab`}
                aria-label={`Open ${label} in a new tab`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => removeRecent(r.tool, r.query)}
              className="mr-1 rounded-full p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
              aria-label={`Remove ${label} from recent searches`}
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        );
      })}
      <button type="button" onClick={() => clearRecent(tool)} className="text-xs text-ink-3 underline-offset-2 hover:text-ink hover:underline">
        Clear
      </button>
    </div>
  );
}
