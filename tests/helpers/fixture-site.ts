import http from "node:http";
import zlib from "node:zlib";
import type { AddressInfo } from "node:net";

/**
 * A small website with deliberate SEO problems, served on 127.0.0.1. Links to
 * "localhost" are treated as external (different host).
 */

function page(opts: { title?: string; description?: string; body: string; head?: string; lang?: boolean; viewport?: boolean }): string {
  return `<!DOCTYPE html>
<html${opts.lang === false ? "" : ' lang="en"'}>
<head>
<meta charset="utf-8">
${opts.viewport === false ? "" : '<meta name="viewport" content="width=device-width, initial-scale=1">'}
${opts.title !== undefined ? `<title>${opts.title}</title>` : ""}
${opts.description ? `<meta name="description" content="${opts.description}">` : ""}
${opts.head ?? ""}
</head>
<body>${opts.body}</body>
</html>`;
}

const LOREM =
  "Search engine optimization helps people find useful pages. Good content answers questions clearly and completely. " +
  "Fast pages keep visitors happy, and clear navigation helps crawlers discover every important page on a website. ";

export interface FixtureSite {
  origin: string;
  externalOrigin: string;
  close: () => Promise<void>;
}

export async function startFixtureSite(): Promise<FixtureSite> {
  let origin = "";
  let externalOrigin = "";

  const routes: Record<string, (req: http.IncomingMessage, res: http.ServerResponse) => void> = {
    "/": (_req, res) =>
      sendHtml(
        res,
        page({
          title: "Fixture Home – A Test Website for Crawling",
          description: "This is the fixture homepage used to test the TrafficLens crawler, with a healthy length meta description.",
          head: `<link rel="canonical" href="${origin}/"><meta property="og:title" content="Home"><meta property="og:image" content="${origin}/img/ok.png"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Fixture"}</script>`,
          body: `<header><nav><a href="/about">About</a> <a href="/blog">Blog</a></nav></header>
            <main><h1>Welcome to the fixture</h1><p>${LOREM.repeat(8)}</p>
            <a href="/broken">A broken link</a>
            <a href="/old">Old page</a>
            <a href="/chain1">Chained redirect</a>
            <a href="/private/secret">Private</a>
            <a href="/error">Server error</a>
            <a href="/files/report.pdf">Report PDF</a>
            <a href="${externalOrigin}/gone">Gone external</a>
            <a href="${externalOrigin}/fine">Fine external</a>
            <img src="/img/ok.png" alt="ok" width="10" height="10">
            <img src="/img/missing.png" alt="missing">
            </main>`,
        }),
        true,
      ),
    "/about": (_req, res) =>
      sendHtml(
        res,
        page({
          title: "Duplicate Title For Testing Purposes Here",
          body: `<main><h1>About</h1><p>${LOREM.repeat(4)}</p><a href="/">Home</a><img src="/img/ok.png"></main>`,
        }),
      ),
    "/blog": (_req, res) =>
      sendHtml(
        res,
        page({
          title: "Duplicate Title For Testing Purposes Here",
          description: "Short",
          body: `<main><h1>Blog</h1><h1>Second H1</h1><p>${LOREM.repeat(3)}</p><a href="/blog/post-1">Post 1</a><a href="http://${new URL(origin).host}/about">About</a></main>`,
        }),
      ),
    "/blog/post-1": (_req, res) =>
      sendHtml(res, page({ title: "Post one is a thin page with little text", body: `<h1>Post</h1><p>Too short.</p><a href="/deep/1">Deeper</a>`, lang: false, viewport: false })),
    "/deep/1": (_req, res) => sendHtml(res, page({ title: "Deep page level one for crawl depth", body: `<h1>Deep 1</h1><a href="/deep/2">Deeper</a>` })),
    "/deep/2": (_req, res) => sendHtml(res, page({ title: "Deep page level two for crawl depth", body: `<h1>Deep 2</h1><a href="/deep/3">Deeper</a>` })),
    "/deep/3": (_req, res) => sendHtml(res, page({ title: "Deep page level three for crawl depth", body: `<h1>Deep 3</h1><p>The end.</p>`, head: '<meta name="robots" content="noindex">' })),
    "/orphan": (_req, res) => sendHtml(res, page({ title: "Orphan page that nothing links to at all", body: `<h1>Orphan</h1><p>${LOREM}</p><a href="/">Home</a>` })),
    "/old": (_req, res) => redirect(res, 301, "/about"),
    "/chain1": (_req, res) => redirect(res, 301, "/chain2"),
    "/chain2": (_req, res) => redirect(res, 302, "/about"),
    "/loop-a": (_req, res) => redirect(res, 301, "/loop-b"),
    "/loop-b": (_req, res) => redirect(res, 301, "/loop-a"),
    "/error": (_req, res) => {
      res.writeHead(500, { "content-type": "text/html" });
      res.end("<h1>Oops</h1>");
    },
    "/private/secret": (_req, res) => sendHtml(res, page({ title: "Secret", body: "<h1>Secret</h1>" })),
    "/files/report.pdf": (_req, res) => {
      res.writeHead(200, { "content-type": "application/pdf" });
      res.end("%PDF-1.4");
    },
    "/img/ok.png": (_req, res) => {
      res.writeHead(200, { "content-type": "image/png" });
      res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    },
    "/robots.txt": (_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(`User-agent: *\nDisallow: /private\n\nSitemap: ${origin}/sitemap.xml\n`);
    },
    "/sitemap.xml": (_req, res) => {
      res.writeHead(200, { "content-type": "application/xml" });
      res.end(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
          ["/", "/about", "/orphan", "/old", "/deep/3"].map((p) => `<url><loc>${origin}${p}</loc><lastmod>2026-09-01</lastmod></url>`).join("") +
          `</urlset>`,
      );
    },
    "/big": (_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("x".repeat(200_000));
    },
    "/slow": (_req, res) => {
      setTimeout(() => sendHtml(res, page({ title: "Slow", body: "<h1>Slow</h1>" })), 1500);
    },
  };

  function sendHtml(res: http.ServerResponse, html: string, gzip = false) {
    if (gzip) {
      const body = zlib.gzipSync(html);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-encoding": "gzip", "x-powered-by": "Express", "strict-transport-security": "max-age=1" });
      res.end(body);
    } else {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
    }
  }
  function redirect(res: http.ServerResponse, code: number, location: string) {
    res.writeHead(code, { location });
    res.end();
  }

  const server = http.createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    const handler = routes[path];
    if (handler) return handler(req, res);
    res.writeHead(404, { "content-type": "text/html" });
    res.end("<h1>Not found</h1>");
  });
  const external = http.createServer((req, res) => {
    if (req.url === "/gone") {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<p>ok</p>");
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  await new Promise<void>((r) => external.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  externalOrigin = `http://localhost:${(external.address() as AddressInfo).port}`;

  return {
    origin,
    externalOrigin,
    close: async () => {
      server.closeAllConnections();
      external.closeAllConnections();
      await Promise.all([new Promise((r) => server.close(r)), new Promise((r) => external.close(r))]);
    },
  };
}
