/**
 * Layout by width and touch target sizes. The width limits are the ones the
 * `@media` rules in `@ductura/ui` and `AppShell` already use (640 px phone,
 * 800 px side navigation), so script and CSS never disagree.
 */

export type Layout = "phone" | "tablet" | "desktop";

/** Widest phone layout, matching `@media (max-width: 640px)`. */
export const PHONE_MAX = 640;
/** First desktop width, matching `@media (max-width: 799.98px)` for the shell. */
export const DESKTOP_MIN = 800;

/**
 * The layout for a viewport width in CSS px. A width that is not a finite,
 * non-negative number gives the narrowest layout, where nothing overlaps.
 */
export function layoutForWidth(width: number): Layout {
  if (!Number.isFinite(width) || width < 0) return "phone";
  if (width <= PHONE_MAX) return "phone";
  if (width < DESKTOP_MIN) return "tablet";
  return "desktop";
}

/** WCAG 2.2 AA, SC 2.5.8 Target Size (Minimum): 24 by 24 CSS px. */
export const TARGET_MIN_AA = 24;

/**
 * The target size the design asks for (`tokens/globals.css`): 44 px, or 32 px
 * in dense bars. Both are above the AA minimum; a coarse pointer never gets
 * the dense size.
 */
export function targetMinSize(pointer: "coarse" | "fine", dense = false): number {
  return dense && pointer === "fine" ? 32 : 44;
}

/** Whether a box is at least `min` px in both directions. */
export function meetsTargetSize(box: { width: number; height: number }, min = TARGET_MIN_AA): boolean {
  return Number.isFinite(box.width) && Number.isFinite(box.height) && box.width >= min && box.height >= min;
}
