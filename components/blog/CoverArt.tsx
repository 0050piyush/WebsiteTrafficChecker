/**
 * Cover images for blog posts, rendered to PNG at build time with next/og (Satori).
 * We don't reuse other outlets' photos, so each post gets an original illustration of
 * its topic (its "motif"), with at most a short kicker and one key number as text:
 * Google Discover favors large, clear images without heavy text overlays.
 * Satori needs inline styles and display:flex on every element with several children.
 */

import type { Motif } from "@/lib/blog/cover";

const PALETTES: Record<Motif, { from: string; to: string; glow: string; accent: string; soft: string }> = {
  energy: { from: "#04211f", to: "#0b4a43", glow: "rgba(45, 212, 191, 0.35)", accent: "#5eead4", soft: "#99f6e4" },
  chip: { from: "#140b2e", to: "#33176b", glow: "rgba(167, 139, 250, 0.38)", accent: "#c4b5fd", soft: "#ddd6fe" },
  ads: { from: "#2a0c1c", to: "#6b1d3c", glow: "rgba(251, 146, 60, 0.35)", accent: "#fdba74", soft: "#fed7aa" },
  ai: { from: "#071a3a", to: "#1d3f8f", glow: "rgba(96, 165, 250, 0.4)", accent: "#93c5fd", soft: "#bfdbfe" },
  search: { from: "#0a1d36", to: "#14508a", glow: "rgba(56, 189, 248, 0.35)", accent: "#7dd3fc", soft: "#bae6fd" },
  security: { from: "#06231a", to: "#14533d", glow: "rgba(52, 211, 153, 0.35)", accent: "#6ee7b7", soft: "#a7f3d0" },
  chart: { from: "#0b2210", to: "#1f5a2b", glow: "rgba(134, 239, 172, 0.32)", accent: "#86efac", soft: "#bbf7d0" },
  phone: { from: "#1a1030", to: "#3b2a6b", glow: "rgba(244, 114, 182, 0.32)", accent: "#f9a8d4", soft: "#fbcfe8" },
  cloud: { from: "#0c1a2b", to: "#25466b", glow: "rgba(147, 197, 253, 0.35)", accent: "#bfdbfe", soft: "#dbeafe" },
};

type Pal = (typeof PALETTES)[Motif];

