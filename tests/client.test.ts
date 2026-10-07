import { describe, expect, it } from "vitest";
import { displayQuery, siteUrlFor } from "@/lib/client/site";
import { fmtAxis } from "@/lib/client/format";

describe("fmtAxis", () => {
  it("keeps neighbouring ticks distinct", () => {
    const ticks = [13_000_000, 13_050_000, 13_100_000, 13_150_000];
    const labels = ticks.map((t) => fmtAxis(t, 50_000));
    expect(labels).toEqual(["13M", "13.05M", "13.1M", "13.15M"]);
    expect(new Set(labels).size).toBe(ticks.length);
  });

  it("uses whole units when the step allows", () => {
    expect([0, 5e6, 10e6].map((t) => fmtAxis(t, 5e6))).toEqual(["0", "5M", "10M"]);
    expect(fmtAxis(2500, 500)).toBe("2.5K");
  });
});

describe("siteUrlFor", () => {
  it("turns domains and URLs into openable links", () => {
    expect(siteUrlFor("instagram.com")).toBe("https://instagram.com/");
    expect(siteUrlFor("  https://www.bbc.co.uk/news  ")).toBe("https://www.bbc.co.uk/news");
    expect(siteUrlFor("http://example.com/a?b=1")).toBe("http://example.com/a?b=1");
  });

  it("rejects things that aren't websites", () => {
    for (const bad of ["", "coffee grinder", "javascript:alert(1)", "ftp://example.com", "localhost", "https://user:pw@example.com", "not a url"]) {
      expect(siteUrlFor(bad), bad).toBeNull();
    }
  });

  it("shortens queries for display", () => {
    expect(displayQuery("https://example.com/")).toBe("example.com");
    expect(displayQuery("example.com/page")).toBe("example.com/page");
  });
});
