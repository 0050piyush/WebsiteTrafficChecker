"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, ADSENSE_SLOT, adsConfigured } from "@/lib/ads";
import { useAccount } from "@/lib/client/account";
import { cx } from "./ui";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function loadAdSense() {
  if (document.querySelector("script[data-adsense]")) return;
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  s.dataset.adsense = "1";
  document.head.appendChild(s);
}

/**
 * One responsive Google AdSense unit, shown only to visitors on the Free plan. Paid plans
 * are ad-free; nothing renders (and no ad code loads) until we know the visitor's plan,
 * or at all when AdSense isn't configured.
 */
export function AdSlot({ className }: { className?: string }) {
  const account = useAccount();
  const show = adsConfigured() && account !== null && account.plan === "free";
  const filled = useRef(false);

  useEffect(() => {
    if (!show || filled.current) return;
    filled.current = true;
    loadAdSense();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* blocked by an ad blocker */
    }
  }, [show]);

  if (!show) return null;
  return (
    <aside aria-label="Advertisement" className={cx("min-w-0", className)}>
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-ink-3">
        <span className="uppercase tracking-wide">Advertisement</span>
        <Link href="/pricing" className="text-accent-ink hover:underline">
          Remove ads
        </Link>
      </div>
      <ins
        className="adsbygoogle block min-h-[100px] w-full overflow-hidden rounded-lg"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
