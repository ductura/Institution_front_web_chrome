// Pure rules of the N-07 "Prije predaje" panel and the fallback ("zamjenski") state (WEB-2156).
// Only what the server states is shown; a fact it does not give is said as unavailable, never invented (B-6).
import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";
import type { VersionedDocument } from "../../../../../editor-core/src/document/document";
import { buildElements } from "../text-elements/model";
import type { ElementsRead } from "../text-elements/reader";
import { preSubmitMessages as text } from "./messages.hr";

export type PasteRow = { readonly at: { readonly from: string; readonly to: string }; readonly characters: number };

/** The part of the process summary this panel uses (a subset of ProcessSummaryV1). */
export type SummaryFacts = {
  readonly pastes: { readonly listedAboveCharacters: number; readonly listed: readonly PasteRow[] };
};

export type PreSubmit = {
  readonly pasted: { readonly rows: readonly string[]; readonly none: string | null };
  readonly form: string;
};

const characters = (n: number): string => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "znak" : "znakova"}`;

export function preSubmit(summary: SummaryFacts): PreSubmit {
  const { listed, listedAboveCharacters } = summary.pastes;
  return {
    pasted: {
      rows: listed.map((p) => `${formatDateTimeHr(p.at.from)} · ${characters(p.characters)}`),
      none: listed.length === 0 ? text.pastedNone(characters(listedAboveCharacters)) : null,
    },
    form: text.formNotRun,
  };
}

/**
 * The fallback procedure after an unfinished submission. The server returns no such state yet (no variant in
 * teacher.submission-receipt.get), so every read is "unavailable"; `unfinished` is the shape the panel draws once it does.
 */
export type Fallback = { readonly kind: "unfinished"; readonly requestedAt: string } | { readonly kind: "unavailable" };

export const fallbackText = (fallback: Fallback): { readonly title: string | null; readonly body: string } =>
  fallback.kind === "unfinished"
    ? { title: text.fallbackTitle, body: text.fallbackBody(formatDateTimeHr(fallback.requestedAt)) }
    : { title: null, body: text.fallbackUnavailable };

/** Shown for a submitted work whose receipt is not signed yet or could not be read; never for a confirmed receipt. */
export const showFallback = (receipt: "potvrdeno" | "ceka" | "error" | "loading" | "none"): boolean =>
  receipt === "ceka" || receipt === "error";

/** Open places for a source, read from the versioned document: a list, an honest "none", or "unavailable" (never a guess). */
export type Places =
  | { readonly kind: "loading" | "unavailable" | "none" }
  | { readonly kind: "places"; readonly rows: readonly string[] };

/**
 * One row per citation whose source the document does not hold, as "2. Teorijski okvir, odlomak 4": the numbered heading
 * it sits under and its paragraph number there (prototype `beforePanel`). Before any heading the row is "Odlomak N".
 */
export function openPlaces(doc: VersionedDocument): readonly string[] {
  const rows: string[] = [];
  let heading = 0;
  let title: string | null = null;
  let paragraph = 0;
  for (const block of buildElements(doc).blocks) {
    const label = block.pieces.map((p) => (p.kind === "text" ? p.text : "")).join("").trim();
    if (block.type === "heading") { heading += 1; title = `${heading}. ${label}`; paragraph = 0; continue; }
    paragraph += 1;
    for (const piece of block.pieces) {
      if (piece.kind === "open") rows.push(title === null ? text.placeNoHeading(paragraph) : text.place(title, paragraph));
    }
  }
  return rows;
}

/** A failed, signed-out or missing read is "unavailable", never "none" (B-6); only a read document or an empty one may say "none". */
export function placesFromRead(read: ElementsRead | null): Places {
  if (read === null) return { kind: "loading" };
  if (read.kind === "empty") return { kind: "none" };
  if (read.kind !== "document") return { kind: "unavailable" };
  const rows = openPlaces(read.document);
  return rows.length === 0 ? { kind: "none" } : { kind: "places", rows };
}
