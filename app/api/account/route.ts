import { auth } from "@/auth";
import { isAuthEnabled } from "@/lib/auth-status";
import { auditPageLimit } from "@/lib/limits";
import { planForEmail } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/account — whether sign-in is available, who is signed in, their plan and its
 * site audit page limit (null = no limit). Used by the header, ad slots and the audit form.
 */
export async function GET() {
  const headers = { "cache-control": "private, no-store" };
  if (!isAuthEnabled()) return Response.json({ enabled: false, user: null, plan: "free", auditPages: auditPageLimit("free") }, { headers });
  const session = await auth().catch(() => null);
  const user = session?.user ? { name: session.user.name ?? null, email: session.user.email ?? null, image: session.user.image ?? null } : null;
  const plan = planForEmail(user?.email);
  return Response.json({ enabled: true, user, plan, auditPages: auditPageLimit(plan) }, { headers });
}
