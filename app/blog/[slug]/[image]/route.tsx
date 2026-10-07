import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getAllPosts, getPost } from "@/lib/blog/posts";
import { CoverArt } from "@/components/blog/CoverArt";
import { COVER_SIZES } from "@/lib/blog/cover";

export const dynamic = "force-static";
export const dynamicParams = false;

/** /blog/<slug>/cover.png (16:9), cover-4x3.png and cover-1x1.png, rendered at build time. */
export function generateStaticParams() {
  return getAllPosts().flatMap((p) => Object.keys(COVER_SIZES).map((image) => ({ slug: p.slug, image })));
}

const fontFile = (weight: number) => fs.readFileSync(path.join(process.cwd(), "node_modules", "@fontsource", "inter", "files", `inter-latin-${weight}-normal.woff`));

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; image: string }> }) {
  const { slug, image } = await params;
  const post = getPost(slug);
  const size = COVER_SIZES[image];
  if (!post || !size) return new Response("Not found", { status: 404 });
  return new ImageResponse(<CoverArt motif={post.cover.motif} kicker={post.cover.kicker} stat={post.cover.stat} statLabel={post.cover.statLabel} width={size.width} height={size.height} />, {
    width: size.width,
    height: size.height,
    fonts: [
      { name: "Inter", data: fontFile(400), weight: 400, style: "normal" },
      { name: "Inter", data: fontFile(600), weight: 600, style: "normal" },
      { name: "Inter", data: fontFile(700), weight: 700, style: "normal" },
    ],
  });
}
