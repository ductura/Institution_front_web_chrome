// Ported from Ductus src/lib/i18n/hr.ts at 078c780f (DAN-753): only the month
// names zagreb-time needs; the rest of the module comes with its users.

/**
 * Month names in the genitive, which is the case a Croatian date uses:
 * "19. rujna", not "19. rujan". Index 0 is January.
 */
export const MONTHS_GENITIVE_HR = [
  "siječnja",
  "veljače",
  "ožujka",
  "travnja",
  "svibnja",
  "lipnja",
  "srpnja",
  "kolovoza",
  "rujna",
  "listopada",
  "studenoga",
  "prosinca",
] as const;

/** Texts of the left panel outline (DAN-977, 977-3); locales/ changes only with the server. */
export const OUTLINE_HR = {
  /** Name of the button that collapses a chapter, before its number and title. */
  subheadings: "Potpoglavlja",
  /** Label of the title search above the outline (DAN-978). */
  search: "Traži naslov",
  /** Status when no title holds the query. */
  noMatch: "Nema naslova s tim tekstom.",
  /** Button that collapses every branch (978-2), and the same button when none shows open. */
  collapseAll: "Sklopi sve",
  expandAll: "Rasklopi sve",
  /** Toggle (aria-pressed) for the editor's headings-only view (978-3); the label never changes. */
  headingsOnly: "Samo naslovi",
} as const;

// Ported from Ductus src/lib/i18n/hr.ts at 9c45857 (DAN-871, 871-1): the count
// forms TeacherCourses needs.

/**
 * Picks the Croatian form a count agrees with.
 *
 * The rule, in full:
 *   - last digit 1, but not the 11–14 band → `jedan` (1, 21, 101, 1001)
 *   - last digit 2–4, but not the 11–14 band → `dva` (2, 23, 104)
 *   - everything else, including the whole 11–14 band → `pet`
 *
 * Non-integers and negatives are answered by the same rule applied to the
 * absolute value of the integer part; a fractional count has no place in this
 * UI, and guessing at one would be a worse answer than a consistent one.
 */
export function pluralHr(
  n: number,
  jedan: string,
  dva: string,
  pet: string,
): string {
  const whole = Math.abs(Math.trunc(n));
  const lastTwo = whole % 100;
  const last = whole % 10;
  if (lastTwo >= 11 && lastTwo <= 14) {
    return pet;
  }
  if (last === 1) {
    return jedan;
  }
  if (last >= 2 && last <= 4) {
    return dva;
  }
  return pet;
}

/**
 * The number and the form it agrees with: `countHr(3, "rad", "rada", "radova")`
 * → `"3 rada"`. The number is rendered as given, so a caller that passes a
 * non-integer sees its own value back.
 */
export function countHr(
  n: number,
  jedan: string,
  dva: string,
  pet: string,
): string {
  return `${n} ${pluralHr(n, jedan, dva, pet)}`;
}
