import { jsonError, limit, json } from "@/lib/api";
import { isContactEnabled, sendContactEmail, validateContact } from "@/lib/contact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/contact  { name, email, topic, plan?, message } — emails the site owner via Resend. */
export async function POST(request: Request) {
  const limited = limit(request, "contact", 5, 60 * 60 * 1000);
  if (limited) return limited;
  if (!isContactEnabled()) return jsonError(503, "The contact form isn't set up yet.", "CONTACT_DISABLED");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Body must be JSON.", "INVALID_BODY");
  }
  const result = validateContact(body);
  if (!result.ok) return Response.json({ error: { code: "INVALID_FIELDS", message: "Please check the highlighted fields.", fields: result.errors } }, { status: 400 });
  // Pretend success for bots so they don't retry.
  if (result.spam) return json({ ok: true });

  try {
    await sendContactEmail(result.value);
  } catch {
    return jsonError(502, "Your message couldn't be sent right now. Please try again in a few minutes.", "SEND_FAILED");
  }
  return json({ ok: true });
}