function MotifSvg({ motif, size, pal }: { motif: Motif; size: number; pal: Pal }) {
  const s = { width: size, height: size };
  const line = { stroke: pal.accent, strokeWidth: 6, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (motif) {
    case "energy":
      return (
        <svg viewBox="0 0 400 400" {...s}>
          <circle cx="300" cy="90" r="42" fill={pal.soft} opacity="0.9" />
          <circle cx="118" cy="92" r="30" fill="#ffffff" opacity="0.22" />
          <circle cx="150" cy="72" r="38" fill="#ffffff" opacity="0.18" />
          <circle cx="190" cy="96" r="28" fill="#ffffff" opacity="0.16" />
          <path d="M70 330 C 92 250, 92 200, 82 150 L 178 150 C 168 200, 168 250, 190 330 Z" fill={pal.accent} opacity="0.95" />
          <path d="M170 330 C 190 260, 190 215, 182 175 L 262 175 C 254 215, 254 260, 274 330 Z" fill={pal.soft} opacity="0.85" />
          <path d="M318 330 L 340 190 L 362 330 M 326 280 L 354 280 M 332 235 L 348 235 M 310 205 L 370 205" {...line} strokeWidth={5} />
          <path d="M 340 205 C 300 230, 260 240, 220 236" {...line} strokeWidth={3} opacity="0.7" />
          <rect x="40" y="328" width="340" height="10" rx="5" fill={pal.soft} opacity="0.6" />
        </svg>
      );
    case "chip":
      return (
        <svg viewBox="0 0 400 400" {...s}>
          {Array.from({ length: 6 }, (_, i) => 110 + i * 36).map((p) => (
            <g key={p}>
              <rect x={p - 5} y="40" width="10" height="44" rx="5" fill={pal.soft} opacity="0.75" />
              <rect x={p - 5} y="316" width="10" height="44" rx="5" fill={pal.soft} opacity="0.75" />
              <rect x="40" y={p - 5} width="44" height="10" rx="5" fill={pal.soft} opacity="0.75" />
              <rect x="316" y={p - 5} width="44" height="10" rx="5" fill={pal.soft} opacity="0.75" />
            </g>
          ))}
          <rect x="84" y="84" width="232" height="232" rx="28" fill={pal.accent} />
          <rect x="112" y="112" width="176" height="176" rx="16" fill={pal.from} opacity="0.85" />
          {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={126 + c * 52} y={126 + r * 52} width="44" height="44" rx="8" fill={pal.accent} opacity={r === 1 && c === 1 ? 1 : 0.55} />))}
        </svg>
      );
    case "ads":
      return (
        <svg viewBox="0 0 400 400" {...s}>
          <rect x="30" y="60" width="250" height="250" rx="26" fill={pal.soft} opacity="0.95" />
          <circle cx="210" cy="130" r="28" fill={pal.accent} />
          <path d="M50 290 L 130 180 L 185 245 L 220 205 L 262 290 Z" fill={pal.to} opacity="0.85" />
          <rect x="230" y="200" width="150" height="150" rx="20" fill="#ffffff" />
          <rect x="250" y="220" width="56" height="26" rx="13" fill={pal.accent} />
          <rect x="250" y="262" width="110" height="12" rx="6" fill={pal.to} opacity="0.5" />
          <rect x="250" y="286" width="80" height="12" rx="6" fill={pal.to} opacity="0.35" />
          <rect x="250" y="314" width="64" height="18" rx="9" fill={pal.to} opacity="0.8" />
        </svg>
      );
    case "ai": {
      const nodes = [
        [70, 110], [70, 200], [70, 290], [200, 70], [200, 160], [200, 240], [200, 330], [330, 140], [330, 260],
      ];
      const edges = [[0, 3], [0, 4], [1, 4], [1, 5], [2, 5], [2, 6], [0, 5], [1, 3], [2, 4], [3, 7], [4, 7], [4, 8], [5, 8], [6, 8], [5, 7]];
      return (
        <svg viewBox="0 0 400 400" {...s}>
          {edges.map(([a, b]) => (
            <line key={`${a}-${b}`} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke={pal.soft} strokeWidth="3" opacity="0.55" />
          ))}
          {nodes.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i === 4 ? 26 : 18} fill={i === 4 ? pal.soft : pal.accent} />
          ))}
        </svg>
      );
    }
    case "search":
      return (
        <svg viewBox="0 0 400 400" {...s}>
          <rect x="40" y="70" width="230" height="22" rx="11" fill={pal.soft} opacity="0.85" />
          <rect x="40" y="120" width="300" height="16" rx="8" fill={pal.soft} opacity="0.45" />
          <rect x="40" y="150" width="260" height="16" rx="8" fill={pal.soft} opacity="0.35" />
          <rect x="40" y="200" width="200" height="22" rx="11" fill={pal.soft} opacity="0.7" />
          <rect x="40" y="250" width="280" height="16" rx="8" fill={pal.soft} opacity="0.3" />
          <circle cx="260" cy="230" r="72" fill="none" stroke={pal.accent} strokeWidth="22" />
          <path d="M312 282 L 365 335" stroke={pal.accent} strokeWidth="30" strokeLinecap="round" />
        </svg>
      );
    case "security":
      return (
        <svg viewBox="0 0 400 400" {...s}>
          <path d="M200 40 L 330 90 L 330 200 C 330 280, 270 330, 200 360 C 130 330, 70 280, 70 200 L 70 90 Z" fill={pal.accent} />
          <path d="M200 76 L 300 114 L 300 200 C 300 262, 256 300, 200 326 C 144 300, 100 262, 100 200 L 100 114 Z" fill={pal.from} opacity="0.55" />
          <path d="M150 205 L 188 243 L 258 168" stroke={pal.soft} strokeWidth="24" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 400 400" {...s}>
          {[90, 150, 125, 210, 260].map((h, i) => (
            <rect key={i} x={50 + i * 64} y={340 - h} width="44" height={h} rx="10" fill={pal.accent} opacity={0.45 + i * 0.13} />
          ))}
          <path d="M60 250 L 140 190 L 205 215 L 280 130 L 350 70" {...line} stroke={pal.soft} strokeWidth={9} />
          <path d="M318 66 L 352 68 L 350 102" {...line} stroke={pal.soft} strokeWidth={9} />
          <rect x="40" y="346" width="320" height="8" rx="4" fill={pal.soft} opacity="0.5" />
        </svg>
      );
    case "phone":
      return (
        <svg viewBox="0 0 400 400" {...s}>
          <rect x="115" y="30" width="170" height="340" rx="34" fill={pal.accent} />
          <rect x="130" y="60" width="140" height="280" rx="18" fill={pal.from} opacity="0.8" />
          {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={146 + c * 42} y={82 + r * 46} width="30" height="30" rx="9" fill={pal.soft} opacity={0.4 + ((r + c) % 3) * 0.2} />))}
          <rect x="146" y="240" width="108" height="70" rx="14" fill={pal.soft} opacity="0.85" />
          <rect x="175" y="44" width="50" height="8" rx="4" fill={pal.from} opacity="0.6" />
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 400 400" {...s}>
          <path d="M110 190 C 70 190, 60 130, 105 120 C 110 70, 180 55, 205 100 C 230 70, 300 85, 295 135 C 345 140, 345 190, 300 190 Z" fill={pal.soft} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="120" y={225 + i * 46} width="160" height="36" rx="10" fill={pal.accent} opacity={1 - i * 0.18} />
              <circle cx="142" cy={243 + i * 46} r="6" fill={pal.from} />
              <rect x="160" y={239 + i * 46} width="70" height="8" rx="4" fill={pal.from} opacity="0.6" />
            </g>
          ))}
        </svg>
      );
  }
}

