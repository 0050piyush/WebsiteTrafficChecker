/**
 * The theme switch reveals the new theme in a circle growing from the toggle button.
 * Animating clip-path would repaint the whole screen every frame, so instead the circle is
 * a rounded box that is scaled up with `transform` while the page inside it is scaled
 * down by the same amount. Transforms run on the GPU without repainting, so the reveal
 * stays at full frame rate on phones. See the `theme-reveal` rules in globals.css.
 */

/** Starting size of the circle, as a fraction of its final radius. */
const START_SCALE = 0.02;
/**
 * Keyframes are close enough together that the circle and the counter-scaled page stay in
 * step between them: with scales at most 7% apart the page drifts by under 0.2%.
 */
const MAX_SCALE_STEP = 1.07;
const MAX_TIME_STEP = 0.025;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const inverseEaseOutCubic = (p: number) => 1 - Math.cbrt(1 - p);

/** [time 0–1, circle scale] stops for an ease-out reveal from START_SCALE to 1. */
export function revealStops(): [number, number][] {
  const scaleAt = (t: number) => START_SCALE + (1 - START_SCALE) * easeOutCubic(t);
  const stops: [number, number][] = [[0, START_SCALE]];
  let t = 0;
  while (t < 1) {
    const s = scaleAt(t);
    const bySize = inverseEaseOutCubic(Math.min(1, (s * MAX_SCALE_STEP - START_SCALE) / (1 - START_SCALE)));
    t = Math.min(1, bySize, t + MAX_TIME_STEP);
    stops.push([t, scaleAt(t)]);
  }
  return stops;
}

function keyframesCss(): string {
  const stops = revealStops();
  const frames = (scale: (s: number) => number) =>
    stops.map(([t, s]) => `${+(t * 100).toFixed(3)}%{transform:scale(${+scale(s).toFixed(5)})}`).join("");
  return `@keyframes theme-reveal-circle{${frames((s) => s)}}@keyframes theme-reveal-page{${frames((s) => 1 / s)}}`;
}

/** Add the generated keyframes to the page once, before the first reveal. */
export function ensureRevealKeyframes() {
  if (document.getElementById("theme-reveal-keyframes")) return;
  const style = document.createElement("style");
  style.id = "theme-reveal-keyframes";
  style.textContent = keyframesCss();
  document.head.appendChild(style);
}
