"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { CONTACT_TOPICS, type ContactMessage, type ContactTopic, type WaitlistPlan } from "@/lib/contact-topics";
import { cx } from "./ui";

type FieldErrors = Partial<Record<keyof ContactMessage, string>>;

const inputClass =
  "w-full rounded-lg border bg-bg px-3 text-[15px] text-ink outline-none placeholder:text-ink-3 focus:border-accent aria-[invalid=true]:border-bad";

export function ContactForm({ defaultTopic, defaultPlan }: { defaultTopic: ContactTopic; defaultPlan: WaitlistPlan | null }) {
  const [topic, setTopic] = useState<ContactTopic>(defaultTopic);
  const [plan, setPlan] = useState<WaitlistPlan>(defaultPlan ?? "pro");
  const [state, setState] = useState<{ status: "idle" | "sending" | "sent" | "error"; message?: string; fields?: FieldErrors; email?: string }>({ status: "idle" });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, topic, plan }) });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setState({ status: "error", message: body?.error?.message ?? `Something went wrong (HTTP ${res.status}).`, fields: body?.error?.fields });
        return;
      }
      setState({ status: "sent", email: String(data.email ?? "") });
    } catch {
      setState({ status: "error", message: "Couldn't reach the server. Check your connection and try again." });
    }
  };

  if (state.status === "sent") {
    return (
      <div className="py-6 text-center" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-good-ink" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold text-ink">{topic === "waitlist" ? "You're on the waitlist" : "Message sent"}</h2>
        <p className="mt-1 text-sm text-ink-2">
          {topic === "waitlist"
            ? `We'll email ${state.email} when the ${plan === "agency" ? "Agency" : "Pro"} plan launches.`
            : `Thanks for getting in touch. We'll reply to ${state.email}.`}
        </p>
        <button type="button" onClick={() => setState({ status: "idle" })} className="mt-4 text-sm text-accent-ink hover:underline">
          Send another message
        </button>
      </div>
    );
  }

  const err = state.fields ?? {};
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {state.status === "error" && state.message && (
        <p className="rounded-lg bg-bad-soft px-3 py-2.5 text-sm text-bad-ink" role="alert">
          {state.message}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Name
          <input name="name" autoComplete="name" required maxLength={100} aria-invalid={!!err.name} className={cx(inputClass, "mt-1.5 h-11", err.name ? "border-bad" : "border-line")} />
          {err.name && <span className="mt-1 block text-xs font-normal text-bad-ink">{err.name}</span>}
        </label>
        <label className="block text-sm font-medium text-ink">
          Email
          <input name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={!!err.email} className={cx(inputClass, "mt-1.5 h-11", err.email ? "border-bad" : "border-line")} />
          {err.email && <span className="mt-1 block text-xs font-normal text-bad-ink">{err.email}</span>}
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Topic
          <select value={topic} onChange={(e) => setTopic(e.target.value as ContactTopic)} className={cx(inputClass, "mt-1.5 h-11 border-line")}>
            {CONTACT_TOPICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {topic === "waitlist" && (
          <label className="block text-sm font-medium text-ink">
            Plan
            <select value={plan} onChange={(e) => setPlan(e.target.value as WaitlistPlan)} className={cx(inputClass, "mt-1.5 h-11 border-line")}>
              <option value="pro">Pro ($19/month)</option>
              <option value="agency">Agency ($49/month)</option>
            </select>
          </label>
        )}
      </div>
      <label className="block text-sm font-medium text-ink">
        Message {topic === "waitlist" && <span className="font-normal text-ink-3">(optional)</span>}
        <textarea
          name="message"
          rows={6}
          maxLength={5000}
          aria-invalid={!!err.message}
          placeholder={topic === "waitlist" ? "Anything you'd like the paid plans to include?" : "How can we help?"}
          className={cx(inputClass, "mt-1.5 resize-y py-2.5", err.message ? "border-bad" : "border-line")}
        />
        {err.message && <span className="mt-1 block text-xs font-normal text-bad-ink">{err.message}</span>}
      </label>
      {/* Honeypot: hidden from people, irresistible to spam bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-3">
          We use your email only to reply. See our{" "}
          <Link href="/privacy" className="text-accent-ink hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <button
          type="submit"
          disabled={state.status === "sending"}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
        >
          {state.status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          {topic === "waitlist" ? "Join the waitlist" : "Send message"}
        </button>
      </div>
    </form>
  );
}
