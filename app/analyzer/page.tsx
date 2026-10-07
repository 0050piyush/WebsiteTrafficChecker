import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalyzerTool } from "@/components/analyzer/AnalyzerTool";

export const metadata: Metadata = {
  title: "On-Page SEO Checker & Broken Link Checker",
  description: "Analyze any page with 40+ SEO checks, a pixel-accurate Google preview, keyword density, readability, structured data, and a one-click broken link check.",
};

export default function Page() {
  return (
    <Suspense>
      <AnalyzerTool />
    </Suspense>
  );
}
