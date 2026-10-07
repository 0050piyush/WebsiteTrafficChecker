import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { auth, signIn } from "@/auth";
import { enabledProviders, isAuthEnabled, PROVIDER_LABELS, safeCallbackUrl, type AuthProviderId } from "@/lib/auth-status";
import { GitHubIcon, GoogleIcon } from "@/components/BrandIcons";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to TrafficLens with Google or GitHub.",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "That email is already linked to a different sign-in method. Use the one you signed up with.",
  AccessDenied: "Sign-in was cancelled or access was denied.",
  Configuration: "Sign-in is temporarily unavailable. Please try again later.",
};

function ProviderButton({ id, callbackUrl }: { id: AuthProviderId; callbackUrl: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn(id, { redirectTo: callbackUrl });
      }}
    >
      <button
        type="submit"
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-surface text-sm font-medium text-ink transition-colors hover:bg-surface-2"
      >
        {id === "google" ? <GoogleIcon className="h-5 w-5" /> : <GitHubIcon className="h-5 w-5" />}
        Continue with {PROVIDER_LABELS[id]}
      </button>
    </form>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  const enabled = isAuthEnabled();
  if (enabled) {
    const session = await auth().catch(() => null);
    if (session?.user) redirect(callbackUrl);
  }
  const providers = enabledProviders();
  const errorCode = typeof params.error === "string" ? params.error : null;
  const error = errorCode ? (ERRORS[errorCode] ?? "Sign-in didn't work. Please try again.") : null;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-6 sm:py-12">
      <Logo size={44} />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">Log in to TrafficLens</h1>
      <p className="mt-2 text-center text-[15px] text-ink-2">Save your work across devices and get first access to paid plans.</p>

      <div className="card mt-8 w-full p-6">
        {error && (
          <p className="mb-4 rounded-lg bg-bad-soft px-3 py-2.5 text-sm text-bad-ink" role="alert">
            {error}
          </p>
        )}
        {enabled ? (
          <div className="space-y-3">
            {providers.map((id) => (
              <ProviderButton key={id} id={id} callbackUrl={callbackUrl} />
            ))}
            <p className="pt-2 text-center text-xs text-ink-3">
              We only receive your name, email address and profile picture. No password is stored. See our{" "}
              <Link href="/privacy" className="text-accent-ink hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
              <Clock className="h-5 w-5 text-accent-ink" aria-hidden />
            </div>
            <h2 className="mt-3 font-semibold text-ink">Accounts are coming soon</h2>
            <p className="mt-1 text-sm text-ink-2">Sign-in with Google and GitHub isn&apos;t switched on yet. Every tool already works without an account.</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link href="/traffic" className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">
                Use the free tools
              </Link>
              <Link href="/contact?topic=waitlist" className="inline-flex h-10 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2">
                Join the waitlist
              </Link>
            </div>
          </div>
        )}
      </div>

      <ul className="mt-8 space-y-2 text-sm text-ink-2">
        {["All free tools work without an account", "No credit card, no spam", "Sign out any time from your account page"].map((t) => (
          <li key={t} className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-good-ink" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
