/** Cover image settings shared by the post loader and the image renderer. */

export const MOTIFS = ["energy", "chip", "ads", "ai", "search", "security", "chart", "phone", "cloud"] as const;
export type Motif = (typeof MOTIFS)[number];

/** Published at /blog/<slug>/<file>. 16:9 is the main cover; 4:3 and 1:1 are for structured data. */
export const COVER_SIZES: Record<string, { width: number; height: number }> = {
  "cover.png": { width: 1200, height: 675 },
  "cover-4x3.png": { width: 1200, height: 900 },
  "cover-1x1.png": { width: 1200, height: 1200 },
};
