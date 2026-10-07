import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { isAuthEnabled } from "@/lib/auth-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function disabled() {
  return Response.json({ error: { code: "AUTH_DISABLED", message: "Sign-in isn't set up on this site yet." } }, { status: 404 });
}

export async function GET(request: NextRequest) {
  return isAuthEnabled() ? handlers.GET(request) : disabled();
}

export async function POST(request: NextRequest) {
  return isAuthEnabled() ? handlers.POST(request) : disabled();
}
