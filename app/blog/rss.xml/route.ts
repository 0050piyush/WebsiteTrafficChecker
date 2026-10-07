import { getAllPosts } from "@/lib/blog/posts";
import { SITE } from "@/lib/site";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** GET /blog/rss.xml: the 30 most recent posts. */
export function GET() {
  const base = siteUrl();
  const posts = getAllPosts().slice(0, 30);
  const items = posts
    .map(
      (p) => `    <item>
      <title>${xml(p.title)}</title>
      <link>${base}/blog/${p.slug}</link>
      <guid isPermaLink="true">${base}/blog/${p.slug}</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <description>${xml(p.description)}</description>
${p.tags.map((t) => `      <category>${xml(t)}</category>`).join("\n")}
    </item>`,
    )
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(SITE.name)} Blog</title>
    <link>${base}/blog</link>
    <description>The day's biggest tech stories, checked against independent sources.</description>
    <language>en</language>
    <atom:link href="${base}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${posts[0] ? `    <lastBuildDate>${new Date(posts[0].updated ?? posts[0].date).toUTCString()}</lastBuildDate>\n` : ""}${items}
  </channel>
</rss>
`;
  return new Response(body, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
