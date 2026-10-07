/**
 * Turn what a person typed ("example.com", "https://example.com/page") into a URL that
 * can be opened in a new tab, or null when it isn't a website address.
 */
export function siteUrlFor(input: string): string | null {
  const v = input.trim();
  if (!v || /\s/.test(v)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (!/\.[a-z][a-z0-9-]*$/i.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Short label for a domain or URL: no scheme, no trailing slash. */
export function displayQuery(query: string): string {
  return query.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