export interface CoverProps {
  motif: Motif;
  kicker: string;
  stat?: string | null;
  statLabel?: string | null;
  width: number;
  height: number;
}

export function CoverArt({ motif, kicker, stat, statLabel, width, height }: CoverProps) {
  const pal = PALETTES[motif];
  const wide = width / height > 1.5;
  const art = wide ? Math.round(height * 0.86) : Math.round(Math.min(width * 0.62, height * 0.58));
  const pad = wide ? 72 : 80;

  const kickerEl = (
    <div style={{ display: "flex", alignSelf: "flex-start", alignItems: "center", gap: 12, padding: "10px 22px", borderRadius: 999, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", color: "#ffffff", fontSize: 28, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>
      <div style={{ width: 12, height: 12, borderRadius: 6, background: pal.accent }} />
      {kicker}
    </div>
  );
  const statEl = stat ? (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: wide ? 148 : 168, fontWeight: 700, color: "#ffffff", lineHeight: 1, letterSpacing: -4 }}>{stat}</div>
      {statLabel && <div style={{ marginTop: 18, fontSize: wide ? 38 : 44, color: pal.soft, lineHeight: 1.2, maxWidth: wide ? 560 : 900 }}>{statLabel}</div>}
    </div>
  ) : null;
  const brand = (
    <div style={{ display: "flex", alignItems: "center", gap: 14, color: "rgba(255,255,255,0.8)", fontSize: 28, fontWeight: 600 }}>
      <div style={{ display: "flex", width: 40, height: 40, borderRadius: 10, background: "#ffffff", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 16, height: 16, borderRadius: 8, border: `4px solid ${pal.to}` }} />
      </div>
      TrafficLens
    </div>
  );

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        position: "relative",
        fontFamily: "Inter",
        backgroundImage: `radial-gradient(circle at 78% 18%, ${pal.glow} 0%, rgba(0,0,0,0) 45%), linear-gradient(135deg, ${pal.from} 0%, ${pal.to} 100%)`,
        overflow: "hidden",
      }}
    >
      {wide ? (
        <div style={{ display: "flex", width: "100%", height: "100%", padding: pad, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", maxWidth: 600 }}>
            {kickerEl}
            {statEl ?? <div />}
            {brand}
          </div>
          <div style={{ display: "flex", marginRight: -20 }}>
            <MotifSvg motif={motif} size={art} pal={pal} />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: pad, justifyContent: "space-between" }}>
          {kickerEl}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <MotifSvg motif={motif} size={art} pal={pal} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            {statEl ?? <div />}
            {brand}
          </div>
        </div>
      )}
    </div>
  );
}
