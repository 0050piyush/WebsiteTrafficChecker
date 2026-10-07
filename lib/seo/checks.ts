import type { ExtractedPage } from "./extract";
import { SERP_DESCRIPTION_MAX_PX, SERP_TITLE_MAX_PX, textPixelWidth, tokenize } from "./text";

export type CheckStatus = "pass" | "warn" | "fail" | "info";
export type CheckCategory = "Indexing" | "Meta tags" | "Content" | "Keyword" | "Links" | "Images" | "Social & rich results" | "Performance" | "Security";

export interface Check {
  id: string;
  category: CheckCategory;
  title: string;
  status: CheckStatus;
  /** Short measured value, e.g. "54 characters (512px)". */
  value?: string;
  message: string;
  fix?: string;
  weight: number;
}

export interface CheckInput {
  url: string;
  status: number;
  redirectCount: number;
  ttfbMs: number;
  htmlBytes: number;
  compressed: boolean;
  headers: Record<string, string>;
  hasDoctype: boolean;
  page: ExtractedPage;
  noindex: boolean;
  noindexSource: string | null;
  robotsAllowed: boolean | null;
  keyword?: string;
}

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function runChecks(input: CheckInput): { checks: Check[]; score: number } {
  const { page } = input;
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  const isHttps = input.url.startsWith("https:");

  // ---------- Indexing ----------
  add(
    input.status >= 200 && input.status < 300
      ? { id: "http-status", category: "Indexing", title: "HTTP status", status: "pass", value: String(input.status), message: "The page returns a successful status code.", weight: 3 }
      : {
          id: "http-status",
          category: "Indexing",
          title: "HTTP status",
          status: "fail",
          value: String(input.status),
          message: `The page returns HTTP ${input.status}, so search engines won't index it.`,
          fix: "Serve the page with a 200 status, or redirect it to the right URL.",
          weight: 3,
        },
  );

  add(
    input.noindex
      ? {
          id: "indexable",
          category: "Indexing",
          title: "Indexability",
          status: "fail",
          value: "noindex",
          message: `A noindex directive (${input.noindexSource}) keeps this page out of search results.`,
          fix: "Remove the noindex directive if you want this page to rank.",
          weight: 3,
        }
      : { id: "indexable", category: "Indexing", title: "Indexability", status: "pass", value: "indexable", message: "No noindex directive in meta tags or X-Robots-Tag header.", weight: 3 },
  );

  if (input.robotsAllowed !== null) {
    add(
      input.robotsAllowed
        ? { id: "robots-txt", category: "Indexing", title: "robots.txt", status: "pass", message: "robots.txt allows crawling this URL.", weight: 3 }
        : {
            id: "robots-txt",
            category: "Indexing",
            title: "robots.txt",
            status: "fail",
            message: "robots.txt blocks crawlers from this URL, so its content can't be read by search engines.",
            fix: "Remove or narrow the Disallow rule that matches this path.",
            weight: 3,
          },
    );
  }

  if (!page.canonical) {
    add({
      id: "canonical",
      category: "Indexing",
      title: "Canonical URL",
      status: "warn",
      message: "No canonical tag. Search engines will guess the preferred URL among duplicates (http/https, trailing slashes, parameters).",
      fix: `Add <link rel="canonical" href="${input.url}"> to the <head>.`,
      weight: 2,
    });
  } else if (page.canonicalCount > 1) {
    add({ id: "canonical", category: "Indexing", title: "Canonical URL", status: "warn", value: plural(page.canonicalCount, "tag"), message: "Multiple canonical tags were found; search engines may ignore all of them.", fix: "Keep exactly one canonical tag.", weight: 2 });
  } else if (page.canonical.replace(/\/$/, "") !== input.url.replace(/\/$/, "")) {
    add({
      id: "canonical",
      category: "Indexing",
      title: "Canonical URL",
      status: "info",
      value: page.canonical,
      message: "The canonical points to a different URL, so this page asks to be treated as a duplicate of it.",
      weight: 0,
    });
  } else {
    add({ id: "canonical", category: "Indexing", title: "Canonical URL", status: "pass", value: "self-referencing", message: "The page declares itself as the canonical URL.", weight: 2 });
  }

  add(
    input.redirectCount === 0
      ? { id: "redirects", category: "Indexing", title: "Redirects", status: "pass", value: "none", message: "The URL resolves without redirects.", weight: 1 }
      : input.redirectCount === 1
        ? { id: "redirects", category: "Indexing", title: "Redirects", status: "pass", value: "1 hop", message: "One redirect before the final URL. Link directly to the final URL where you can.", weight: 1 }
        : {
            id: "redirects",
            category: "Indexing",
            title: "Redirects",
            status: "warn",
            value: plural(input.redirectCount, "hop"),
            message: "A redirect chain slows users down and wastes crawl budget.",
            fix: "Point the first URL straight at the final destination.",
            weight: 1,
          },
  );

  let urlProblems: string[] = [];
  try {
    const u = new URL(input.url);
    if (input.url.length > 115) urlProblems.push("longer than 115 characters");
    if (/[A-Z]/.test(u.pathname)) urlProblems.push("contains uppercase letters");
    if (u.pathname.includes("_")) urlProblems.push("uses underscores instead of hyphens");
    if ([...u.searchParams.keys()].length > 2) urlProblems.push("has many query parameters");
  } catch {
    urlProblems = [];
  }
  add(
    urlProblems.length
      ? { id: "url", category: "Indexing", title: "URL format", status: "warn", message: `The URL ${urlProblems.join(", ")}.`, fix: "Prefer short, lowercase, hyphenated URLs.", weight: 1 }
      : { id: "url", category: "Indexing", title: "URL format", status: "pass", message: "Short, readable URL.", weight: 1 },
  );

  if (page.hreflang.length) {
    const selfRef = page.hreflang.some((h) => h.href.replace(/\/$/, "") === input.url.replace(/\/$/, ""));
    add({
      id: "hreflang",
      category: "Indexing",
      title: "hreflang",
      status: selfRef ? "pass" : "warn",
      value: plural(page.hreflang.length, "alternate"),
      message: selfRef ? "Language alternates are declared, including a self-reference." : "hreflang alternates are declared but none points back to this URL.",
      fix: selfRef ? undefined : "Every page in an hreflang set must list itself as well as its alternates.",
      weight: 1,
    });
  }

  // ---------- Meta tags ----------
  if (!page.title) {
    add({ id: "title", category: "Meta tags", title: "Title tag", status: "fail", message: "The page has no <title>. Search engines will invent one.", fix: "Add a unique, descriptive title of roughly 50–60 characters.", weight: 3 });
  } else {
    const px = textPixelWidth(page.title, 20);
    const value = `${page.title.length} characters · ~${px}px`;
    if (px > SERP_TITLE_MAX_PX) {
      add({ id: "title", category: "Meta tags", title: "Title tag", status: "warn", value, message: `The title is wider than ~${SERP_TITLE_MAX_PX}px and will likely be cut off in search results.`, fix: "Shorten the title or move the important words to the front.", weight: 3 });
    } else if (page.title.length < 30) {
      add({ id: "title", category: "Meta tags", title: "Title tag", status: "warn", value, message: "The title is short; you may be leaving relevant keywords and context out.", fix: "Aim for 30–60 characters that describe the page.", weight: 3 });
    } else {
      add({ id: "title", category: "Meta tags", title: "Title tag", status: "pass", value, message: "The title has a good length and should display in full.", weight: 3 });
    }
  }
  if (page.titleCount > 1) {
    add({ id: "title-multiple", category: "Meta tags", title: "Multiple title tags", status: "warn", value: String(page.titleCount), message: "More than one <title> element was found; only one is used.", fix: "Remove the extra title tags.", weight: 1 });
  }

  if (!page.metaDescription) {
    add({
      id: "description",
      category: "Meta tags",
      title: "Meta description",
      status: "fail",
      message: "No meta description. Search engines will pull a snippet from the page, which is often less compelling.",
      fix: "Write a 120–160 character summary that makes people want to click.",
      weight: 2,
    });
  } else {
    const len = page.metaDescription.length;
    const px = textPixelWidth(page.metaDescription, 14);
    const value = `${len} characters · ~${px}px`;
    if (px > SERP_DESCRIPTION_MAX_PX || len > 160) {
      add({ id: "description", category: "Meta tags", title: "Meta description", status: "warn", value, message: "The description is long and will likely be truncated.", fix: "Keep it under ~155 characters.", weight: 2 });
    } else if (len < 70) {
      add({ id: "description", category: "Meta tags", title: "Meta description", status: "warn", value, message: "The description is short; use the space to sell the click.", fix: "Aim for 120–160 characters.", weight: 2 });
    } else {
      add({ id: "description", category: "Meta tags", title: "Meta description", status: "pass", value, message: "The description has a good length.", weight: 2 });
    }
  }

  add(
    page.viewport
      ? { id: "viewport", category: "Meta tags", title: "Mobile viewport", status: "pass", value: page.viewport, message: "A viewport meta tag is set, so the page can render properly on phones.", weight: 2 }
      : {
          id: "viewport",
          category: "Meta tags",
          title: "Mobile viewport",
          status: "fail",
          message: "No viewport meta tag. Mobile browsers will render a zoomed-out desktop layout, and Google indexes mobile-first.",
          fix: '<meta name="viewport" content="width=device-width, initial-scale=1">',
          weight: 2,
        },
  );

  add(
    page.lang
      ? { id: "lang", category: "Meta tags", title: "Language", status: "pass", value: page.lang, message: "The html element declares the page language.", weight: 1 }
      : { id: "lang", category: "Meta tags", title: "Language", status: "warn", message: "The <html> element has no lang attribute (helps search engines and screen readers).", fix: '<html lang="en">', weight: 1 },
  );

  add(
    page.charset || /charset=/i.test(input.headers["content-type"] ?? "")
      ? { id: "charset", category: "Meta tags", title: "Character encoding", status: "pass", value: page.charset ?? "via header", message: "The character encoding is declared.", weight: 1 }
      : { id: "charset", category: "Meta tags", title: "Character encoding", status: "warn", message: "No charset declared; text may render garbled.", fix: '<meta charset="utf-8"> as the first element in <head>.', weight: 1 },
  );

  add(
    input.hasDoctype
      ? { id: "doctype", category: "Meta tags", title: "Doctype", status: "pass", message: "HTML5 doctype present.", weight: 1 }
      : { id: "doctype", category: "Meta tags", title: "Doctype", status: "warn", message: "No doctype; browsers render the page in quirks mode.", fix: "Start the document with <!DOCTYPE html>.", weight: 1 },
  );

  if (page.metaKeywords) {
    add({ id: "meta-keywords", category: "Meta tags", title: "Meta keywords", status: "info", message: "A meta keywords tag is present. Google ignores it, and it shows competitors your targets.", weight: 0 });
  }

  // ---------- Content ----------
  const h1Count = page.h1.length;
  add(
    h1Count === 1
      ? { id: "h1", category: "Content", title: "H1 heading", status: "pass", value: page.h1[0].slice(0, 80) || "(empty)", message: "Exactly one H1 heading.", weight: 2 }
      : h1Count === 0
        ? { id: "h1", category: "Content", title: "H1 heading", status: "fail", message: "No H1 heading. The H1 tells readers and search engines what the page is about.", fix: "Add one H1 that summarizes the page.", weight: 2 }
        : { id: "h1", category: "Content", title: "H1 heading", status: "warn", value: `${h1Count} H1s`, message: "Multiple H1 headings dilute the main topic signal.", fix: "Use one H1 and demote the others to H2.", weight: 2 },
  );

  const skipped: string[] = [];
  for (let i = 1; i < page.headings.length; i++) {
    const prev = page.headings[i - 1].level;
    const cur = page.headings[i].level;
    if (cur > prev + 1) skipped.push(`H${prev}→H${cur}`);
  }
  add(
    skipped.length
      ? { id: "heading-order", category: "Content", title: "Heading hierarchy", status: "warn", value: [...new Set(skipped)].slice(0, 3).join(", "), message: "Heading levels are skipped, which makes the outline harder to follow.", fix: "Nest headings in order (H1 → H2 → H3).", weight: 1 }
      : { id: "heading-order", category: "Content", title: "Heading hierarchy", status: "pass", value: plural(page.headings.length, "heading"), message: "Headings follow a logical order.", weight: 1 },
  );

  const words = page.wordCount;
  add(
    words >= 300
      ? { id: "word-count", category: "Content", title: "Content length", status: "pass", value: `${words.toLocaleString("en-US")} words`, message: "The page has a substantial amount of text.", weight: 2 }
      : words >= 50
        ? { id: "word-count", category: "Content", title: "Content length", status: "warn", value: `${words} words`, message: "Thin content. Pages that rank usually answer the query in depth.", fix: "Expand the content if this page should rank for informational queries.", weight: 2 }
        : { id: "word-count", category: "Content", title: "Content length", status: "fail", value: `${words} words`, message: "Almost no indexable text. If content is rendered by JavaScript, search engines may see an empty page.", fix: "Server-render the main content or add descriptive text.", weight: 2 },
  );

  // ---------- Keyword focus ----------
  if (input.keyword) {
    const kw = input.keyword.toLowerCase().trim();
    const kwTokens = tokenize(kw);
    const containsKw = (text: string | null | undefined) => {
      if (!text) return false;
      const t = text.toLowerCase();
      if (t.includes(kw)) return true;
      const tokens = new Set(tokenize(t));
      return kwTokens.length > 1 && kwTokens.every((k) => tokens.has(k));
    };
    const slug = (() => {
      try {
        return decodeURIComponent(new URL(input.url).pathname).replace(/[-_/]+/g, " ");
      } catch {
        return "";
      }
    })();
    const first100 = page.mainText.split(/\s+/).slice(0, 100).join(" ");
    const places: [string, string, boolean, string][] = [
      ["kw-title", "Keyword in title", containsKw(page.title), "Put the keyword near the start of the title."],
      ["kw-description", "Keyword in meta description", containsKw(page.metaDescription), "Search engines bold matching words in the snippet."],
      ["kw-h1", "Keyword in H1", page.h1.some((h) => containsKw(h)), "Use the keyword (or a close variant) in the H1."],
      ["kw-url", "Keyword in URL", containsKw(slug), "Include the keyword in the URL slug."],
      ["kw-intro", "Keyword in first 100 words", containsKw(first100), "Mention the topic early in the body copy."],
    ];
    for (const [id, title, ok, fix] of places) {
      add({ id, category: "Keyword", title, status: ok ? "pass" : "warn", message: ok ? `“${input.keyword}” appears here.` : `“${input.keyword}” wasn't found here.`, fix: ok ? undefined : fix, weight: 1 });
    }
    const textTokens = tokenize(page.mainText);
    let occurrences = 0;
    if (kwTokens.length) {
      for (let i = 0; i + kwTokens.length <= textTokens.length; i++) {
        if (kwTokens.every((t, j) => textTokens[i + j] === t)) occurrences++;
      }
    }
    const density = textTokens.length ? ((occurrences * kwTokens.length) / textTokens.length) * 100 : 0;
    const d = `${density.toFixed(2)}% (${plural(occurrences, "time")})`;
    add(
      occurrences === 0
        ? { id: "kw-density", category: "Keyword", title: "Keyword usage in body", status: "warn", value: d, message: "The exact phrase never appears in the main content.", fix: "Use the phrase naturally in the body copy.", weight: 1 }
        : density > 4
          ? { id: "kw-density", category: "Keyword", title: "Keyword usage in body", status: "warn", value: d, message: "The phrase is repeated a lot; this can read as keyword stuffing.", fix: "Use synonyms and related terms instead of repeating the phrase.", weight: 1 }
          : { id: "kw-density", category: "Keyword", title: "Keyword usage in body", status: "pass", value: d, message: "The phrase is used naturally in the body.", weight: 1 },
    );
  }

  // ---------- Links ----------
  const internal = page.links.filter((l) => l.internal);
  const external = page.links.filter((l) => !l.internal);
  add(
    internal.length
      ? { id: "internal-links", category: "Links", title: "Internal links", status: "pass", value: String(internal.length), message: "The page links to other pages on the site, helping crawlers and users move on.", weight: 1 }
      : { id: "internal-links", category: "Links", title: "Internal links", status: "warn", value: "0", message: "No internal links: a dead end for users and crawlers.", fix: "Link to related pages on your site.", weight: 1 },
  );
  const nofollowInternal = internal.filter((l) => l.nofollow).length;
  if (nofollowInternal) {
    add({ id: "nofollow-internal", category: "Links", title: "Nofollow internal links", status: "warn", value: String(nofollowInternal), message: "Some internal links are nofollow, which stops link equity from flowing through your own site.", fix: "Remove rel=nofollow from internal links.", weight: 1 });
  }
  const emptyAnchors = page.links.filter((l) => !l.text).length;
  add(
    emptyAnchors
      ? { id: "anchor-text", category: "Links", title: "Anchor text", status: "warn", value: `${emptyAnchors} empty`, message: "Some links have no text or accessible name, so their context is lost.", fix: "Give every link descriptive text or an aria-label.", weight: 1 }
      : { id: "anchor-text", category: "Links", title: "Anchor text", status: "pass", message: "All links have anchor text.", weight: 1 },
  );
  if (page.links.length > 300) {
    add({ id: "link-count", category: "Links", title: "Number of links", status: "warn", value: String(page.links.length), message: "A very high number of links dilutes the value passed by each one.", weight: 1 });
  }
  add({ id: "external-links", category: "Links", title: "External links", status: "info", value: String(external.length), message: `${external.filter((l) => l.nofollow).length} of them are nofollow/ugc/sponsored.`, weight: 0 });

  // ---------- Images ----------
  if (page.images.length) {
    const missingAlt = page.images.filter((i) => i.alt === null).length;
    add(
      missingAlt
        ? { id: "img-alt", category: "Images", title: "Image alt text", status: "warn", value: `${missingAlt} of ${page.images.length} missing`, message: "Images without alt text are invisible to search engines and screen readers.", fix: 'Add descriptive alt text (or alt="" for purely decorative images).', weight: 2 }
        : { id: "img-alt", category: "Images", title: "Image alt text", status: "pass", value: `${page.images.length} images`, message: "Every image has an alt attribute.", weight: 2 },
    );
    const noDims = page.images.filter((i) => !i.width || !i.height).length;
    add(
      noDims / page.images.length > 0.3
        ? { id: "img-dimensions", category: "Images", title: "Image dimensions", status: "warn", value: `${noDims} without width/height`, message: "Images without explicit dimensions cause layout shift (CLS) while loading.", fix: "Set width and height attributes (or CSS aspect-ratio).", weight: 1 }
        : { id: "img-dimensions", category: "Images", title: "Image dimensions", status: "pass", message: "Most images reserve their space before loading.", weight: 1 },
    );
  }

  // ---------- Social & rich results ----------
  const og = page.openGraph;
  const ogMissing = ["og:title", "og:description", "og:image"].filter((k) => !og[k]);
  add(
    ogMissing.length === 0
      ? { id: "open-graph", category: "Social & rich results", title: "Open Graph", status: "pass", message: "Title, description and image are set for link previews.", weight: 1 }
      : { id: "open-graph", category: "Social & rich results", title: "Open Graph", status: "warn", value: `missing ${ogMissing.join(", ")}`, message: "Shared links will have a weaker preview on social networks and chat apps.", fix: "Add the missing og: tags.", weight: 1 },
  );
  add({
    id: "twitter-card",
    category: "Social & rich results",
    title: "Twitter/X card",
    status: page.twitter["twitter:card"] ? "pass" : "info",
    value: page.twitter["twitter:card"] ?? undefined,
    message: page.twitter["twitter:card"] ? "A Twitter/X card type is set." : "No twitter:card tag; X falls back to Open Graph with a small preview.",
    weight: page.twitter["twitter:card"] ? 1 : 0,
  });
  const invalidLd = page.jsonLd.filter((j) => !j.valid).length;
  const types = [...new Set([...page.jsonLd.flatMap((j) => j.types), ...page.microdataTypes])];
  add(
    invalidLd
      ? { id: "structured-data", category: "Social & rich results", title: "Structured data", status: "fail", value: `${invalidLd} invalid block(s)`, message: "Some JSON-LD can't be parsed, so search engines ignore it.", fix: "Validate the JSON-LD (e.g. with the Schema.org validator).", weight: 1 }
      : types.length
        ? { id: "structured-data", category: "Social & rich results", title: "Structured data", status: "pass", value: types.slice(0, 5).join(", "), message: "Schema.org markup found; this can unlock rich results.", weight: 1 }
        : { id: "structured-data", category: "Social & rich results", title: "Structured data", status: "warn", message: "No structured data found.", fix: "Add JSON-LD for your content type (Organization, Article, Product, FAQ…).", weight: 1 },
  );
  add(
    page.favicon
      ? { id: "favicon", category: "Social & rich results", title: "Favicon", status: "pass", message: "A favicon is declared (shown next to your result on mobile and desktop).", weight: 1 }
      : { id: "favicon", category: "Social & rich results", title: "Favicon", status: "warn", message: "No favicon link tag; browsers will fall back to /favicon.ico.", fix: '<link rel="icon" href="/favicon.ico">', weight: 1 },
  );

  // ---------- Performance ----------
  add(
    input.ttfbMs < 600
      ? { id: "ttfb", category: "Performance", title: "Server response time", status: "pass", value: `${input.ttfbMs} ms`, message: "Fast time to first byte (measured from our server).", weight: 2 }
      : input.ttfbMs < 1500
        ? { id: "ttfb", category: "Performance", title: "Server response time", status: "warn", value: `${input.ttfbMs} ms`, message: "Time to first byte is slow, delaying everything else.", fix: "Add caching, a CDN, or optimize server-side rendering.", weight: 2 }
        : { id: "ttfb", category: "Performance", title: "Server response time", status: "fail", value: `${input.ttfbMs} ms`, message: "Very slow time to first byte.", fix: "Investigate server performance; consider full-page caching and a CDN.", weight: 2 },
  );
  add(
    input.htmlBytes < 1024 * 1024
      ? { id: "html-size", category: "Performance", title: "HTML size", status: "pass", value: kb(input.htmlBytes), message: "The HTML document is a reasonable size.", weight: 1 }
      : { id: "html-size", category: "Performance", title: "HTML size", status: input.htmlBytes < 2 * 1024 * 1024 ? "warn" : "fail", value: kb(input.htmlBytes), message: "Very large HTML slows parsing, and crawlers may stop reading before the end.", fix: "Move inline data/scripts to external files and trim markup.", weight: 1 },
  );
  if (input.htmlBytes > 1024) {
    add(
      input.compressed
        ? { id: "compression", category: "Performance", title: "Compression", status: "pass", value: input.headers["content-encoding"], message: "The HTML is served compressed.", weight: 1 }
        : { id: "compression", category: "Performance", title: "Compression", status: "warn", message: "The HTML is served uncompressed.", fix: "Enable gzip or Brotli on your server/CDN.", weight: 1 },
    );
  }
  if (page.inlineScriptBytes > 100 * 1024) {
    add({ id: "inline-js", category: "Performance", title: "Inline JavaScript", status: "warn", value: kb(page.inlineScriptBytes), message: "Lots of inline JavaScript bloats every page load and can't be cached separately.", weight: 1 });
  }

  // ---------- Security ----------
  add(
    isHttps
      ? { id: "https", category: "Security", title: "HTTPS", status: "pass", message: "The page is served over HTTPS.", weight: 3 }
      : { id: "https", category: "Security", title: "HTTPS", status: "fail", message: "The page is served over plain HTTP. Browsers flag it as Not Secure, and HTTPS is a ranking signal.", fix: "Install a TLS certificate and redirect HTTP to HTTPS.", weight: 3 },
  );
  if (isHttps) {
    add(
      page.mixedContent.length
        ? { id: "mixed-content", category: "Security", title: "Mixed content", status: "fail", value: `${page.mixedContent.length} insecure resource(s)`, message: "The HTTPS page loads resources over HTTP; browsers block or warn about them.", fix: "Load every resource over HTTPS.", weight: 2 }
        : { id: "mixed-content", category: "Security", title: "Mixed content", status: "pass", message: "All resources load over HTTPS.", weight: 2 },
    );
  }
  const insecureForms = page.forms.filter((f) => f.insecure).length;
  if (insecureForms) {
    add({ id: "insecure-forms", category: "Security", title: "Insecure forms", status: "fail", value: String(insecureForms), message: "A form submits over plain HTTP, exposing what users type.", fix: "Point form actions at HTTPS URLs.", weight: 2 });
  }
  const h = input.headers;
  const securityHeaders: [string, boolean][] = [
    ["HSTS", !!h["strict-transport-security"]],
    ["CSP", !!h["content-security-policy"]],
    ["X-Content-Type-Options", !!h["x-content-type-options"]],
    ["Clickjacking protection", !!h["x-frame-options"] || /frame-ancestors/i.test(h["content-security-policy"] ?? "")],
    ["Referrer-Policy", !!h["referrer-policy"]],
  ];
  const present = securityHeaders.filter(([, ok]) => ok).map(([n]) => n);
  const missing = securityHeaders.filter(([, ok]) => !ok).map(([n]) => n);
  add({
    id: "security-headers",
    category: "Security",
    title: "Security headers",
    status: present.length >= 3 ? "pass" : "warn",
    value: `${present.length}/5`,
    message: missing.length ? `Missing: ${missing.join(", ")}.` : "All common security headers are set.",
    fix: missing.length ? "Add the missing headers at your server or CDN." : undefined,
    weight: 1,
  });

  const scored = checks.filter((c) => c.status !== "info" && c.weight > 0);
  const total = scored.reduce((s, c) => s + c.weight, 0);
  const earned = scored.reduce((s, c) => s + c.weight * (c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0), 0);
  return { checks, score: total ? Math.round((earned / total) * 100) : 0 };
}
