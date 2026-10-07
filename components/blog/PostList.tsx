import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { formatPostDate, type PostMeta } from "@/lib/blog/posts";
import { cx } from "../ui";
import { AdSlot } from "../AdSlot";

export function PostMetaLine({ post, className }: { post: Pick<PostMeta, "date" | "readingMinutes" | "tags">; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3", className)}>
      <time dateTime={post.date}>{formatPostDate(post.date)}</time>
      <span aria-hidden>·</span>
      <span>{post.readingMinutes} min read</span>
      {post.tags.slice(0, 3).map((t) => (
        <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-ink-2">
          {t}
        </span>
      ))}
    </div>
  );
}

export function PostCard({ post, featured = false }: { post: PostMeta; featured?: boolean }) {
  return (
    <article className={cx("card group relative flex overflow-hidden", featured ? "flex-col md:flex-row" : "flex-col")}>
      <Image
        src={`/blog/${post.slug}/cover.png`}
        alt={post.cover.alt}
        width={1200}
        height={675}
        unoptimized
        priority={featured}
        className={cx("aspect-video h-auto w-full border-b border-line object-cover", featured && "md:w-[55%] md:border-b-0 md:border-r")}
      />
      <div className={cx("flex flex-1 flex-col p-5", featured && "md:justify-center md:p-7")}>
        <PostMetaLine post={post} />
        <h2 className={cx("mt-2 font-semibold text-ink group-hover:text-accent-ink", featured ? "text-2xl leading-snug" : "text-lg leading-snug")}>
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {post.title}
          </Link>
        </h2>
        <p className={cx("mt-2 text-ink-2", featured ? "text-base" : "text-sm")}>{post.description}</p>
      </div>
    </article>
  );
}

export function PostGrid({ posts, page, pages }: { posts: PostMeta[]; page: number; pages: number }) {
  const [first, ...rest] = posts;
  return (
    <div>
      {page === 1 && first ? (
        <>
          <PostCard post={first} featured />
          <AdSlot className="mt-6" />
          {rest.length > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      )}
      {pages > 1 && (
        <nav className="mt-10 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? (
            <Link href={page === 2 ? "/blog" : `/blog/page/${page - 1}`} className="inline-flex items-center gap-1 font-medium text-accent-ink hover:underline">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Newer posts
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-3">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={`/blog/page/${page + 1}`} className="inline-flex items-center gap-1 font-medium text-accent-ink hover:underline">
              Older posts <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

export function BlogHeader() {
  return (
    <header className="mb-8 max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Blog</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
        The day&apos;s biggest tech stories, checked against at least two independent sources and explained with what they mean for the web, search and the businesses that depend on them.
      </p>
      <p className="mt-2 text-sm text-ink-3">
        <Link href="/blog/rss.xml" className="text-accent-ink hover:underline">
          RSS feed
        </Link>{" "}
        ·{" "}
        <Link href="/blog/how-we-write" className="text-accent-ink hover:underline">
          How we write and check stories
        </Link>
      </p>
    </header>
  );
}
