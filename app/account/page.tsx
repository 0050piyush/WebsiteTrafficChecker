import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";
import { isAuthEnabled, PROVIDER_LABELS, type AuthProviderId } from "@/lib/auth-status";
import { PLANS } from "@/lib/plans";
import { planForEmail, showsAds } from "@/lib/plan";
import { Badge, Card, CardHeader, KeyValue } from "@/components/ui";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!isAuthEnabled()) redirect("/login");
  const session = await auth().catch(() => null);
  if (!session?.user) redirect("/login?callbackUrl=/account");
  const user = session.user as typeof session.user & { provider?: AuthProviderId };
  const initial = (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase();
  const planId = planForEmail(user.email);
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[0];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" width={56} height={56} className="h-14 w-14 rounded-full border border-line" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-xl font-semibold text-accent-ink">{initial}</div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{user.name ?? "Your account"}</h1>
          <p className="truncate text-sm text-ink-3">{user.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader title="Plan" action={<Badge tone="good">Active</Badge>} />
        <div className="space-y-4 p-5">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-ink">
              {plan.name}
              <Badge tone={showsAds(planId) ? "neutral" : "good"}>{showsAds(planId) ? "Includes ads" : "Ad-free"}</Badge>
            </div>
            <p className="text-sm text-ink-2">{plan.description}</p>
          </div>
          {showsAds(planId) && (
            <div className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent-ink">
              Pro and Agency plans are coming soon: no ads, no audit page limit, monitoring and higher API limits.{" "}
              <Link href="/contact?topic=waitlist&plan=pro" className="font-medium underline-offset-2 hover:underline">
                Join the waitlist
              </Link>
            </div>
          )}
          <Link href="/pricing" className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
            Compare plans <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="Profile" />
        <div className="p-5">
          <KeyValue
            rows={[
              ["Name", user.name ?? "—"],
              ["Email", user.email ?? "—"],
              ["Signed in with", user.provider ? PROVIDER_LABELS[user.provider] ?? user.provider : "—"],
            ]}
          />
          <p className="mt-4 text-xs text-ink-3">
            Your profile comes from your sign-in provider and lives only in an encrypted session cookie; we don&apos;t keep a database of accounts. To have anything removed, sign out or{" "}
            <Link href="/contact" className="text-accent-ink hover:underline">
              contact us
            </Link>
            .
          </p>
        </div>
      </Card>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2">
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </button>
      </form>
    </div>
  );
}
