import { auth } from "@/auth";
import { isAuthEnabled } from "@/lib/auth-status";
import { planForEmail } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/account — whether sign-in is available, who is signed in and their plan (used by the header and ad slots). */
export async function GET() {
  const headers = { "cache-control": "private, no-store" };
  if (!isAuthEnabled()) return Response.json({ enabled: false, user: null, plan: "free" }, { headers });
  const session = await auth().catch(() => null);
  const user = session?.user ? { name: session.user.name ?? null, email: session.user.email ?? null, image: session.user.image ?? null } : null;
  return Response.json({ enabled: true, user, plan: planForEmail(user?.email) }, { headers });
}
