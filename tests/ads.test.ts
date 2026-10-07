import { afterEach, describe, expect, it, vi } from "vitest";
import { adsConfigured, adsTxt } from "@/lib/ads";
import { parsePaidPlanEmails, planForEmail, showsAds } from "@/lib/plan";
import { COMPARISON_GROUPS, PLANS } from "@/lib/plans";

afterEach(() => vi.unstubAllEnvs());

describe("paid plans", () => {
  it("reads paid accounts from PAID_PLAN_EMAILS", () => {
    const map = parsePaidPlanEmails(" Owner@Example.com:agency, friend@example.com;tester@example.com:pro bad-entry ");
    expect(Object.fromEntries(map)).toEqual({ "owner@example.com": "agency", "friend@example.com": "pro", "tester@example.com": "pro" });
    expect(parsePaidPlanEmails(undefined).size).toBe(0);
  });

  it("puts everyone else on Free", () => {
    vi.stubEnv("PAID_PLAN_EMAILS", "owner@example.com:agency");
    expect(planForEmail("OWNER@example.com")).toBe("agency");
    expect(planForEmail("someone@example.com")).toBe("free");
    expect(planForEmail(null)).toBe("free");
  });

  it("shows ads only on Free", () => {
    expect(showsAds("free")).toBe(true);
    expect(showsAds("pro")).toBe(false);
    expect(showsAds("agency")).toBe(false);
  });

  it("lists ad-free as a paid feature", () => {
    const row = COMPARISON_GROUPS.flatMap((g) => g.rows).find((r) => r.feature === "Ad-free");
    expect(row?.values).toEqual({ free: false, pro: true, agency: true });
    expect(PLANS.find((p) => p.id === "free")?.description).toMatch(/ads/i);
    expect(PLANS.find((p) => p.id === "pro")?.highlights.join(" ")).toMatch(/no ads/i);
  });
});

describe("AdSense settings", () => {
  it("needs a valid publisher ID and slot ID", () => {
    expect(adsConfigured("ca-pub-1234567890123456", "1234567890")).toBe(true);
    expect(adsConfigured("", "1234567890")).toBe(false);
    expect(adsConfigured("pub-1234567890123456", "1234567890")).toBe(false);
    expect(adsConfigured("ca-pub-1234567890123456", "")).toBe(false);
    expect(adsConfigured("ca-pub-1234567890123456", "<script>")).toBe(false);
  });

  it("builds the ads.txt line from the publisher ID", () => {
    expect(adsTxt("ca-pub-1234567890123456")).toBe("google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
    expect(adsTxt("")).toBeNull();
  });
});
