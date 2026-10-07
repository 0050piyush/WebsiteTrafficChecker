"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface LineSeries {
  id: string;
  label: string;
  /** CSS color, e.g. "var(--series-1)". */
  color: string;
  points: { x: string; y: number | null }[];
}

interface Props {
  series: LineSeries[];
  height?: number;
  /** Smaller values drawn higher (for ranks). */
  invertY?: boolean;
  logY?: boolean;
  /** Fill a light wash under a single series. */
  area?: boolean;
  yFormat: (n: number) => string;
  xFormat: (x: string) => string;
  ariaLabel: string;
}

const M = { top: 12, right: 16, bottom: 26, left: 58 };

function niceLinearTicks(min: number, max: number, count = 4) {
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { lo, hi, ticks };
}

function logTicks(min: number, max: number) {
  const lo = Math.floor(Math.log10(Math.max(1, min)));
  const hi = Math.max(lo + 1, Math.ceil(Math.log10(Math.max(1, max))));
  const ticks: number[] = [];
  const decades = hi - lo;
  for (let e = lo; e <= hi; e++) {
    ticks.push(10 ** e);
    if (decades <= 2 && e < hi) ticks.push(2 * 10 ** e, 5 * 10 ** e);
  }
  return { lo: 10 ** lo, hi: 10 ** hi, ticks: ticks.sort((a, b) => a - b) };
}

export function LineChart({ series, height = 240, invertY, logY, area, yFormat, xFormat, ariaLabel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const xs = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort(), [series]);
  const lookup = useMemo(() => series.map((s) => new Map(s.points.map((p) => [p.x, p.y]))), [series]);
  const values = series.flatMap((s) => s.points.map((p) => p.y).filter((v): v is number => v !== null && Number.isFinite(v)));
  const vMin = values.length ? Math.min(...values) : 0;
  const vMax = values.length ? Math.max(...values) : 1;
  const scale = logY ? logTicks(vMin, vMax) : niceLinearTicks(invertY ? Math.max(0, vMin) : Math.min(0, vMin), vMax);

  const innerW = width - M.left - M.right;
  const innerH = height - M.top - M.bottom;
  const xAt = (i: number) => M.left + (xs.length <= 1 ? innerW / 2 : (i / (xs.length - 1)) * innerW);
  const t = (v: number) => (logY ? (Math.log10(v) - Math.log10(scale.lo)) / (Math.log10(scale.hi) - Math.log10(scale.lo)) : (v - scale.lo) / (scale.hi - scale.lo || 1));
  const yAt = (v: number) => M.top + (invertY ? t(v) : 1 - t(v)) * innerH;

  const paths = series.map((s, si) => {
    let d = "";
    let pen = false;
    xs.forEach((x, i) => {
      const v = lookup[si].get(x);
      if (v === null || v === undefined || (logY && v <= 0)) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  });

  const xTickIdx = useMemo(() => {
    if (xs.length <= 1) return xs.map((_, i) => i);
    const n = Math.min(xs.length, Math.max(2, Math.floor(innerW / 110)));
    return [...new Set(Array.from({ length: n }, (_, k) => Math.round((k * (xs.length - 1)) / (n - 1))))];
  }, [xs, innerW]);

  const onMove = useCallback(
    (clientX: number) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect || !xs.length) return;
      const rel = clientX - rect.left - M.left;
      const i = xs.length <= 1 ? 0 : Math.round((rel / innerW) * (xs.length - 1));
      setHover(Math.max(0, Math.min(xs.length - 1, i)));
    },
    [xs.length, innerW],
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (!xs.length) return;
    if (e.key === "ArrowRight") setHover((h) => Math.min(xs.length - 1, (h ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? xs.length) - 1));
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  };

  if (!xs.length) return <div className="flex h-40 items-center justify-center text-sm text-ink-3">No data to chart</div>;

  const hx = hover !== null ? xAt(hover) : 0;
  const tooltipLeft = hover !== null ? Math.min(Math.max(hx + 12, 8), width - 200) : 0;
  const flip = hover !== null && hx + 12 + 190 > width;

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        className="block touch-none outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-md"
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => onMove(e.clientX)}
      >
        {scale.ticks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={yAt(v)} y2={yAt(v)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={M.left - 8} y={yAt(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--chart-label)" className="tabular">
              {yFormat(v)}
            </text>
          </g>
        ))}
        <line x1={M.left} x2={width - M.right} y1={height - M.bottom} y2={height - M.bottom} stroke="var(--chart-axis)" strokeWidth={1} />
        {xTickIdx.map((i) => (
          <text key={i} x={xAt(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === xs.length - 1 ? "end" : "middle"} fontSize={11} fill="var(--chart-label)">
            {xFormat(xs[i])}
          </text>
        ))}
        {area && series.length === 1 && paths[0] && !invertY && (
          <path d={`${paths[0]}L${xAt(xs.length - 1)},${height - M.bottom}L${xAt(0)},${height - M.bottom}Z`} fill={series[0].color} opacity={0.1} />
        )}
        {series.map((s, si) => (
          <path key={s.id} d={paths[si]} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {/* End markers with a surface ring */}
        {series.map((s, si) => {
          for (let i = xs.length - 1; i >= 0; i--) {
            const v = lookup[si].get(xs[i]);
            if (v !== null && v !== undefined) return <circle key={s.id} cx={xAt(i)} cy={yAt(v)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />;
          }
          return null;
        })}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={M.top} y2={height - M.bottom} stroke="var(--chart-axis)" strokeWidth={1} />
            {series.map((s, si) => {
              const v = lookup[si].get(xs[hover]);
              return v !== null && v !== undefined ? <circle key={s.id} cx={hx} cy={yAt(v)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> : null;
            })}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={flip ? { left: Math.max(8, hx - 12 - 190) } : { left: tooltipLeft }}
          role="status"
        >
          <div className="mb-1 font-medium text-ink-2">{xFormat(xs[hover])}</div>
          {series.map((s, si) => {
            const v = lookup[si].get(xs[hover]);
            return (
              <div key={s.id} className="flex items-center gap-2 py-0.5">
                <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} aria-hidden />
                <span className="tabular font-semibold text-ink">{v === null || v === undefined ? "—" : yFormat(v)}</span>
                <span className="truncate text-ink-3">{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
