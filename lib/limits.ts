import type { PlanId } from "./plans";

/** Pages per site audit on the Free plan: MAX_AUDIT_PAGES (default 200, at most 1,000). */
export function freeAuditPages(): number {
  const n = Number(process.env.MAX_AUDIT_PAGES);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 1000) : 200;
}

/** The most pages one audit may crawl on a plan, or null when there is no page limit (Pro and Agency). */
export function auditPageLimit(plan: PlanId): number | null {
  return plan === "free" ? freeAuditPages() : null;
}

/**
 * How many pages an audit request gets. A `maxPages` value can ask for a smaller crawl;
 * without one, Free audits crawl up to the Free limit and paid audits crawl the whole site
 * (null).
 */
export function resolveAuditPages(requested: string | null, plan: PlanId): number | null {
  const cap = auditPageLimit(plan);
  const n = requested?.trim() ? Math.floor(Number(requested)) : NaN;
  const asked = Number.isFinite(n) && n > 0 ? n : null;
  if (cap === null) return asked;
  return asked === null ? cap : Math.min(asked, cap);
}
