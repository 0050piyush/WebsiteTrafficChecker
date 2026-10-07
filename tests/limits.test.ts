import { afterEach, describe, expect, it, vi } from "vitest";
import { auditPageLimit, freeAuditPages, resolveAuditPages } from "@/lib/limits";
import { auditDeadlines } from "@/lib/audit/crawler";
import { COMPARISON_GROUPS } from "@/lib/plans";

afterEach(() => vi.unstubAllEnvs());

describe("site audit page limits", () => {
  it("caps Free audits and lets MAX_AUDIT_PAGES change the cap", () => {
    expect(freeAuditPages()).toBe(200);
    vi.stubEnv("MAX_AUDIT_PAGES", "50");
    expect(freeAuditPages()).toBe(50);
    vi.stubEnv("MAX_AUDIT_PAGES", "999999");
    expect(freeAuditPages()).toBe(1000);
    vi.stubEnv("MAX_AUDIT_PAGES", "nonsense");
    expect(freeAuditPages()).toBe(200);
  });

  it("has no page limit on paid plans", () => {
    expect(auditPageLimit("free")).toBe(200);
    expect(auditPageLimit("pro")).toBeNull();
    expect(auditPageLimit("agency")).toBeNull();
  });

  it("resolves the pages an audit request gets", () => {
    // Free: the cap by default, smaller on request, never more.
    expect(resolveAuditPages(null, "free")).toBe(200);
    expect(resolveAuditPages("50", "free")).toBe(50);
    expect(resolveAuditPages("5000", "free")).toBe(200);
    expect(resolveAuditPages("0", "free")).toBe(200);
    expect(resolveAuditPages("abc", "free")).toBe(200);
    // Paid: the whole site by default, or what was asked for.
    expect(resolveAuditPages(null, "pro")).toBeNull();
    expect(resolveAuditPages("", "agency")).toBeNull();
    expect(resolveAuditPages("50000", "pro")).toBe(50000);
    expect(resolveAuditPages("12.7", "agency")).toBe(12);
  });

  it("shows no page limit for paid plans on the pricing table", () => {
    const row = COMPARISON_GROUPS.flatMap((g) => g.rows).find((r) => r.feature === "Pages per audit");
    expect(row?.values).toEqual({ free: "200", pro: "No limit", agency: "No limit" });
  });
});

describe("audit time limit", () => {
  it("stops crawling with time left to check links and send the report", () => {
    const d = auditDeadlines(0, 270_000);
    expect(d.crawlUntil).toBe(202_500);
    expect(d.checkLinksUntil).toBe(245_000);
  });

  it("scales down for short budgets and is off without one", () => {
    expect(auditDeadlines(1000, 1000)).toEqual({ crawlUntil: 1750, checkLinksUntil: 1900 });
    expect(auditDeadlines(0, undefined)).toEqual({ crawlUntil: Infinity, checkLinksUntil: Infinity });
  });
});
