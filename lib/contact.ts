/**
 * Contact form: validation and delivery by email through Resend (https://resend.com).
 * Configured with RESEND_API_KEY and CONTACT_TO_EMAIL (and optionally
 * CONTACT_FROM_EMAIL); without them the form is shown as unavailable.
 */

import { CONTACT_TOPICS, type ContactMessage, type ContactTopic, type WaitlistPlan } from "./contact-topics";

export { CONTACT_TOPICS, type ContactMessage, type ContactTopic, type WaitlistPlan };

export type ContactValidation = { ok: true; value: ContactMessage; spam: boolean } | { ok: false; errors: Partial<Record<keyof ContactMessage, string>> };

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, " ").trim();

export function validateContact(body: unknown): ContactValidation {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : "");
  const name = oneLine(str("name"));
  const email = str("email").trim().toLowerCase();
  const topic = (CONTACT_TOPICS.some((t) => t.id === str("topic")) ? str("topic") : "general") as ContactTopic;
  const plan = topic === "waitlist" && (str("plan") === "pro" || str("plan") === "agency") ? (str("plan") as WaitlistPlan) : null;
  const message = str("message").trim();

  const errors: Partial<Record<keyof ContactMessage, string>> = {};
  if (!name) errors.name = "Please enter your name.";
  else if (name.length > 100) errors.name = "Please keep your name under 100 characters.";
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = "Please enter a valid email address.";
  // A waitlist sign-up doesn't need a message; everything else does.
  if (topic !== "waitlist" && message.length < 10) errors.message = "Please write at least a sentence (10+ characters).";
  if (message.length > 5000) errors.message = "Please keep your message under 5,000 characters.";
  if (Object.keys(errors).length) return { ok: false, errors };

  // Hidden "website" field: people never see it, bots fill it in.
  const spam = str("website").trim().length > 0;
  return { ok: true, value: { name, email, topic, plan, message }, spam };
}

export function isContactEnabled(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL);
}

export function contactEmail(msg: ContactMessage): { subject: string; text: string } {
  const topic = CONTACT_TOPICS.find((t) => t.id === msg.topic)?.label ?? msg.topic;
  const planLabel = msg.plan ? ` (${msg.plan === "pro" ? "Pro" : "Agency"})` : "";
  return {
    subject: `[TrafficLens] ${topic}${planLabel}: ${msg.name}`.slice(0, 200),
    text: [`From: ${msg.name} <${msg.email}>`, `Topic: ${topic}${planLabel}`, "", msg.message || "(no message)"].join("\n"),
  };
}

export async function sendContactEmail(msg: ContactMessage): Promise<void> {
  const { subject, text } = contactEmail(msg);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL || "TrafficLens <onboarding@resend.dev>",
      to: [process.env.CONTACT_TO_EMAIL],
      reply_to: msg.email,
      subject,
      text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Email service returned HTTP ${res.status}`);
}
