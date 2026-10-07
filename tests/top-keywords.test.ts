import { afterEach, describe, expect, it, vi } from "vitest";
import {
  brandOf,
  candidateKeywords,
  demandLevel,
  demandScore,
  estimateSiteKeywords,
  normalizePhrase,
  probePrefixes,
  suggestedAt,
  titleSegments,
} from "@/lib/keywords/site-keywords";
import { getRankedKeywords, parseRankedKeywords } from "@/lib/sources/dataforseo";
import { dataForSeoLocation, siteMarket } from "@/lib/markets";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const US = { gl: "us", hl: "en", name: "United States" };

/** Fake autocomplete: the most popular queries that start with what was typed. */
function fakeSuggest(popular: Record<string, number>) {
  return (q: string) =>
    Object.entries(popular)
      .filter(([k]) => k.startsWith(q.toLowerCase()))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);
}

function stubSuggestFetch(handlers: { google?: (q: string) => string[] | null; duckduckgo?: (q: string) => string[] | null }) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input);
      calls.push(url.hostname);
      const isGoogle = url.hostname === "suggestqueries.google.com";
      const q = (isGoogle ? url.searchParams.get("q") : url.searchParams.get("q")) ?? "";
      const handler = isGoogle ? handlers.google : url.hostname === "duckduckgo.com" ? handlers.duckduckgo : undefined;
      const list = handler?.(q);
      if (!list) return new Response("unavailable", { status: 503 });
      return new Response(JSON.stringify([q, list]), { status: 200, headers: { "content-type": "application/json" } });
    }),
  );
  return calls;
}

describe("finding the phrases a site targets", () => {
  it("normalizes and splits titles into phrases", () => {
    expect(normalizePhrase("  Is It Down Right Now?  ")).toBe("is it down right now");
    expect(normalizePhrase("Café & Bar — ‘Best’ in town!")).toBe("café bar best in town");
    expect(normalizePhrase("M&S Food: C++ tips")).toBe("m&s food c++ tips");
    expect(titleSegments("Is It Down Right Now? Website Down or Not?")).toEqual(["is it down right now", "website down or not"]);
    expect(titleSegments("Buy Shoes Online | Zappos.com")).toEqual(["buy shoes online", "zappos.com"]);
    expect(titleSegments("Stripe: Financial Infrastructure - Payments")).toEqual(["stripe", "financial infrastructure", "payments"]);
    expect(titleSegments("e-commerce platform")).toEqual(["e-commerce platform"]);
  });

  it("derives the brand from the domain", () => {
    expect(brandOf("isitdownrightnow.com")).toEqual(["isitdownrightnow"]);
    expect(brandOf("is-it-down.co.uk")).toEqual(["is it down", "isitdown"]);
  });

  it("collects brand, title, heading and text phrases, without boilerplate", () => {
    const list = candidateKeywords({
      domain: "isitdownrightnow.com",
      title: "Is It Down Right Now? Website Down or Not?",
      siteName: "IsItDownRightNow",
      headings: [
        { level: 1, text: "Check if a website is down" },
        { level: 2, text: "Contact us" },
        { level: 2, text: "Recently checked websites" },
        { level: 2, text: "Holiday recipes" },
        { level: 2, text: "How it works" },
      ],
      phrases: [
        { phrase: "website status", count: 5, density: 1 },
        { phrase: "server status", count: 5, density: 1 },
        { phrase: "rare phrase", count: 1, density: 0.1 },
      ],
    });
    const keywords = list.map((c) => c.keyword);
    expect(keywords[0]).toBe("isitdownrightnow");
    expect(list[0].foundIn).toEqual(["brand"]);
    expect(keywords).toEqual(expect.arrayContaining(["is it down right now", "is it down", "website down or not", "website down", "check if a website is down", "recently checked websites", "website status"]));
    // Off-topic subheadings and boilerplate are left out.
    for (const bad of ["is it", "website down or", "contact us", "rare phrase", "holiday recipes", "how it works", "server status"]) expect(keywords).not.toContain(bad);
  });

  it("drops a trailing year and keeps at most the requested number", () => {
    const list = candidateKeywords({ domain: "x.com", title: "Best Laptops 2026 | Reviews", headings: [] });
    expect(list.map((c) => c.keyword)).toContain("best laptops");
    expect(candidateKeywords({ domain: "x.com", title: "Topic Guides", headings: Array.from({ length: 30 }, (_, i) => ({ level: 2, text: `topic guide ${i + 1}` })) }, 5)).toHaveLength(5);
  });
});

