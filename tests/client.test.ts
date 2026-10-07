import { describe, expect, it } from "vitest";
import { displayQuery, siteUrlFor } from "@/lib/client/site";

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
