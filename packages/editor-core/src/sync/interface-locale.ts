/**
 * Interface languages the sync labels are written in (D-70, F-06).
 *
 * Thin adapter, not a port: Ductus `src/domain/sync/labels.ts` imports these
 * three values from `src/lib/i18n/locale.ts`, which in this repo lives in
 * `src/components/i18n/locale.ts` together with the catalogues. A package may
 * not import application code, so editor-core keeps only the language list
 * here, and the adapter test fails as soon as the application
 * registers a language this list does not have.
 */
export type InterfaceLocale = "hr" | "en";

export const DEFAULT_INTERFACE_LOCALE: InterfaceLocale = "hr";

export const INTERFACE_LOCALES: readonly InterfaceLocale[] = Object.freeze(["hr", "en"] as InterfaceLocale[]);
