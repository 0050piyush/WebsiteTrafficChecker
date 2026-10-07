import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, XCircle, CircleSlash, HelpCircle, RotateCw } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx("card", className)}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, source, action, icon }: { title: ReactNode; subtitle?: ReactNode; source?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {source && <span className="text-xs text-ink-3">Source: {source}</span>}
        {action}
      </div>
    </div>
  );
}

type Tone = "neutral" | "accent" | "good" | "warn" | "bad";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  accent: "bg-accent-soft text-accent-ink border-transparent",
  good: "bg-good-soft text-good-ink border-transparent",
  warn: "bg-warn-soft text-warn-ink border-transparent",
  bad: "bg-bad-soft text-bad-ink border-transparent",
};

export function Badge({ children, tone = "neutral", className, title }: { children: ReactNode; tone?: Tone; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", toneClasses[tone], className)}>
      {children}
    </span>
  );
}

export type StatusKind = "pass" | "warn" | "fail" | "info" | "error" | "warning" | "notice" | "unknown";

const statusMeta: Record<StatusKind, { label: string; tone: Tone; Icon: typeof CheckCircle2 }> = {
  pass: { label: "Passed", tone: "good", Icon: CheckCircle2 },
  warn: { label: "Warning", tone: "warn", Icon: AlertTriangle },
  fail: { label: "Failed", tone: "bad", Icon: XCircle },
  info: { label: "Info", tone: "neutral", Icon: Info },
  error: { label: "Error", tone: "bad", Icon: XCircle },
  warning: { label: "Warning", tone: "warn", Icon: AlertTriangle },
  notice: { label: "Notice", tone: "accent", Icon: Info },
  unknown: { label: "Unknown", tone: "neutral", Icon: HelpCircle },
};

/** Status is always icon + label, never color alone. */
export function StatusPill({ status, label, compact }: { status: StatusKind; label?: string; compact?: boolean }) {
  const m = statusMeta[status];
  return (
    <Badge tone={m.tone}>
      <m.Icon aria-hidden className="h-3.5 w-3.5" />
      {compact ? <span className="sr-only">{label ?? m.label}</span> : (label ?? m.label)}
    </Badge>
  );
}

export function StatusIcon({ status, className }: { status: StatusKind; className?: string }) {
  const m = statusMeta[status];
  const color = { good: "text-good-ink", warn: "text-warn-ink", bad: "text-bad-ink", accent: "text-accent-ink", neutral: "text-ink-3" }[m.tone];
  return <m.Icon aria-label={m.label} className={cx("h-4 w-4 shrink-0", color, className)} />;
}

export function HttpStatus({ status }: { status: number }) {
  if (status === -1) return <Badge tone="neutral"><CircleSlash aria-hidden className="h-3 w-3" />Blocked</Badge>;
  if (status === 0) return <Badge tone="bad"><XCircle aria-hidden className="h-3 w-3" />Failed</Badge>;
  const tone: Tone = status < 300 ? "good" : status < 400 ? "accent" : status < 500 ? "warn" : "bad";
  return <Badge tone={tone} className="tabular">{status}</Badge>;
}

/** Stat tile: label, value, optional delta and footnote. */
export function Stat({ label, value, sub, hint, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={cx("card p-4", className)} title={hint}>
      <div className="text-xs font-medium text-ink-3">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-ink wrap-anywhere">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-3 wrap-anywhere">{sub}</div>}
    </div>
  );
}

export function Delta({ value, goodWhen = "up", suffix = "" }: { value: number | null | undefined; goodWhen?: "up" | "down"; suffix?: string }) {
  if (value === null || value === undefined || value === 0) return <span className="text-ink-3">no change</span>;
  const up = value > 0;
  const good = goodWhen === "up" ? up : !up;
  return (
    <span className={good ? "text-good-ink" : "text-bad-ink"}>
      {up ? "▲" : "▼"} {Math.abs(value).toLocaleString("en-US")}
      {suffix}
    </span>
  );
}

export function ScoreGauge({ score, size = 112, label = "Score" }: { score: number; size?: number; label?: string }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const tone = score >= 80 ? "var(--good)" : score >= 50 ? "var(--warn)" : "var(--bad)";
  const word = score >= 80 ? "Good" : score >= 50 ? "Needs work" : "Poor";
  return (
    <div className="relative inline-flex flex-col items-center" role="img" aria-label={`${label}: ${score} out of 100 (${word})`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold text-ink">{score}</span>
        <span className="text-[11px] text-ink-3">{word}</span>
      </div>
    </div>
  );
}

/** Horizontal meter for a 0–100 value. */
export function Meter({ value, label }: { value: number; label?: string }) {
  return (
    <div className="flex items-center gap-2" title={label}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-accent-soft">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
      <span className="tabular w-7 text-right text-xs text-ink-2">{value}</span>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  const styles = {
    primary: "bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-60",
    secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2 disabled:opacity-60",
    ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  }[variant];
  return (
    <button {...props} className={cx("inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed", styles, className)}>
      {children}
    </button>
  );
}

export function ErrorNote({ title = "Couldn't load this", message, className, onRetry }: { title?: string; message: string; className?: string; onRetry?: () => void }) {
  return (
    <div className={cx("flex gap-2 rounded-lg border border-transparent bg-bad-soft px-3 py-2.5 text-sm text-bad-ink", className)} role="alert">
      <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        <div className="opacity-90 wrap-anywhere">{message}</div>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex h-8 shrink-0 items-center gap-1.5 self-center rounded-md border border-current/30 px-3 text-xs font-medium hover:bg-bad/10">
          <RotateCw aria-hidden className="h-3.5 w-3.5" />
          Try again
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

export function KeyValue({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2">
          <dt className="shrink-0 text-ink-3">{k}</dt>
          <dd className="min-w-0 text-right text-ink wrap-anywhere">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PageHeader({ title, description, icon }: { title: string; description: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        {icon}
        {title}
      </h1>
      <p className="mt-2 max-w-3xl text-[15px] text-ink-2">{description}</p>
    </div>
  );
}

export function MethodLink({ anchor, children = "How is this calculated?" }: { anchor: string; children?: ReactNode }) {
  return (
    <Link href={`/methodology#${anchor}`} className="text-xs text-accent-ink underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {children && <div className="mt-1 max-w-md text-sm text-ink-3">{children}</div>}
    </div>
  );
}
