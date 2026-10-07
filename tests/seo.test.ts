import { describe, expect, it } from "vitest";
import { extractPage, looksClientRendered, robotsDirectives } from "@/lib/seo/extract";
import { runChecks } from "@/lib/seo/checks";
import { detectTechnologies } from "@/lib/seo/tech";
import { isAllowed, parseRobots, groupFor, robotsAccess } from "@/lib/seo/robots";
import { collectSitemapUrls, parseSitemap, sitemapBodyToText } from "@/lib/seo/sitemap";
import { countSyllables, readability, textPixelWidth, topNGrams, truncateToPixels } from "@/lib/seo/text";
import { gzipSync } from "node:zlib";

const HTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Best Running Shoes for Beginners (2026 Guide)</title>
<meta name="description" content="We tested 40 running shoes to find the most comfortable, durable and affordable picks for new runners, from road to trail.">
<link rel="canonical" href="/shoes">
<meta property="og:title" content="Shoes"><meta property="og:description" content="d"><meta property="og:image" content="/i.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico">
<link rel="alternate" hreflang="de" href="https://example.com/de/shoes">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Article"},{"@type":"BreadcrumbList"}]}</script>
<script type="application/ld+json">{ invalid json </script>
<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"></script>
<script src="/wp-includes/js/jquery/jquery.min.js"></script>
</head><body>
<nav><a href="/">Home</a><a href="/about" rel="nofollow">About</a></nav>
<main><h1>Best running shoes</h1><h3>Skipped level</h3>
<p>Running shoes for beginners should be comfortable. Running shoes protect your feet. Choose running shoes carefully.</p>
<p><a href="https://other.com/review">Review</a> <a href="https://ads.com" rel="sponsored">Ad</a> <a href="/x"><img src="/a.png" alt="A shoe"></a> <a href="/empty"></a></p>
<img src="/b.png"><img src="http://insecure.com/c.png" alt="" width="1" height="1">
<form action="http://example.com/subscribe"></form>
</main><footer>Footer text</footer>
<script>console.log("inline")</script>
</body></html>`;

describe("extractPage", () => {
  const page = extractPage(HTML, "https://example.com/shoes");

  it("reads meta tags", () => {
    expect(page.title).toBe("Best Running Shoes for Beginners (2026 Guide)");
    expect(page.metaDescription).toMatch(/^We tested 40/);
    expect(page.canonical).toBe("https://example.com/shoes");
    expect(page.lang).toBe("en");
    expect(page.charset).toBe("utf-8");
    expect(page.hreflang).toEqual([{ lang: "de", href: "https://example.com/de/shoes" }]);
    expect(page.openGraph["og:image"]).toBe("/i.png");
    expect(page.twitter["twitter:card"]).toBe("summary_large_image");
    expect(page.favicon).toBe("https://example.com/favicon.ico");
  });

  it("parses headings, links and images", () => {
    expect(page.h1).toEqual(["Best running shoes"]);
    expect(page.headings.map((h) => h.level)).toEqual([1, 3]);
    const about = page.links.find((l) => l.href.endsWith("/about"))!;
    expect(about.internal).toBe(true);
    expect(about.nofollow).toBe(true);
    expect(about.inNav).toBe(true);
    expect(page.links.find((l) => l.href === "https://ads.com/")!.nofollow).toBe(true);
    expect(page.links.find((l) => l.href.endsWith("/x"))!.text).toBe("A shoe");
    expect(page.images).toHaveLength(3);
    expect(page.images.filter((i) => i.alt === null)).toHaveLength(1);
  });

  it("parses structured data including invalid blocks", () => {
    expect(page.jsonLd[0]).toEqual({ types: ["Article", "BreadcrumbList"], valid: true });
    expect(page.jsonLd[1].valid).toBe(false);
  });

  it("finds mixed content and insecure forms", () => {
    expect(page.mixedContent).toEqual(["http://insecure.com/c.png"]);
    expect(page.forms[0].insecure).toBe(true);
  });

  it("counts visible words excluding scripts", () => {
    expect(page.wordCount).toBeGreaterThan(20);
    expect(page.mainText).not.toContain("console.log");
    expect(page.mainText).not.toContain("Footer text");
    expect(page.mainText.startsWith("Best running shoes Skipped level Running")).toBe(true);
  });

  it("detects JavaScript-rendered shells but not content pages", () => {
    const shellHtml = `<html><body><div id="root"></div><script src="/a.js"></script></body></html>`;
    expect(looksClientRendered(shellHtml, extractPage(shellHtml, "https://e.com/"))).toBe(true);
    const noscriptHtml = `<html><body><noscript>You need to enable JavaScript to run this app.</noscript><div id="app">Loading</div></body></html>`;
    expect(looksClientRendered(noscriptHtml, extractPage(noscriptHtml, "https://e.com/"))).toBe(true);
    expect(looksClientRendered(HTML, page)).toBe(false);
  });

  it("parses robots directives from meta and headers", () => {
    expect(robotsDirectives("noindex, follow", null).noindex).toBe(true);
    expect(robotsDirectives(null, "googlebot: noindex").noindex).toBe(true);
    expect(robotsDirectives("none", null)).toEqual({ noindex: true, nofollow: true });
    expect(robotsDirectives("index, follow", "max-snippet:-1").noindex).toBe(false);
  });
});

describe("runChecks", () => {
  const page = extractPage(HTML, "https://example.com/shoes");
  const base = {
    url: "https://example.com/shoes",
    status: 200,
    redirectCount: 0,
    ttfbMs: 120,
    htmlBytes: 5000,
    compressed: true,
    headers: { "content-encoding": "br", "strict-transport-security": "max-age=1", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" },
    hasDoctype: true,
    page,
    noindex: false,
    noindexSource: null,
    robotsAccess: { googlebot: true, bingbot: true, otherBots: true },
  };

  it("scores a mostly healthy page and flags real problems", () => {
    const { checks, score } = runChecks(base);
    const status = (id: string) => checks.find((c) => c.id === id)?.status;
    expect(status("title")).toBe("pass");
    expect(status("description")).toBe("pass");
    expect(status("canonical")).toBe("pass");
    expect(status("h1")).toBe("pass");
    expect(status("heading-order")).toBe("warn");
    expect(status("structured-data")).toBe("fail");
    expect(status("mixed-content")).toBe("fail");
    expect(status("insecure-forms")).toBe("fail");
    expect(status("nofollow-internal")).toBe("warn");
    expect(status("anchor-text")).toBe("warn");
    expect(status("img-alt")).toBe("warn");
    expect(status("security-headers")).toBe("pass");
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThan(100);
  });

  it("fails noindex, non-200 and Googlebot-blocked pages", () => {
    const { checks, score } = runChecks({ ...base, status: 404, noindex: true, noindexSource: "meta robots tag", robotsAccess: { googlebot: false, bingbot: false, otherBots: false } });
    for (const id of ["http-status", "indexable", "robots-txt"]) expect(checks.find((c) => c.id === id)?.status).toBe("fail");
    expect(score).toBeLessThan(runChecks(base).score);
  });

  it("does not penalize sites that only block non-search bots", () => {
    const { checks } = runChecks({ ...base, robotsAccess: { googlebot: true, bingbot: true, otherBots: false } });
    const robots = checks.find((c) => c.id === "robots-txt")!;
    expect(robots.status).toBe("pass");
    expect(robots.message).toMatch(/Other bots are blocked/);
    expect(runChecks({ ...base, robotsAccess: { googlebot: true, bingbot: false, otherBots: false } }).checks.find((c) => c.id === "robots-txt")?.status).toBe("warn");
    expect(runChecks({ ...base, robotsAccess: null }).checks.find((c) => c.id === "robots-txt")).toBeUndefined();
  });

  it("treats missing headings and text on JavaScript-built pages as warnings", () => {
    const shell = extractPage(`<!doctype html><html lang="en"><head><title>App</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>`, "https://example.com/");
    const plain = runChecks({ ...base, page: shell });
    expect(plain.checks.find((c) => c.id === "h1")?.status).toBe("fail");
    expect(plain.checks.find((c) => c.id === "js-rendering")).toBeUndefined();
    const js = runChecks({ ...base, page: shell, jsRendered: true });
    expect(js.checks.find((c) => c.id === "h1")?.status).toBe("warn");
    expect(js.checks.find((c) => c.id === "word-count")?.status).toBe("warn");
    expect(js.checks.find((c) => c.id === "js-rendering")?.status).toBe("warn");
  });

  it("evaluates keyword placement", () => {
    const { checks } = runChecks({ ...base, keyword: "running shoes" });
    const status = (id: string) => checks.find((c) => c.id === id)?.status;
    expect(status("kw-title")).toBe("pass");
    expect(status("kw-h1")).toBe("pass");
    expect(status("kw-url")).toBe("warn");
    expect(status("kw-intro")).toBe("pass");
    expect(checks.find((c) => c.id === "kw-density")?.value).toMatch(/4 times/);
  });
});

describe("detectTechnologies", () => {
  it("detects technologies with evidence", () => {
    const page = extractPage(HTML, "https://example.com/");
    const tech = detectTechnologies({ html: HTML, headers: { server: "cloudflare", "cf-ray": "abc", "x-powered-by": "PHP/8.2" }, scripts: page.scripts, generator: "WordPress 6.6.1" });
    const names = tech.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["WordPress", "Google Tag Manager", "jQuery", "Cloudflare", "PHP"]));
    expect(tech.find((t) => t.name === "WordPress")?.version).toBe("6.6.1");
    expect(tech.every((t) => t.evidence.length > 0)).toBe(true);
    expect(names).not.toContain("Shopify");
  });
});

describe("robots.txt", () => {
  const robots = parseRobots(`# comment
User-agent: *
Disallow: /private
Allow: /private/public
Disallow: /*.pdf$
Disallow: /search?

User-agent: TrafficLensBot
User-agent: OtherBot
Disallow: /no-bots
Crawl-delay: 2

Sitemap: https://example.com/sitemap.xml
Dissallow: /typo
`);

  it("parses groups, sitemaps and invalid lines", () => {
    expect(robots.groups).toHaveLength(2);
    expect(robots.groups[1].agents).toEqual(["trafficlensbot", "otherbot"]);
    expect(robots.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
    expect(robots.invalidLines).toHaveLength(1);
  });

  it("uses the most specific group", () => {
    expect(groupFor(robots, "TrafficLensBot").crawlDelay).toBe(2);
    expect(isAllowed(robots, "https://example.com/private", "TrafficLensBot")).toBe(true);
    expect(isAllowed(robots, "https://example.com/no-bots", "TrafficLensBot")).toBe(false);
  });

  it("applies longest-match, wildcards and end anchors", () => {
    const ua = "Googlebot";
    expect(isAllowed(robots, "https://example.com/private/x", ua)).toBe(false);
    expect(isAllowed(robots, "https://example.com/private/public/page", ua)).toBe(true);
    expect(isAllowed(robots, "https://example.com/files/a.pdf", ua)).toBe(false);
    expect(isAllowed(robots, "https://example.com/files/a.pdf?x=1", ua)).toBe(true);
    expect(isAllowed(robots, "https://example.com/search?q=1", ua)).toBe(false);
    expect(isAllowed(robots, "https://example.com/", ua)).toBe(true);
    expect(isAllowed(robots, "https://example.com/robots.txt", ua)).toBe(true);
  });

  it("separates search engines from other bots (instagram.com-style robots.txt)", () => {
    const ig = parseRobots(`User-agent: Googlebot
Disallow: /api/

User-agent: Bingbot
Disallow: /api/

User-agent: *
Disallow: /
`);
    expect(robotsAccess(ig, "https://www.instagram.com/")).toEqual({ googlebot: true, bingbot: true, otherBots: false });
    expect(robotsAccess(ig, "https://www.instagram.com/api/v1/x")).toEqual({ googlebot: false, bingbot: false, otherBots: false });
    expect(robotsAccess(null, "https://e.com/")).toEqual({ googlebot: true, bingbot: true, otherBots: true });
  });

  it("treats an empty disallow as allow-all", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow:"), "https://e.com/x", "a")).toBe(true);
    expect(isAllowed(parseRobots("User-agent: *\nDisallow: /"), "https://e.com/x", "a")).toBe(false);
  });
});

describe("sitemaps", () => {
  it("parses urlsets and indexes, including CDATA and entities", () => {
    const set = parseSitemap(`<urlset><url><loc>https://e.com/a?x=1&amp;y=2</loc><lastmod>2026-01-01</lastmod></url><url><loc><![CDATA[https://e.com/b]]></loc></url></urlset>`);
    expect(set.kind).toBe("urlset");
    expect(set.entries).toEqual([
      { loc: "https://e.com/a?x=1&y=2", lastmod: "2026-01-01" },
      { loc: "https://e.com/b", lastmod: null },
    ]);
    const idx = parseSitemap(`<sitemapindex><sitemap><loc>https://e.com/s1.xml</loc></sitemap></sitemapindex>`);
    expect(idx.kind).toBe("index");
    expect(idx.entries[0].loc).toBe("https://e.com/s1.xml");
  });

  it("reads sitemap indexes in parallel and stops at the deadline", async () => {
    const index = `<sitemapindex>${Array.from({ length: 6 }, (_, i) => `<sitemap><loc>https://e.com/s${i}.xml</loc></sitemap>`).join("")}</sitemapindex>`;
    const child = (i: number) => `<urlset><url><loc>https://e.com/p${i}</loc></url></urlset>`;
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchText = async (url: string) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 30));
      inFlight--;
      const m = /s(\d)\.xml$/.exec(url);
      return { status: 200, body: Buffer.from(m ? child(Number(m[1])) : index) };
    };
    const all = await collectSitemapUrls(["https://e.com/sitemap.xml"], fetchText, { concurrency: 3 });
    expect(all.urls).toHaveLength(6);
    expect(all.partial).toBe(false);
    expect(maxInFlight).toBe(3);

    const started = Date.now();
    const slow = async (url: string) => {
      await new Promise((r) => setTimeout(r, url.endsWith("sitemap.xml") ? 0 : 200));
      return fetchText(url);
    };
    const partial = await collectSitemapUrls(["https://e.com/sitemap.xml"], slow, { concurrency: 2, deadline: Date.now() + 100 });
    expect(partial.partial).toBe(true);
    expect(partial.urls.length).toBeLessThan(6);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("gunzips .xml.gz bodies", () => {
    expect(sitemapBodyToText(gzipSync("<urlset></urlset>"))).toBe("<urlset></urlset>");
  });
});

describe("text metrics", () => {
  it("counts syllables reasonably", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("running")).toBe(2);
    expect(countSyllables("optimization")).toBe(5);
  });

  it("scores readability", () => {
    const easy = readability("The cat sat on the mat. It was a good day. The sun was out. We had fun. ".repeat(5));
    const hard = readability("Comprehensive organizational restructuring necessitates multidimensional stakeholder considerations, particularly regarding implementation methodologies. ".repeat(5));
    expect(easy!.fleschReadingEase).toBeGreaterThan(80);
    expect(hard!.fleschReadingEase).toBeLessThan(30);
    expect(readability("too short")).toBeNull();
  });

  it("extracts n-grams without stopword edges", () => {
    const grams = topNGrams("running shoes are great. running shoes for the win. buy running shoes", 2);
    expect(grams[0]).toMatchObject({ phrase: "running shoes", count: 3 });
    expect(grams.find((g) => g.phrase.startsWith("for "))).toBeUndefined();
  });

  it("measures pixel width and truncates like a results page", () => {
    expect(textPixelWidth("WWWW", 20)).toBeGreaterThan(textPixelWidth("iiii", 20) * 3);
    const long = "This is a very long title that will definitely be truncated by the search engine results page";
    const t = truncateToPixels(long, 20, 600);
    expect(t.truncated).toBe(true);
    expect(t.text.endsWith("...")).toBe(true);
    expect(textPixelWidth(t.text, 20)).toBeLessThanOrEqual(600);
    expect(truncateToPixels("Short", 20, 600)).toEqual({ text: "Short", truncated: false });
  });
});
