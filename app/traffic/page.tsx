import type { Metadata } from "next";
import { Suspense } from "react";
import { TrafficTool } from "@/components/traffic/TrafficTool";

export const metadata: Metadata = {
  title: "Website Traffic Checker",
  description: "Check how much traffic any website gets: popularity rank, 30-day trend, estimated monthly visits, tech stack, hosting and domain age. Free, no sign-up.",
};

export default function Page() {
  return (
    <Suspense>
      <TrafficTool />
    </Suspense>
  );
}
