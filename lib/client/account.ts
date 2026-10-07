import { useEffect, useState } from "react";
import type { PlanId } from "@/lib/plans";

/** Who's signed in and their plan, as reported by /api/account. Shared by the header and ad slots. */
export interface AccountUser {
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface AccountInfo {
  enabled: boolean;
  user: AccountUser | null;
  plan: PlanId;
  /** Most pages one site audit may crawl on this plan; null = no limit. */
  auditPages: number | null;
}

const ANONYMOUS: AccountInfo = { enabled: false, user: null, plan: "free", auditPages: 200 };
let current: Promise<AccountInfo> | null = null;

/** Fetch once per page load and share the result; `refresh` asks the server again. */
export function fetchAccount(refresh = false): Promise<AccountInfo> {
  if (!current || refresh) {
    current = fetch("/api/account", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d: Partial<AccountInfo> | null): AccountInfo => ({
          enabled: !!d?.enabled,
          user: d?.user ?? null,
          plan: d?.plan === "pro" || d?.plan === "agency" ? d.plan : "free",
          auditPages: typeof d?.auditPages === "number" || d?.auditPages === null ? d.auditPages : ANONYMOUS.auditPages,
        }),
      )
      .catch(() => ANONYMOUS);
  }
  return current;
}

/**
 * The current account, or null while loading. Pass a changing `refreshKey` (such as the
 * pathname) to re-check on navigation; without one, the shared result is reused.
 */
export function useAccount(refreshKey?: string | null): AccountInfo | null {
  const [info, setInfo] = useState<AccountInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchAccount(refreshKey !== undefined).then((i) => {
      if (!cancelled) setInfo(i);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);
  return info;
}
