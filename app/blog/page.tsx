import type { Metadata } from "next";
import { pageCount, postsForPage } from "@/lib/blog/posts";
import { BlogHeader, PostGrid } from "@/components/blog/PostList";

export const metadata: Metadata = {
  title: "Blog: tech news, checked and explained",
  description: "The day's biggest tech stories, checked against at least two independent sources and explained with what they mean for the web, search and online businesses.",
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
};

export default function BlogIndex() {
  const posts = postsForPage(1);
  return (
    <div>
      <BlogHeader />
      {posts.length ? <PostGrid posts={posts} page={1} pages={pageCount()} /> : <p className="text-ink-2">No posts yet. Check back soon.</p>}
    </div>
  );
}
