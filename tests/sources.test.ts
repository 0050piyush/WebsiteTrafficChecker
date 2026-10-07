import { describe, expect, it } from "vitest";
import { parseTrancoResponse } from "@/lib/sources/tranco";
import { parseRdap } from "@/lib/sources/rdap";
import { buildWaybackInfo, parseAvailability, parseCdxTimestamps } from "@/lib/sources/wayback";
import { parsePageSpeed } from "@/lib/sources/pagespeed";
import { parseOpenPageRank } from "@/lib/sources/openpagerank";
import { parseAmazon, parseDuckDuckGo, parseOpenSearch } from "@/lib/sources/autocomplete";
import { estimateMonthlyVisits, popularityTier, TRAFFIC_ANCHORS } from "@/lib/traffic-model";
import { parseDomainInput, parseUrlInput, resolveLink, isSameSite } from "@/lib/url";
import { buildTrafficSection } from "@/lib/overview";

describe("Tranco", () => {
  it("parses and summarizes daily ranks", () => {
    const r = parseTrancoResponse("example.com", {
      domain: "example.com",
      ranks: [
        { date: "2026-10-03", rank: 120 },
        { date: "2026-10-01", rank: 150 },
        { date: "2026-10-02", rank: 130 },
      ],
    });
    expect(r.ranks.map((x) => x.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(r.latest).toEqual({ date: "2026-10-03", rank: 120 });
    expect(r.best).toBe(120);
    expect(r.worst).toBe(150);
    expect(r.change).toBe(30);
  });

  it("handles unranked domains", () => {
    const r = parseTrancoResponse("nobody.example", { domain: "nobody.example", ranks: [] });
    expect(r.latest).toBeNull();
    expect(buildTrafficSection(r).tier.label).toBe("Unranked");
    expect(parseTrancoResponse("x.com", null).ranks).toEqual([]);
  });
});

describe("traffic model", () => {
  it("passes exactly through its anchors", () => {
    for (const [rank, visits] of TRAFFIC_ANCHORS) {
      expect(estimateMonthlyVisits(rank)!.mid).toBeCloseTo(visits, -1);
    }
  });

  it("is monotonically decreasing with rank and gives a range", () => {
    let prev = Infinity;
    for (const rank of [1, 5, 50, 500, 5_000, 50_000, 500_000, 2_000_000]) {
      const e = estimateMonthlyVisits(rank)!;
      expect(e.mid).toBeLessThan(prev);
      expect(e.low).toBeLessThan(e.mid);
      expect(e.high).toBeGreaterThan(e.mid);
      prev = e.mid;
    }
    expect(estimateMonthlyVisits(0)).toBeNull();
  });

  it("assigns tiers", () => {
    expect(popularityTier(42).label).toBe("Top 100");
    expect(popularityTier(4_200).label).toBe("Top 10K");
    expect(popularityTier(null).label).toBe("Unranked");
  });
});

describe("RDAP", () => {
  it("extracts registrar, dates and nameservers", () => {
    const info = parseRdap(
      "example.com",
      {
        ldhName: "EXAMPLE.COM",
        status: ["client delete prohibited"],
        events: [
          { eventAction: "registration", eventDate: "1995-08-14T04:00:00Z" },
          { eventAction: "expiration", eventDate: "2027-08-13T04:00:00Z" },
          { eventAction: "last changed", eventDate: "2026-08-14T07:01:34Z" },
        ],
        entities: [{ roles: ["registrar"], vcardArray: ["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "RESERVED-Internet Assigned Numbers Authority"]]] }],
        nameservers: [{ ldhName: "A.IANA-SERVERS.NET" }, { ldhName: "B.IANA-SERVERS.NET" }],
        secureDNS: { delegationSigned: true },
      },
      "rdap.verisign.com",
    );
    expect(info.registrar).toBe("RESERVED-Internet Assigned Numbers Authority");
    expect(info.registeredAt).toBe("1995-08-14T04:00:00.000Z");
    expect(info.expiresAt).toBe("2027-08-13T04:00:00Z");
    expect(info.ageYears).toBeGreaterThan(30);
    expect(info.nameservers).toEqual(["a.iana-servers.net", "b.iana-servers.net"]);
    expect(info.dnssec).toBe(true);
  });
});

describe("Wayback Machine", () => {
  it("parses CDX timestamps and the availability API", () => {
    expect(parseCdxTimestamps([["timestamp"], ["20020120142510"], ["19980101000000"], ["bogus"]])).toEqual(["19980101000000", "20020120142510"]);
    expect(parseCdxTimestamps([])).toEqual([]);
    expect(
      parseAvailability({ url: "example.com", archived_snapshots: { closest: { status: "200", available: true, url: "http://web.archive.org/web/20130919044612/http://example.com/", timestamp: "20130919044612" } } }),
    ).toBe("20130919044612");
    expect(parseAvailability({ archived_snapshots: {} })).toBeNull();
  });

  it("builds a full history when every lookup succeeds", () => {
    const w = buildWaybackInfo("example.com", { first: "19980101000000", latest: "20261001120000", yearStamps: ["19980101000000", "20020120142510", "20260105101010"] });
    expect(w.firstCapture).toBe("1998-01-01T00:00:00.000Z");
    expect(w.lastCapture).toBe("2026-10-01T12:00:00.000Z");
    expect(w.years).toEqual([1998, 2002, 2026]);
    expect(w.lastYear).toBe(2026);
    expect(w.firstSnapshotUrl).toBe("https://web.archive.org/web/19980101000000/example.com");
  });

  it("still reports dates when the slow year scan times out", () => {
    const w = buildWaybackInfo("instagram.com", { first: "20101006000000", latest: "20261006000000", yearStamps: null });
    expect(w.firstCapture).toBe("2010-10-06T00:00:00.000Z");
    expect(w.years).toBeNull();
    expect(w.ageYears).toBeGreaterThan(15);
  });

  it("falls back to the year scan for the first capture", () => {
    const w = buildWaybackInfo("x.com", { first: null, latest: null, yearStamps: ["20050101000000", "20060101000000"] });
    expect(w.firstCapture).toBe("2005-01-01T00:00:00.000Z");
    expect(w.years).toEqual([2005, 2006]);
  });

  it("reports never-archived domains", () => {
    const w = buildWaybackInfo("new.example", { first: null, latest: null, yearStamps: [] });
    expect(w.firstCapture).toBeNull();
    expect(w.years).toEqual([]);
  });
});

describe("PageSpeed Insights", () => {
  it("summarizes lab and field data", () => {
    const s = parsePageSpeed("https://example.com/", "mobile", {
      lighthouseResult: {
        categories: { performance: { score: 0.87 }, seo: { score: 1 }, accessibility: { score: 0.9 }, "best-practices": { score: null } },
        audits: {
          "largest-contentful-paint": { id: "largest-contentful-paint", title: "Largest Contentful Paint", score: 0.7, displayValue: "2.9 s" },
          "render-blocking-resources": { id: "render-blocking-resources", title: "Eliminate render-blocking resources", score: 0.3, displayValue: "Potential savings of 450 ms", details: { type: "opportunity", overallSavingsMs: 450 } },
          "unused-css-rules": { id: "unused-css-rules", title: "Reduce unused CSS", score: 0.95, details: { type: "opportunity", overallSavingsMs: 10 } },
        },
      },
      loadingExperience: { origin_fallback: true, metrics: {} },
      originLoadingExperience: {
        overall_category: "AVERAGE",
        metrics: {
          LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2400, category: "FAST" },
          INTERACTION_TO_NEXT_PAINT: { percentile: 250, category: "AVERAGE" },
          CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 12, category: "AVERAGE" },
        },
      },
    });
    expect(s.scores).toEqual({ performance: 87, accessibility: 90, bestPractices: null, seo: 100 });
    expect(s.field.scope).toBe("origin");
    expect(s.field.cls?.percentile).toBe(0.12);
    expect(s.field.inp?.category).toBe("AVERAGE");
    expect(s.opportunities.map((o) => o.id)).toEqual(["render-blocking-resources"]);
    expect(s.lab[0].displayValue).toBe("2.9 s");
  });
});

describe("Open PageRank", () => {
  it("reads the decimal score", () => {
    expect(parseOpenPageRank({ status_code: 200, response: [{ status_code: 200, page_rank_decimal: 7.52, rank: "1234", domain: "x.com" }] })).toEqual({ score: 7.52, rank: 1234 });
    expect(parseOpenPageRank({ response: [{ status_code: 404, error: "Domain not found" }] })).toBeNull();
  });
});

describe("autocomplete parsers", () => {
  it("parses OpenSearch, DuckDuckGo and Amazon formats", () => {
    expect(parseOpenSearch(["seo", ["seo tools", "seo meaning"], [], {}])).toEqual(["seo tools", "seo meaning"]);
    expect(parseDuckDuckGo([{ phrase: "seo tools" }, { phrase: "seo audit" }])).toEqual(["seo tools", "seo audit"]);
    expect(parseDuckDuckGo(["seo", ["seo a"]])).toEqual(["seo a"]);
    expect(parseAmazon({ suggestions: [{ value: "seo book" }] })).toEqual(["seo book"]);
    expect(parseOpenSearch({ nope: true })).toEqual([]);
  });
});

describe("input parsing", () => {
  it("normalizes domains", () => {
    expect(parseDomainInput("HTTPS://WWW.Example.co.uk/path?q=1")).toEqual({ hostname: "www.example.co.uk", domain: "example.co.uk" });
    expect(parseDomainInput("blog.example.com")).toEqual({ hostname: "blog.example.com", domain: "example.com" });
    expect(parseDomainInput("192.168.0.1")).toBeNull();
    expect(parseDomainInput("not a domain")).toBeNull();
    expect(parseDomainInput("localhost")).toBeNull();
  });

  it("normalizes URLs and links", () => {
    expect(parseUrlInput("example.com/page#frag")).toBe("https://example.com/page");
    expect(parseUrlInput("javascript:alert(1)")).toBeNull();
    expect(resolveLink("../a#x", "https://e.com/b/c")).toBe("https://e.com/a");
    expect(resolveLink("mailto:a@b.c", "https://e.com/")).toBeNull();
    expect(isSameSite("https://www.e.com/a", "http://e.com/b")).toBe(true);
    expect(isSameSite("https://blog.e.com/", "https://e.com/")).toBe(false);
  });
});
