/**
 * The breakpoints of the approved prototypes (VIZ-CSS), the single TypeScript
 * copy of the numbers that prototip-raspored.css writes into its media queries
 * (a media query cannot read a custom property). prijelomi.test.ts reads the
 * stylesheet and fails when the two drift apart.
 */
export const BREAKPOINTS = {
  /** <= 640: phone. */
  phone: 640,
  /** <= 800: the shell's rail folds into a top bar. */
  shell: 800,
  /** <= 1050: the editor's panel becomes a drawer; >= 1050: two-column pages open. */
  tablet: 1050,
  /** <= 1250: the editor's rail narrows. */
  laptop: 1250,
} as const;

export type Band = "phone" | "tablet" | "laptop" | "desktop";

/** The band a viewport width falls in: <= 640, 641-1050, 1051-1250, > 1250. */
export function bandOf(width: number): Band {
  if (width <= BREAKPOINTS.phone) return "phone";
  if (width <= BREAKPOINTS.tablet) return "tablet";
  if (width <= BREAKPOINTS.laptop) return "laptop";
  return "desktop";
}
