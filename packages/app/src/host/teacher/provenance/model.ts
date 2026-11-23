// "Karta podrijetla" (WEB-2158; N-10 km-h): the pure part. The marks have no sum and no calculation, so no
// percent of this answer reaches the marks; it only decides whether the work has any mark at all. The one share
// the map shows is the assistant match's own, in its section (match-model.ts).
import { provenanceText as t } from "./messages.hr";

/** The origin kinds that put a mark on the map: paste, import and transfer from the assistant (prototype). */
export const MARKED_KINDS = ["pasted_known", "pasted_unknown", "imported_file", "assistant_inserted"] as const;

export type ProvenancePart = { readonly kind: string; readonly percent: number };

export type ProvenanceRead =
  | { readonly kind: "marked" }
  | { readonly kind: "noMarks" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "unavailable" };

export type ProvenanceState = ProvenanceRead | { readonly kind: "loading" };

/** "bez-oznaka" when no part of a marked kind has any text; a share below one percent is still a mark. */
export function readOfParts(parts: readonly ProvenancePart[]): ProvenanceRead {
  const marked = parts.some((part) => (MARKED_KINDS as readonly string[]).includes(part.kind) && part.percent > 0);
  return { kind: marked ? "marked" : "noMarks" };
}

/** The two switches: "Podrijetlo teksta" is on by default; "Napisano u Ducturi" only counts while it is. */
export type MapSwitches = { readonly origin: boolean; readonly typed: boolean };
export const DEFAULT_SWITCHES: MapSwitches = { origin: true, typed: false };

export const typedShown = (s: MapSwitches): boolean => s.origin && s.typed;

export type LegendItem = { readonly key: "paste" | "ai" | "imp" | "teach" | "open" | "typed"; readonly label: string };

/** The legend in the order of the prototype; "napisano u Ducturi" only while both switches are on. */
export function legendItems(s: MapSwitches): readonly LegendItem[] {
  const items: LegendItem[] = [
    { key: "paste", label: t.legendPaste },
    { key: "ai", label: t.legendAi },
    { key: "imp", label: t.legendImport },
    { key: "teach", label: t.legendTeacher },
    { key: "open", label: t.legendOpen },
  ];
  return typedShown(s) ? [...items, { key: "typed", label: t.legendTyped }] : items;
}
