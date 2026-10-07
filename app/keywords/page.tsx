import type { Metadata } from "next";
import { Suspense } from "react";
import { KeywordsTool } from "@/components/keywords/KeywordsTool";

export const metadata: Metadata = {
  title: "Free Keyword Generator",
  description: "Generate hundreds of keyword ideas from Google, Bing, YouTube, DuckDuckGo and Amazon autocomplete, grouped into questions, comparisons and topic clusters with search intent.",
};

export default function Page() {
  return (
    <Suspense>
      <KeywordsTool />
    </Suspense>
  );
}
