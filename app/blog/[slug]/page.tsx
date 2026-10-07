import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink, Info } from "lucide-react";
import { formatPostDate, getAllPosts, getPost, relatedPosts } from "@/lib/blog/posts";
import { PostCard, PostMetaLine } from "@/components/blog/PostList";
import { SITE } from "@/lib/site";
import { AdSlot } from "@/components/AdSlot";
import { siteUrl } from "@/lib/site-url";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}`, types: { "application/rss+xml": "/blog/rss.xml" } },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      tags: post.tags,
      images: [{ url: `/blog/${post.slug}/cover.png`, width: 1200, height: 675, alt: post.cover.alt }],
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description, images: [`/blog/${post.slug}/cover.png`] },
  };
}

const json = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const url = `${siteUrl()}/blog/${post.slug}`;
  const related = relatedPosts(post);

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updated ?? post.date,
      mainEntityOfPage: url,
      url,
      keywords: post.tags.join(", "),
      image: ["cover.png", "cover-4x3.png", "cover-1x1.png"].map((f) => `${url}/${f}`),
      wordCount: post.words,
      author: { "@type": "Organization", name: SITE.name, url: siteUrl() },
      publisher: { "@type": "Organization", name: SITE.name, url: siteUrl() },
      isBasedOn: post.sources.map((s) => s.url),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Blog", item: `${siteUrl()}/blog` },
        { "@type": "ListItem", position: 2, name: post.title, item: url },
      ],
    },
  ];

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json(structuredData) }} />
      <article className="mx-auto max-w-[720px]">
        <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1 text-sm text-ink-3">
          <Link href="/blog" className="hover:text-ink">
            Blog
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span className="truncate">{post.tags[0]}</span>
        </nav>

        <header>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-[2.5rem] sm:leading-[1.15]">{post.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">{post.description}</p>
          <PostMetaLine post={post} className="mt-4" />
          <p className="mt-2 text-xs text-ink-3">
            By {SITE.name}
            {post.updated && (
              <>
                {" "}
                · Updated <time dateTime={post.updated}>{formatPostDate(post.updated, { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</time>
              </>
            )}
          </p>
        </header>

        <Image
          src={`/blog/${post.slug}/cover.png`}
          alt={post.cover.alt}
          width={1200}
          height={675}
          priority
          unoptimized
          className="mt-8 aspect-video h-auto w-full rounded-[14px] border border-line"
        />

        <aside className="card mt-8 p-5" aria-labelledby="key-facts">
          <h2 id="key-facts" className="text-sm font-semibold uppercase tracking-wide text-ink-3">
            Key facts
          </h2>
          <ul className="mt-3 space-y-2.5 text-[15px] text-ink">
            {post.keyFacts.map((k) => (
              <li key={k.text} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span>
                  {k.text}{" "}
                  <span className="whitespace-nowrap text-xs text-ink-3">
                    {[...new Set(k.sources)].map((n, i) => (
                      <span key={n}>
                        {i > 0 && ", "}
                        <a href={`#source-${n}`} className="text-accent-ink hover:underline" aria-label={`Source ${n}: ${post.sources[n - 1]?.publisher}`}>
                          [{n}]
                        </a>
                      </span>
                    ))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="article mt-8" dangerouslySetInnerHTML={{ __html: post.html }} />

        <AdSlot className="mt-10" />

        <section className="mt-12 border-t border-line pt-6" aria-labelledby="sources">
          <h2 id="sources" className="text-lg font-semibold text-ink">
            Sources
          </h2>
          <ol className="mt-3 space-y-2 text-sm">
            {post.sources.map((s, i) => (
              <li key={s.url} id={`source-${i + 1}`} className="flex gap-2 scroll-mt-24">
                <span className="tabular w-6 shrink-0 text-ink-3">[{i + 1}]</span>
                <span>
                  <span className="text-ink-2">{s.publisher}: </span>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">
                    {s.title}
                    <ExternalLink className="ml-1 inline h-3 w-3 align-baseline" aria-hidden />
                  </a>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-8 flex gap-2.5 rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          <span>
            Written with AI assistance and checked against the reports listed above: every key fact is confirmed by at least two independent sources.{" "}
            <Link href="/blog/how-we-write" className="text-accent-ink hover:underline">
              How we write
            </Link>{" "}
            ·{" "}
            <Link href="/contact?topic=bug" className="text-accent-ink hover:underline">
              Report an error
            </Link>
          </span>
        </p>
      </article>

      {related.length > 0 && (
        <section className="mx-auto mt-16 max-w-6xl" aria-labelledby="more-stories">
          <h2 id="more-stories" className="text-xl font-semibold text-ink">
            More stories
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
