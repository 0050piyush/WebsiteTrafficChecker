import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditTool } from "@/components/audit/AuditTool";

export const metadata: Metadata = {
  title: "Free SEO Site Audit",
  description: "Crawl any website live and find broken links, redirect chains, duplicate titles, thin content, orphan pages and 40+ other SEO issues. Free, no sign-up.",
};

export default function Page() {
  return (
    <Suspense>
      <AuditTool />
    </Suspense>
  );
}
