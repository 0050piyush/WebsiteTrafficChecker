/** Contact topics and message shape, shared by the form (browser) and the API (server). */
export const CONTACT_TOPICS = [
  { id: "general", label: "General question" },
  { id: "waitlist", label: "Join the paid plans waitlist" },
  { id: "bug", label: "Report a bug or wrong data" },
  { id: "feature", label: "Suggest a feature" },
  { id: "partnership", label: "Partnership or press" },
  { id: "privacy", label: "Privacy or data request" },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["id"];
export type WaitlistPlan = "pro" | "agency";

export interface ContactMessage {
  name: string;
  email: string;
  topic: ContactTopic;
  plan: WaitlistPlan | null;
  message: string;
}
