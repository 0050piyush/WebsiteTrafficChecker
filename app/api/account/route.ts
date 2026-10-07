import { auth } from "@/auth";
import { isAuthEnabled } from "@/lib/auth-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/account — whether sign-in is available and who is signed in (used by the header). */
export async function GET() {
  const headers = { "cache-control": "private, no-store" };
  if (!isAuthEnabled()) return Response.json({ enabled: false, user: null }, { headers });
  const session = await auth().catch(() => null);
  const user = session?.user ? { name: session.user.name ?? null, email: session.user.email ?? null, image: session.user.image ?? null } : null;
  return Response.json({ enabled: true, user }, { headers });
}
