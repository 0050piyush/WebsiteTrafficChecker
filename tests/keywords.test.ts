import { describe, expect, it } from "vitest";
import { aggregateSuggestions, buildQueries, classifyGroup, classifyIntent } from "@/lib/keywords/expand";

describe("keyword expansion", () => {
  it("builds quick and deep query sets", () => {
    const quick = buildQueries("Coffee Grinder", "quick");
    expect(quick).toContain("coffee grinder");
    expect(quick).toContain("how coffee grinder");
    expect(quick).toContain("coffee grinder for ");
    const deep = buildQueries("coffee grinder", "deep");
    expect(deep).toContain("coffee grinder z");
    expect(deep).toContain("best coffee grinder");
    expect(deep.length).toBeGreaterThan(quick.length + 25);
  });

  it("classifies intent and group", () => {
    expect(classifyIntent("buy coffee grinder")).toBe("Transactional");
    expect(classifyIntent("best coffee grinder 2026")).toBe("Commercial");
    expect(classifyIntent("baratza login")).toBe("Navigational");
    expect(classifyIntent("how does a burr grinder work")).toBe("Informational");
    expect(classifyGroup("how to clean a coffee grinder")).toBe("Questions");
    expect(classifyGroup("burr vs blade coffee grinder")).toBe("Comparisons");
    expect(classifyGroup("coffee grinder for espresso")).toBe("Prepositions");
    expect(classifyGroup("manual burr coffee grinder ceramic")).toBe("Long-tail");
    expect(classifyGroup("coffee grinder electric")).toBe("Related");
  });

  it("scores by position and source agreement, and clusters by modifier", () => {
    const ideas = aggregateSuggestions("coffee grinder", [
      { source: "google", query: "coffee grinder", suggestions: ["coffee grinder burr", "coffee grinder electric", "coffee grinder manual"] },
      { source: "bing", query: "coffee grinder", suggestions: ["coffee grinder burr", "Coffee Grinder  Manual"] },
      { source: "google", query: "best coffee grinder", suggestions: ["best coffee grinder burr", "best coffee grinder for espresso"] },
      { source: "google", query: "coffee grinder for", suggestions: ["coffee grinder for espresso"] },
    ]);
    expect(ideas[0].keyword).toBe("coffee grinder burr");
    expect(ideas[0].score).toBe(100);
    expect(ideas[0].sources.sort()).toEqual(["bing", "google"]);
    const manual = ideas.find((i) => i.keyword === "coffee grinder manual")!;
    expect(manual.appearances).toBe(2);
    expect(ideas.find((i) => i.keyword === "best coffee grinder burr")!.cluster).toBe("burr");
    expect(ideas.find((i) => i.keyword === "coffee grinder for espresso")!.cluster).toBe("espresso");
    expect(ideas.every((i) => i.score >= 1 && i.score <= 100)).toBe(true);
  });
});
