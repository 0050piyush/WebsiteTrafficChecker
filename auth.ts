import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { enabledProviders } from "@/lib/auth-status";

/**
 * Auth.js with Google and GitHub sign-in. Sessions are encrypted JWT cookies, so no
 * database is needed. Keys come from AUTH_SECRET, AUTH_GOOGLE_ID/SECRET and
 * AUTH_GITHUB_ID/SECRET (read lazily, per request).
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  providers: enabledProviders().map((id) => (id === "google" ? Google : GitHub)),
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  callbacks: {
    jwt({ token, account }) {
      if (account) token.provider = account.provider;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.provider === "string") (session.user as typeof session.user & { provider?: string }).provider = token.provider;
      return session;
    },
  },
}));
