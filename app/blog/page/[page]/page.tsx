import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageCount, postsForPage } from "@/lib/blog/posts";
import { BlogHeader, PostGrid } from "@/components/blog/PostList";

export const dynamicParams = false;

export function generateStaticParams() {
  // Page 1 lives at /blog. Next needs at least one param, so a placeholder is returned
  // (and 404s) while there's only one page.
  const pages = pageCount();
  return pages > 1 ? Array.from({ length: pages - 1 }, (_, i) => ({ page: String(i + 2) })) : [{ page: "2" }];
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const { page } = await params;
  return { title: `Blog, page ${page}`, alternates: { canonical: `/blog/page/${page}`, types: { "application/rss+xml": "/blog/rss.xml" } } };
}

export default async function BlogPage({ params }: { params: Promise<{ page: string }> }) {
  const page = Number((await params).page);
  const pages = pageCount();
  if (!Number.isInteger(page) || page < 2 || page > pages) notFound();
  return (
    <div>
      <BlogHeader />
      <PostGrid posts={postsForPage(page)} page={page} pages={pages} />
    </div>
  );
}
