// DAN-1565: which screens of the real app the report captures, and which
// reference image each one is laid next to. Pure data and pure functions.

export type ReportTheme = { readonly id: "tamna" | "svijetla"; readonly stored: "dark" | "light" };
export const THEMES: readonly ReportTheme[] = [
  { id: "tamna", stored: "dark" },
  { id: "svijetla", stored: "light" },
];

/** Widths the reference images were drawn at (Ductus docs/design/ductura, `snimke/`). */
export const WIDTHS = [1440, 400] as const;

export type ReportScreen = {
  readonly id: string;
  readonly route: string;
  readonly role: "student" | "teacher";
  /** Level 1 heading the screen shows once its data is read. */
  readonly heading: string;
  /** Text of the invented data, visible only once the screen's read has answered. */
  readonly content: string;
  /**
   * Path of the reference images under the reference root, without
   * `-<theme>-<width>.png`; null when no reference is known for the screen.
   */
  readonly reference: string | null;
};

export const SCREENS: readonly ReportScreen[] = [
  {
    id: "S-02", route: "/zadaci", role: "student", heading: "Vaš studentski prostor", content: "Izmišljeni zadatak 1",
    reference: "m2-student-reference/snimke/pocetna-kolegiji",
  },
  {
    id: "S-03", route: "/zadaci/kolegiji", role: "student", heading: "Moji kolegiji", content: "Izmišljeni zadatak 1",
    reference: "m2-student-reference/snimke/pocetna-kolegiji",
  },
  {
    id: "N-01", route: "/nastavnik", role: "teacher", heading: "Moji kolegiji", content: "Izmišljeni kolegij nastavnika",
    reference: "m2-nastavnik-reference/snimke/n01",
  },
  {
    id: "N-16", route: "/nastavnik/mentorstva", role: "teacher", heading: "Radovi uz mentora", content: "Izmišljeni diplomski rad",
    reference: "m2-nastavnik-reference/snimke/n04-n16",
  },
];

/** The reference file of a screen under the root, or null when the screen has none. */
export function referencePath(screen: ReportScreen, theme: ReportTheme, width: number): string | null {
  return screen.reference === null ? null : `${screen.reference}-${theme.id}-${width}.png`;
}

/** File name of a capture: `S-02-tamna-1440.png`. */
export function captureName(screen: ReportScreen, theme: ReportTheme, width: number): string {
  return `${screen.id}-${theme.id}-${width}.png`;
}
