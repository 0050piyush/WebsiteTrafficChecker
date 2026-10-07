import type { PlanId } from "./plans";

/**
 * Which plan a signed-in account is on. Until payments are added, paid plans are granted
 * by email with PAID_PLAN_EMAILS, e.g. "you@example.com:agency, friend@example.com:pro"
 * (an email without ":plan" gets Pro). Everyone else, signed in or not, is on Free.
 */
export function parsePaidPlanEmails(raw: string | undefined): Map<string, PlanId> {
  const map = new Map<string, PlanId>();
  for (const entry of (raw ?? "").split(/[\s,;]+/)) {
    const [email, plan] = entry.trim().toLowerCase().split(":");
    if (!email || !email.includes("@")) continue;
    map.set(email, plan === "agency" ? "agency" : "pro");
  }
  return map;
}

export function planForEmail(email: string | null | undefined): PlanId {
  if (!email) return "free";
  return parsePaidPlanEmails(process.env.PAID_PLAN_EMAILS).get(email.trim().toLowerCase()) ?? "free";
}

/** Paid plans are ad-free. */
export const showsAds = (plan: PlanId) => plan === "free";
