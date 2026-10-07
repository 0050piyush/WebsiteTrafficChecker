import { describe, expect, it } from "vitest";
import { getAllPostFiles, parsePost, renderMarkdown, validatePost } from "@/lib/blog/posts";

describe("blog posts", () => {
  const posts = getAllPostFiles();

  it("has posts", () => {
    expect(posts.length).toBeGreaterThan(0);
  });

  // Publishing gate: the newsroom automation runs this before every push.
  it.each(posts.map((p) => [p.file, p] as const))("%s passes the editorial checks", (_file, post) => {
    expect(validatePost(post)).toEqual([]);
  });

  it("uses unique slugs", () => {
    const slugs = posts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

const POST = (front: string, body: string) => `---\n${front}\n---\n${body}`;
const GOOD_FRONT = `title: "A headline that says what happened"
description: "A description long enough to pass the check, saying what happened and why it matters."
date: "2026-10-07T12:00:00Z"
tags: [Test]
cover:
  motif: chip
  stat: "2027"
  statLabel: "a short label"
  alt: "Illustration of a processor chip for testing"
keyFacts:
  - text: "Fact one"
    sources: [1, 2]
  - text: "Fact two"
    sources: [1, 2]
  - text: "Fact three"
    sources: [2, 3]
sources:
  - publisher: "A"
    title: "Report A"
    url: "https://a.example.com/story"
  - publisher: "B"
    title: "Report B"
    url: "https://b.example.org/story"
  - publisher: "C"
    title: "Report C"
    url: "https://c.example.net/story"`;
const BODY = `Intro paragraph.\n\n## Section\n\n${"Plain words that make up the body of a story. ".repeat(50)}`;

describe("post validation", () => {
  it("accepts a well-formed post", () => {
    expect(validatePost(parsePost("2026-10-07-good-post.md", POST(GOOD_FRONT, BODY)))).toEqual([]);
  });

  it("rejects facts confirmed by only one website", () => {
    const front = GOOD_FRONT.replace("sources: [2, 3]", "sources: [1]");
    expect(validatePost(parsePost("2026-10-07-x.md", POST(front, BODY)))).toContain("key fact 3 must be confirmed by sources on two different websites");
  });

  it("rejects sources from a single website", () => {
    const front = GOOD_FRONT.replace("https://b.example.org/story", "https://a.example.com/other").replace("https://c.example.net/story", "https://www.a.example.com/third");
    const problems = validatePost(parsePost("2026-10-07-x.md", POST(front, BODY)));
    expect(problems).toContain("sources must come from at least 2 different websites");
  });

  it("catches filler phrases, short bodies, bad dates and reserved slugs", () => {
    const problems = validatePost(parsePost("2026-10-08-how-we-write.md", POST(GOOD_FRONT, "## Heading\n\nIn today's fast-paced world, let's delve in.")));
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("reserved address"),
        expect.stringContaining("doesn't match the file name date"),
        expect.stringContaining("words"),
        'uses the banned phrase "in today\'s fast-paced"',
        'uses the banned phrase "delve"',
      ]),
    );
  });

  it("requires a valid cover", () => {
    const front = GOOD_FRONT.replace("motif: chip", "motif: banana").replace('stat: "2027"', 'stat: "A very long stat"');
    const problems = validatePost(parsePost("2026-10-07-x.md", POST(front, BODY)));
    expect(problems.some((p) => p.startsWith("cover.motif"))).toBe(true);
    expect(problems.some((p) => p.startsWith("cover.stat"))).toBe(true);
  });
});

describe("markdown rendering", () => {
  it("drops raw HTML and unsafe links", () => {
    const html = renderMarkdown('Hi <script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=alert(1)>\n\n<div onclick="x">block</div>');
    expect(html).not.toMatch(/<script|onerror|onclick|javascript:/i);
    expect(html).toContain("x");
  });

  it("opens external links safely and gives headings anchors", () => {
    const html = renderMarkdown("## What to watch\n\n[CNBC](https://www.cnbc.com/x) and [about](/about)");
    expect(html).toContain('<h2 id="what-to-watch">What to watch</h2>');
    expect(html).toContain('<a href="https://www.cnbc.com/x" target="_blank" rel="noopener noreferrer">CNBC</a>');
    expect(html).toContain('<a href="/about">about</a>');
  });

  it("only allows our own images", () => {
    expect(renderMarkdown("![a](https://other.example/pic.jpg)")).not.toContain("<img");
    expect(renderMarkdown("![chart](/images/chart.png)")).toContain('<img src="/images/chart.png" alt="chart"');
  });
});
