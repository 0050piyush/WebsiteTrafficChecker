import { describe, expect, it } from "vitest";
import { revealStops } from "@/lib/client/theme-reveal";

describe("theme reveal keyframes", () => {
  const stops = revealStops();

  it("grows the circle from a dot to full size over the whole animation", () => {
    expect(stops[0]).toEqual([0, 0.02]);
    expect(stops.at(-1)).toEqual([1, 1]);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i][0]).toBeGreaterThan(stops[i - 1][0]);
      expect(stops[i][1]).toBeGreaterThan(stops[i - 1][1]);
    }
  });

  it("keeps the page inside the circle steady between keyframes", () => {
    for (let i = 1; i < stops.length; i++) {
      const [, a] = stops[i - 1];
      const [, b] = stops[i];
      // Halfway between two keyframes, circle scale × page scale should still be ~1.
      const drift = ((a + b) / 2) * ((1 / a + 1 / b) / 2) - 1;
      expect(drift).toBeLessThan(0.002);
      expect(stops[i][0] - stops[i - 1][0]).toBeLessThanOrEqual(0.025 + 1e-9);
    }
  });

  it("stays a reasonable size", () => {
    expect(stops.length).toBeLessThan(150);
  });
});
