import { describe, expect, it } from "vitest";
import { niceLinearTicks } from "@/components/charts/LineChart";

describe("chart axis ticks", () => {
  it("never repeats labels for a rank that doesn't change", () => {
    // Instagram held #11 for the whole period: the axis used to read #10, #11, #11, #11, #12.
    const { ticks } = niceLinearTicks(11, 11, 4, true);
    expect(ticks).toEqual([10, 11, 12]);
  });

  it("keeps ranks on whole numbers when the range is small", () => {
    const { ticks } = niceLinearTicks(9, 12, 4, true);
    expect(ticks.every(Number.isInteger)).toBe(true);
    expect(new Set(ticks.map((t) => Math.round(t))).size).toBe(ticks.length);
  });

  it("still allows fractional ticks for continuous values", () => {
    expect(niceLinearTicks(0, 1).ticks.some((t) => !Number.isInteger(t))).toBe(true);
  });
});
