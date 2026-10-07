import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startFixtureSite, type FixtureSite } from "./helpers/fixture-site";
import { runAudit, DEFAULT_AUDIT_OPTIONS } from "@/lib/audit/crawler";
import { analyzePage } from "@/lib/seo/analyze";
import type { AuditEvent, AuditReport } from "@/lib/audit/types";

let site: FixtureSite;
beforeAll(async () => {
  process.env.ALLOW_PRIVATE_HOSTS = "true";
  site = await startFixtureSite();
});
afterAll(async () => {
  await site.close();
  delete process.env.ALLOW_PRIVATE_HOSTS;
});

describe("analyzePage (live fixture)", () => {
  it("produces a full report", async () => {
    const r = await analyzePage(`${site.origin}/`, { keyword: "fixture" });
    expect(r.http.status).toBe(200);
    expect(r.http.contentEncoding).toBe("gzip");
    expect(r.seo.title).toBe("Fixture Home – A Test Website for Crawling");
    expect(r.seo.indexable).toBe(true);
    expect(r.robotsTxt.found).toBe(true);
    expect(r.robotsTxt.sitemaps).toEqual([`${site.origin}/sitemap.xml`]);
    expect(r.technologies.map((t) => t.name)).toContain("Express");
    expect(r.structuredData.jsonLd[0].types).toEqual(["Organization"]);
    expect(r.links.external).toBe(2);
    expect(r.checks.find((c) => c.id === "kw-title")?.status).toBe("pass");
    expect(r.score).toBeGreaterThan(40);
    expect(r.content.keywords.one.length).toBeGreaterThan(0);
  });

  it("rejects non-HTML URLs", async () => {
    await expect(analyzePage(`${site.origin}/files/report.pdf`)).rejects.toMatchObject({ code: "NOT_HTML" });
  });
});

describe("runAudit (live fixture)", () => {
  let report: AuditReport;
  const events: AuditEvent[] = [];

  beforeAll(async () => {
    report = await runAudit(`${site.origin}/`, { ...DEFAULT_AUDIT_OPTIONS, maxPages: 50 }, (e) => events.push(e));
  }, 60_000);

  const issue = (id: string) => report.issues.find((i) => i.id === id);
  const urlsOf = (id: string) => issue(id)?.urls.map((u) => u.url.replace(site.origin, "")) ?? [];

  it("streams progress events", () => {
    expect(events[0].type).toBe("start");
    expect(events.filter((e) => e.type === "page").length).toBe(report.stats.crawled);
    expect(events.some((e) => e.type === "phase" && e.phase === "checking-links")).toBe(true);
  });

  it("crawls the reachable site and respects robots.txt", () => {
    const crawled = report.pages.map((p) => p.url.replace(site.origin, "")).sort();
    expect(crawled).toEqual(expect.arrayContaining(["/", "/about", "/blog", "/blog/post-1", "/deep/1", "/deep/2", "/deep/3", "/orphan", "/old", "/chain1", "/chain2", "/broken", "/error"]));
    expect(report.pages.find((p) => p.url.endsWith("/private/secret"))?.status).toBe(-1);
    expect(urlsOf("blocked-by-robots")).toEqual(["/private/secret"]);
    expect(report.stats.limitReached).toBe(false);
  });

  it("computes click depth through links and redirects", () => {
    const depth = (path: string) => report.pages.find((p) => p.url === `${site.origin}${path}`)?.depth;
    expect(depth("/")).toBe(0);
    expect(depth("/about")).toBe(1);
    expect(depth("/blog/post-1")).toBe(2);
    expect(depth("/deep/3")).toBe(5);
    expect(depth("/orphan")).toBe(-1);
    expect(urlsOf("deep-page")).toEqual(expect.arrayContaining(["/deep/2", "/deep/3"]));
  });

  it("finds broken pages and links", () => {
    expect(urlsOf("page-4xx")).toEqual(["/broken"]);
    expect(urlsOf("page-5xx")).toEqual(["/error"]);
    expect(urlsOf("broken-internal-links")).toEqual(["/"]);
    expect(urlsOf("broken-images")).toEqual(["/"]);
    expect(urlsOf("broken-external-links")).toEqual(["/"]);
    expect(issue("broken-external-links")!.urls[0].detail).toContain("/gone");
  });

  it("finds redirect issues", () => {
    expect(urlsOf("redirect-chain")).toEqual(["/chain1"]);
    expect(urlsOf("links-to-redirect")).toEqual(expect.arrayContaining(["/"]));
    expect(urlsOf("sitemap-non-200")).toEqual(["/old"]);
  });

  it("finds on-page issues", () => {
    expect(urlsOf("duplicate-title").sort()).toEqual(["/about", "/blog"]);
    expect(urlsOf("missing-description")).toEqual(expect.arrayContaining(["/about", "/orphan"]));
    expect(urlsOf("description-too-short")).toEqual(["/blog"]);
    expect(urlsOf("multiple-h1")).toEqual(["/blog"]);
    expect(urlsOf("missing-alt")).toEqual(["/about"]);
    expect(urlsOf("missing-viewport")).toEqual(["/blog/post-1"]);
    expect(urlsOf("missing-lang")).toEqual(["/blog/post-1"]);
    expect(urlsOf("low-word-count")).toEqual(expect.arrayContaining(["/blog/post-1"]));
    expect(urlsOf("noindex-page")).toEqual(["/deep/3"]);
    expect(urlsOf("noindex-in-sitemap")).toEqual(["/deep/3"]);
    expect(urlsOf("orphan-page")).toEqual(["/orphan"]);
    expect(urlsOf("dead-end")).toEqual(expect.arrayContaining(["/deep/3"]));
    expect(urlsOf("missing-title")).toEqual([]);
  });

  it("computes stats and a health score", () => {
    expect(report.stats.clientErrors).toBe(1);
    expect(report.stats.serverErrors).toBe(1);
    expect(report.stats.redirects).toBe(3);
    expect(report.site.robotsFound).toBe(true);
    expect(report.healthScore).toBeGreaterThan(0);
    expect(report.healthScore).toBeLessThan(100);
    expect(report.issues[0].severity).toBe("error");
  });

  it("stops at the page limit", async () => {
    const small = await runAudit(`${site.origin}/`, { ...DEFAULT_AUDIT_OPTIONS, maxPages: 3, checkExternal: false, checkResources: false }, () => undefined);
    expect(small.stats.crawled).toBe(3);
    expect(small.stats.limitReached).toBe(true);
    expect(small.issues.find((i) => i.id === "orphan-page")).toBeUndefined();
  });
});
