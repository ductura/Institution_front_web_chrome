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
} as const;
