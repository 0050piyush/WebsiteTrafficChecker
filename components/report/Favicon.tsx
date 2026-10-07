"use client";

import { useState, type ReactNode } from "react";

/** Site favicon loaded straight from the site, with a fallback when it fails. */
export function Favicon({ src, size, fallback }: { src: string | null | undefined; size: number; fallback: ReactNode }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} style={{ width: size, height: size }} referrerPolicy="no-referrer" onError={() => setFailed(src)} />
  );
}
