/**
 * Sign-in is optional. It switches on only when the site owner has configured
 * AUTH_SECRET plus at least one provider's keys; until then every tool keeps working
 * without accounts and the login page says sign-in is coming soon.
 */
export type AuthProviderId = "google" | "github";

export const PROVIDER_LABELS: Record<AuthProviderId, string> = { google: "Google", github: "GitHub" };

export function enabledProviders(): AuthProviderId[] {
  const list: AuthProviderId[] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) list.push("google");
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) list.push("github");
  return list;
}

export function isAuthEnabled(): boolean {
  return !!process.env.AUTH_SECRET && enabledProviders().length > 0;
}

/** Only allow redirects back to our own pages. */
export function safeCallbackUrl(raw: string | string[] | undefined, fallback = "/account"): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