describe("search demand", () => {
  it("matches suggestions regardless of spacing and .com", () => {
    expect(suggestedAt("isitdownrightnow", ["isitdownrightnow.com", "x"])).toBe(1);
    expect(suggestedAt("is it down", ["is it down right now", "is it down"])).toBe(2);
    expect(suggestedAt("website down", ["website design"])).toBeNull();
  });

  it("types the whole phrase, then 3/4, then half", () => {
    expect(probePrefixes("is it down")).toEqual([
      { prefix: "is it down", weight: 0.3 },
      { prefix: "is it do", weight: 0.6 },
      { prefix: "is it", weight: 1 },
    ]);
    expect(probePrefixes("ebay").map((p) => p.prefix)).toEqual(["ebay", "eba"]);
  });

  it("scores fewer letters and higher positions as more demand", () => {
    expect(demandScore(1, 1)).toBe(100);
    expect(demandScore(0.3, 10)).toBe(13);
    expect(demandScore(0.6, 1)).toBeGreaterThan(demandScore(0.3, 1));
    expect(demandLevel(100)).toBe("High");
    expect(demandLevel(30)).toBe("Medium");
    expect(demandLevel(13)).toBe("Low");
  });

  it("ranks the site's phrases by how readily they're suggested", async () => {
    stubSuggestFetch({
      google: fakeSuggest({
        "is it down": 100,
        "is it raining": 95,
        "is it christmas": 90,
        "is it down right now": 40,
        isitdown: 70,
        isitdownforeveryone: 65,
        isitdownrightnow: 60,
        "isitdownrightnow.com": 20,
        website: 200,
        websites: 150,
        "website design": 99,
        "website builder": 98,
        "website templates": 97,
        "website hosting": 96,
        "website creator": 95,
        "website maker": 94,
        "website for free": 93,
        "website analytics": 92,
        "website down": 50,
      }),
    });
    const result = await estimateSiteKeywords({ domain: "isitdownrightnow.com", title: "Is It Down Right Now? Website Down or Not?", headings: [] }, US);
    expect(result.engine).toBe("google");
    const byKeyword = Object.fromEntries(result.keywords.map((k) => [k.keyword, k]));
    expect(result.keywords[0].keyword).toBe("is it down");
    expect(byKeyword["is it down"]).toMatchObject({ demand: 100, level: "High", typedPrefix: "is it" });
    expect(byKeyword["isitdownrightnow"]).toMatchObject({ foundIn: ["brand"], demand: 77, typedPrefix: "isitdown" });
    // Crowded out when only half is typed, so only Medium demand.
    expect(byKeyword["website down"]).toMatchObject({ level: "Medium", typedPrefix: "website d" });
    expect(byKeyword["website down or not"]).toBeUndefined();
    // Sorted by demand.
    const demands = result.keywords.map((k) => k.demand);
    expect([...demands].sort((a, b) => b - a)).toEqual(demands);
  });

  it("falls back to DuckDuckGo when Google refuses", async () => {
    const calls = stubSuggestFetch({ google: () => null, duckduckgo: fakeSuggest({ "fallback widgets": 10 }) });
    const result = await estimateSiteKeywords({ domain: "fallbackwidgets-shop.com", title: "Fallback Widgets", headings: [] }, US);
    expect(result.engine).toBe("duckduckgo");
    expect(result.keywords.map((k) => k.keyword)).toContain("fallback widgets");
    expect(calls).toContain("duckduckgo.com");
  });

  it("reports an error when no engine answers", async () => {
    stubSuggestFetch({});
    await expect(estimateSiteKeywords({ domain: "nothing-answers.com", title: "Nothing Answers", headings: [] }, US)).rejects.toThrow("unavailable");
  });
});

