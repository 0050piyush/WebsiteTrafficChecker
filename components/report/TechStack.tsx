import type { DetectedTech } from "@/lib/seo/tech";
import { Badge } from "../ui";

export function TechStack({ technologies }: { technologies: DetectedTech[] }) {
  if (!technologies.length) return <p className="text-sm text-ink-3">No known technologies detected from headers and HTML.</p>;
  const groups = new Map<string, DetectedTech[]>();
  for (const t of technologies) groups.set(t.category, [...(groups.get(t.category) ?? []), t]);
  return (
    <dl className="space-y-3">
      {[...groups.entries()].map(([category, list]) => (
        <div key={category} className="grid grid-cols-[8.5rem_1fr] gap-3">
          <dt className="pt-0.5 text-xs font-medium text-ink-3">{category}</dt>
          <dd className="flex flex-wrap gap-1.5">
            {list.map((t) => (
              <Badge key={t.name} title={`Detected via: ${t.evidence}`}>
                {t.name}
                {t.version && <span className="text-ink-3">{t.version}</span>}
              </Badge>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}
