"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, FileSearch, Search, Sparkles, Stethoscope } from "lucide-react";
import { cx } from "./ui";

const TOOLS = [
  { id: "traffic", label: "Traffic", icon: BarChart3, placeholder: "Enter a domain, e.g. wikipedia.org", param: "domain", path: "/traffic" },
  { id: "audit", label: "Site audit", icon: Stethoscope, placeholder: "Enter a website URL to crawl", param: "url", path: "/audit" },
  { id: "analyzer", label: "Page SEO", icon: FileSearch, placeholder: "Enter a page URL to analyze", param: "url", path: "/analyzer" },
  { id: "keywords", label: "Keywords", icon: Sparkles, placeholder: "Enter a seed keyword, e.g. coffee grinder", param: "q", path: "/keywords" },
] as const;

export function HeroSearch() {
  const router = useRouter();
  const [tool, setTool] = useState<(typeof TOOLS)[number]["id"]>("traffic");
  const [value, setValue] = useState("");
  const active = TOOLS.find((t) => t.id === tool)!;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    router.push(`${active.path}?${active.param}=${encodeURIComponent(v)}`);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-3 flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Choose a tool">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tool === t.id}
            onClick={() => setTool(t.id)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
              tool === t.id ? "border-transparent bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:text-ink",
            )}
          >
            <t.icon className="h-4 w-4" aria-hidden />
            {t.label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="card flex items-center gap-2 p-2 shadow-sm">
        <Search className="ml-2 h-5 w-5 shrink-0 text-ink-3" aria-hidden />
        <label htmlFor="hero-input" className="sr-only">
          {active.placeholder}
        </label>
        <input
          id="hero-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={active.placeholder}
          autoComplete="off"
          spellCheck={false}
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        />
        <button type="submit" className="h-11 shrink-0 rounded-lg bg-accent px-5 text-sm font-medium text-on-accent hover:bg-accent-hover">
          Analyze
        </button>
      </form>
      <p className="mt-3 text-center text-xs text-ink-3">
        Try{" "}
        {["wikipedia.org", "github.com", "bbc.co.uk"].map((d, i) => (
          <span key={d}>
            {i > 0 && ", "}
            <button type="button" className="text-accent-ink underline-offset-2 hover:underline" onClick={() => router.push(`/traffic?domain=${d}`)}>
              {d}
            </button>
          </span>
        ))}
      </p>
    </div>
  );
}
