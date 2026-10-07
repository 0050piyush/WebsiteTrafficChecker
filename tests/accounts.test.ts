import { afterEach, describe, expect, it, vi } from "vitest";
import { enabledProviders, isAuthEnabled, safeCallbackUrl } from "@/lib/auth-status";
import { contactEmail, isContactEnabled, sendContactEmail, validateContact } from "@/lib/contact";
import { FAQ, HOME_FAQ } from "@/lib/faq";
import { PAGE_GROUPS } from "@/lib/pages";
import { COMPARISON_GROUPS, PLANS } from "@/lib/plans";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("auth status", () => {
  it("stays off until a secret and a provider are configured", () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("AUTH_GOOGLE_ID", "id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "secret");
    vi.stubEnv("AUTH_GITHUB_ID", "");
    vi.stubEnv("AUTH_GITHUB_SECRET", "");
    expect(enabledProviders()).toEqual(["google"]);
    expect(isAuthEnabled()).toBe(false);

    vi.stubEnv("AUTH_SECRET", "s3cret");
    expect(isAuthEnabled()).toBe(true);

    vi.stubEnv("AUTH_GOOGLE_SECRET", "");
    expect(enabledProviders()).toEqual([]);
    expect(isAuthEnabled()).toBe(false);
  });

  it("needs both the ID and the secret for each provider", () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "");
    vi.stubEnv("AUTH_GITHUB_ID", "gh");
    vi.stubEnv("AUTH_GITHUB_SECRET", "");
    expect(enabledProviders()).toEqual([]);
    vi.stubEnv("AUTH_GITHUB_SECRET", "ghs");
    expect(enabledProviders()).toEqual(["github"]);
  });

  it("only redirects back to local paths", () => {
    expect(safeCallbackUrl("/audit?url=x")).toBe("/audit?url=x");
    expect(safeCallbackUrl(["/compare", "/x"])).toBe("/compare");
    expect(safeCallbackUrl(undefined)).toBe("/account");
    expect(safeCallbackUrl("https://evil.example/")).toBe("/account");
    expect(safeCallbackUrl("//evil.example/")).toBe("/account");
    expect(safeCallbackUrl("/\\evil.example/")).toBe("/account");
    expect(safeCallbackUrl("javascript:alert(1)", "/")).toBe("/");
  });
});

describe("contact form", () => {
  const valid = { name: "Ada Lovelace", email: "Ada@Example.com ", topic: "bug", message: "The traffic chart is empty for my site." };

  it("accepts and normalizes a valid message", () => {
    const r = validateContact(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spam).toBe(false);
      expect(r.value).toEqual({ name: "Ada Lovelace", email: "ada@example.com", topic: "bug", plan: null, message: valid.message });
    }
  });

  it("reports each invalid field", () => {
    const r = validateContact({ name: "  ", email: "not-an-email", message: "short" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "message", "name"]);
    expect(validateContact(null).ok).toBe(false);
    expect(validateContact({ ...valid, message: "x".repeat(5001) }).ok).toBe(false);
    expect(validateContact({ ...valid, name: "x".repeat(101) }).ok).toBe(false);
  });

  it("lets waitlist sign-ups skip the message and keeps the plan only for them", () => {
    const w = validateContact({ name: "Ada", email: "ada@example.com", topic: "waitlist", plan: "agency", message: "" });
    expect(w.ok && w.value.plan).toBe("agency");
    const g = validateContact({ ...valid, topic: "general", plan: "pro" });
    expect(g.ok && g.value.plan).toBe(null);
    const odd = validateContact({ ...valid, topic: "admin" });
    expect(odd.ok && odd.value.topic).toBe("general");
  });

  it("keeps names on one line so they can't break the subject", () => {
    const r = validateContact({ ...valid, name: "Ada\r\nBcc: someone@example.com" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).not.toMatch(/[\r\n]/);
      expect(contactEmail(r.value).subject).not.toMatch(/[\r\n]/);
    }
  });

  it("flags the honeypot field as spam", () => {
    const r = validateContact({ ...valid, website: "http://spam.example" });
    expect(r.ok && r.spam).toBe(true);
  });

  it("is enabled only with an API key and a recipient", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("CONTACT_TO_EMAIL", "");
    expect(isContactEnabled()).toBe(false);
    vi.stubEnv("CONTACT_TO_EMAIL", "inbox@example.com");
    expect(isContactEnabled()).toBe(true);
  });

  it("sends through Resend with the visitor as reply-to", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("CONTACT_TO_EMAIL", "inbox@example.com");
    vi.stubEnv("CONTACT_FROM_EMAIL", "");
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendContactEmail({ name: "Ada", email: "ada@example.com", topic: "waitlist", plan: "pro", message: "" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_test");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ to: ["inbox@example.com"], reply_to: "ada@example.com", from: "TrafficLens <onboarding@resend.dev>" });
    expect(body.subject).toContain("(Pro)");

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 422 }));
    await expect(sendContactEmail({ name: "Ada", email: "ada@example.com", topic: "general", plan: null, message: "Hello there!" })).rejects.toThrow("422");
  });
});

describe("site content", () => {
  it("keeps paid features in paid tiers", () => {
    expect(PLANS.map((p) => [p.id, p.price, p.available])).toEqual([
      ["free", 0, true],
      ["pro", 19, false],
      ["agency", 49, false],
    ]);
    for (const row of COMPARISON_GROUPS.flatMap((g) => g.rows)) {
      // Anything Free has, the paid plans have too.
      if (row.values.free) expect(row.values.pro && row.values.agency, row.feature).toBeTruthy();
    }
  });

  it("lists every page once, with the home FAQ drawn from the full FAQ", () => {
    const hrefs = PAGE_GROUPS.flatMap((g) => g.pages.map((p) => p.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of ["/pricing", "/about", "/contact", "/privacy", "/faq", "/sitemap", "/login"]) expect(hrefs).toContain(href);
    const all = FAQ.flatMap((g) => g.items);
    expect(HOME_FAQ.every((item) => item && all.includes(item))).toBe(true);
  });
});
