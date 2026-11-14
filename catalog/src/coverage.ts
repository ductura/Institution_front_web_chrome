import type { ReactNode } from "react";

/** The five states every catalogue entry shows (web.md §6 B5), in this order. */
export const CATALOG_STATES = ["prazno", "učitavanje", "greška", "puno", "onemogućeno"] as const;
export type CatalogState = (typeof CATALOG_STATES)[number];
export type CatalogEntries = Record<string, Record<string, () => ReactNode>>;

/** Exported components: capitalised functions (constants are UPPER_CASE, helpers camelCase). */
export function componentNames(exports: Record<string, unknown>): string[] {
  return Object.keys(exports)
    .filter((name) => /^[A-Z][a-z]/.test(name) && typeof exports[name] === "function")
    .sort();
}

/** Everything that keeps the catalogue from covering the exports; empty when complete. */
export function catalogGaps(exports: Record<string, unknown>, entries: CatalogEntries): string[] {
  const components = componentNames(exports);
  const gaps: string[] = [];
  for (const name of components) {
    const entry = entries[name];
    if (!entry) { gaps.push(`${name}: nema unosa u katalogu`); continue; }
    for (const state of CATALOG_STATES) if (!(state in entry)) gaps.push(`${name}: nedostaje stanje ${state}`);
    for (const state of Object.keys(entry)) {
      if (!(CATALOG_STATES as readonly string[]).includes(state)) gaps.push(`${name}: nepoznato stanje ${state}`);
    }
  }
  for (const name of Object.keys(entries)) if (!components.includes(name)) gaps.push(`${name}: unos bez komponente`);
  return gaps;
}
