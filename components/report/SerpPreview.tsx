import type { PageReport } from "@/lib/seo/analyze";

/** Google-style desktop result preview, truncated by pixel width like the real thing. */
export function SerpPreview({ serp, favicon }: { serp: PageReport["serp"]; favicon?: string | null }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-4" aria-label="Search result preview">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-line bg-surface">
          {favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={favicon} alt="" width={16} height={16} className="h-4 w-4" referrerPolicy="no-referrer" />
          ) : (
            <span className="text-[10px] text-ink-3">●</span>
          )}
        </div>
        <div className="min-w-0 text-xs leading-tight">
          <div className="truncate text-ink">{serp.breadcrumb.split(" › ")[0]}</div>
          <div className="truncate text-ink-3">{serp.breadcrumb}</div>
        </div>
      </div>
      <div className="mt-2 text-xl leading-snug text-[#1a0dab] dark:text-[#99c3ff]" style={{ fontFamily: "Arial, sans-serif" }}>
        {serp.title}
      </div>
      <p className="mt-1 text-sm leading-normal text-ink-2" style={{ fontFamily: "Arial, sans-serif" }}>
        {serp.description || <span className="italic text-ink-3">No description: the search engine will pick text from the page.</span>}
      </p>
    </div>
  );
}
