import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareTool } from "@/components/traffic/CompareTool";

export const metadata: Metadata = {
  title: "Compare Website Traffic",
  description: "Compare the traffic and popularity rank of up to 8 websites side by side, with 30-day trends. Free competitor analysis.",
};

export default function Page() {
  return (
    <Suspense>
      <CompareTool />
    </Suspense>
  );
}
