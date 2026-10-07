/**
 * Converts a popularity rank into an *order-of-magnitude* monthly-visits estimate.
 *
 * Web traffic is heavy-tailed: visits fall off roughly as a power law of rank. We
 * interpolate in log-log space between calibration anchors that reflect publicly
 * reported traffic for well-known sites at those ranks. The output is deliberately
 * a wide range — rankings measure relative popularity, not visits, and lists like
 * Tranco also rank API/CDN domains that get machine traffic. Treat the midpoint as
 * a rough guide, never as analytics.
 */

/** [rank, estimated monthly visits] */
export const TRAFFIC_ANCHORS: readonly [number, number][] = [
  [1, 80e9],
  [10, 2.5e9],
  [100, 300e6],
  [1_000, 30e6],
  [10_000, 2.5e6],
  [100_000, 180e3],
  [1_000_000, 9e3],
];

export interface VisitEstimate {
  low: number;
  mid: number;
  high: number;
  /** Multiplicative uncertainty used for the range. */
  factor: number;
}

export function estimateMonthlyVisits(rank: number): VisitEstimate | null {
  if (!Number.isFinite(rank) || rank < 1) return null;
  const anchors = TRAFFIC_ANCHORS;
  const lr = Math.log10(rank);
  let mid: number;
  if (rank <= anchors[0][0]) {
    mid = anchors[0][1];
  } else if (rank >= anchors[anchors.length - 1][0]) {
    const [r1, v1] = anchors[anchors.length - 2];
    const [r2, v2] = anchors[anchors.length - 1];
    const slope = (Math.log10(v2) - Math.log10(v1)) / (Math.log10(r2) - Math.log10(r1));
    mid = 10 ** (Math.log10(v2) + slope * (lr - Math.log10(r2)));
  } else {
    let i = 0;
    while (rank > anchors[i + 1][0]) i++;
    const [r1, v1] = anchors[i];
    const [r2, v2] = anchors[i + 1];
    const t = (lr - Math.log10(r1)) / (Math.log10(r2) - Math.log10(r1));
    mid = 10 ** (Math.log10(v1) + t * (Math.log10(v2) - Math.log10(v1)));
  }
  // Wider uncertainty further down the long tail.
  const factor = Math.round((2 + 0.25 * lr) * 10) / 10;
  return { low: mid / factor, mid, high: mid * factor, factor };
}

export function popularityTier(rank: number | null | undefined): { label: string; description: string } {
  if (!rank) return { label: "Unranked", description: "Not in the top 1 million sites" };
  if (rank <= 100) return { label: "Top 100", description: "One of the most visited sites in the world" };
  if (rank <= 1_000) return { label: "Top 1K", description: "A household-name website" };
  if (rank <= 10_000) return { label: "Top 10K", description: "A very popular website" };
  if (rank <= 100_000) return { label: "Top 100K", description: "A well-established website" };
  return { label: "Top 1M", description: "An active website with a real audience" };
}

/** Rough ceiling for sites that are not in the top-1M list at all. */
export const UNRANKED_CEILING = 9e3;
