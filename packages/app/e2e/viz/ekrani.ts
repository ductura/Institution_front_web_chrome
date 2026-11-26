// VIZ alat: the screens of a pass, each once (ED-60). A screen that later joined the a11y list
// (as "nastavnik: usporedba verzija" did) stays in EXTRA too; without this Playwright refuses the
// whole pass for a duplicate test title and no shot is taken.

/** What the pass needs of a screen; e2e/a11y/screens.ts has the full type. */
type Named = { readonly name: string };

/** The a11y list, then each EXTRA screen whose name the a11y list does not have. */
export function pairScreens<S extends Named>(a11y: readonly S[], extra: readonly S[]): readonly S[] {
  const names = new Set(a11y.map((s) => s.name));
  return [...a11y, ...extra.filter((s) => !names.has(s.name))];
}
