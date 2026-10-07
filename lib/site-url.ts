/**
 * The site's public base URL, without a trailing slash: SITE_URL when set, else the
 * production domain Vercel provides at build time, else localhost for development.
 */
export function siteUrl(): string {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

/** Whether siteUrl() is a real public address (not the localhost fallback). */
export function hasPublicSiteUrl(): boolean {
  return !!(process.env.SITE_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim());
}