describe("markets", () => {
  it("picks the country from the domain, then the page language", () => {
    expect(siteMarket("bbc.co.uk")).toEqual({ gl: "gb", hl: "en", name: "United Kingdom" });
    expect(siteMarket("spiegel.de", "de")).toMatchObject({ gl: "de", hl: "de" });
    expect(siteMarket("example.com", "de-DE")).toMatchObject({ gl: "de", hl: "de" });
    expect(siteMarket("example.com", "en-GB")).toMatchObject({ gl: "gb", hl: "en" });
    expect(siteMarket("example.com", "en-US")).toMatchObject({ gl: "us", hl: "en" });
    expect(siteMarket("example.com")).toMatchObject({ gl: "us", hl: "en" });
    expect(siteMarket("example.io", "fr")).toMatchObject({ gl: "fr", hl: "fr" });
    expect(siteMarket("example.in", "hi")).toMatchObject({ gl: "in", hl: "en" });
    expect(dataForSeoLocation(siteMarket("bbc.co.uk"))).toEqual({ location_code: 2826, language_code: "en" });
    expect(dataForSeoLocation(siteMarket("example.com"))).toEqual({ location_code: 2840, language_code: "en" });
  });
});

const DFS_RESPONSE = {
  status_code: 20000,
  status_message: "Ok.",
  tasks: [
    {
      status_code: 20000,
      status_message: "Ok.",
      result: [
        {
          target: "isitdownrightnow.com",
          total_count: 4100,
          metrics: { organic: { count: 4000, etv: 323456.7 } },
          items: [
            {
              keyword_data: { keyword: "is it down", keyword_info: { search_volume: 32000 } },
              ranked_serp_element: { serp_item: { type: "organic", rank_group: 1, etv: 9920.4, url: "https://www.isitdownrightnow.com/" } },
            },
            {
              keyword_data: { keyword: "website down", keyword_info: { search_volume: 4800 } },
              ranked_serp_element: { serp_item: { type: "organic", rank_group: 2, etv: 1200, url: "https://www.isitdownrightnow.com/check.php" } },
            },
            { keyword_data: { keyword: "broken item" }, ranked_serp_element: {} },
          ],
        },
      ],
    },
  ],
};

describe("DataForSEO ranked keywords", () => {
  it("parses positions, volumes and traffic", () => {
    const r = parseRankedKeywords(DFS_RESPONSE);
    expect(r.totalKeywords).toBe(4000);
    expect(r.organicTraffic).toBe(323457);
    expect(r.keywords).toEqual([
      { keyword: "is it down", position: 1, volume: 32000, traffic: 9920, url: "https://www.isitdownrightnow.com/" },
      { keyword: "website down", position: 2, volume: 4800, traffic: 1200, url: "https://www.isitdownrightnow.com/check.php" },
    ]);
  });

  it("surfaces API and task errors", () => {
    expect(() => parseRankedKeywords({ status_code: 40100, status_message: "You are not authorized" })).toThrow("not authorized");
    expect(() => parseRankedKeywords({ status_code: 20000, tasks: [{ status_code: 40501, status_message: "Invalid Field: 'order_by'." }] })).toThrow("order_by");
    expect(parseRankedKeywords({ status_code: 20000, tasks: [{ status_code: 20000, result: null }] }).keywords).toEqual([]);
  });

  it("sends an authenticated request for the domain and market", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "me@example.com");
    vi.stubEnv("DATAFORSEO_PASSWORD", "pw");
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify(DFS_RESPONSE), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await getRankedKeywords("isitdownrightnow.com", siteMarket("isitdownrightnow.com"));
    expect(r.keywords).toHaveLength(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live");
    expect((init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("me@example.com:pw").toString("base64")}`);
    expect(JSON.parse(String(init.body))[0]).toMatchObject({ target: "isitdownrightnow.com", location_code: 2840, language_code: "en", limit: 10 });

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    await expect(getRankedKeywords("other-site.com", siteMarket("other-site.com"))).rejects.toThrow("DATAFORSEO_LOGIN");
  });
});
