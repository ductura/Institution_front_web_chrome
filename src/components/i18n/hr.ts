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
  /** Label and options of the levels choice (979-3): headings up to level 1, 2 or 3. */
  levels: "Razine naslova",
  levelOptions: { 1: "1", 2: "1–2", 3: "1–3" },
} as const;
