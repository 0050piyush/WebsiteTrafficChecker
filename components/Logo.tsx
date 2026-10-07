export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <circle cx="14" cy="14" r="7" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path d="M19.2 19.2 25 25" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M10.5 16.5 13 13.5l2 2 2.5-3.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
