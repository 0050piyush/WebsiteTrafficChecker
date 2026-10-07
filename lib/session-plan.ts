import { auth } from "@/auth";
import { isAuthEnabled } from "./auth-status";
import { planForEmail } from "./plan";
import type { PlanId } from "./plans";

/** The plan of whoever sent this request: Free unless they're signed in to a paid account. */
export async function currentPlan(): Promise<PlanId> {
  if (!isAuthEnabled()) return "free";
  const session = await auth().catch(() => null);
  return planForEmail(session?.user?.email);
}
