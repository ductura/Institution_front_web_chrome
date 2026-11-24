// WEB-NUZ-PREDAJA-2 (NF-3 PR-3, G-7): the rows "Mjesta za izvor" and "Zalijepljeno" of step 3 as lists,
// not a fixed sentence. The places are read from the text the server holds (evidence.open.post), the
// text that would be submitted, with the same marks the editor's review finds ("[izvor]", "[?]" …);
// the pastes come from the process summary. Neither holds the submission (PRODUCT §5). Pure.
import type { TextNode } from "../work-read";
import type { ProcessSummaryV1 } from "../../../../../../../src/client/process-summary";
import { checksText as c } from "./messages.hr";

/** The marks of src/components/editor/citations/review-places.ts, kept equal by places.test.ts. */
export const PLACE_MARK = /\[(?:\?|izvor|provjeri|broj|stranica|citat)[^\]\uFFFC]{0,40}\]/giu;

/** One place left for a source: where it stands ("2. Teorijski okvir, odlomak 4") and its mark. */
export type Place = { readonly where: string; readonly mark: string };

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

/** The places in the order of the text; a block before any heading is "Odlomak n". */
export function placesOf(nodes: readonly TextNode[]): Place[] {
  const places: Place[] = [];
  let heading: string | null = null;
  let block = 0;
  for (const node of nodes) {
    const text = node.children.map((child) => child.text).join("");
    if (node.type === "heading") {
      heading = text.trim() === "" ? heading : text.trim();
      block = 0;
      continue;
    }
    block += 1;
    for (const match of text.matchAll(PLACE_MARK)) {
      places.push({ where: heading === null ? fill(c.placeAlone, { n: block }) : fill(c.placeIn, { heading, n: block }), mark: match[0] });
    }
  }
  return places;
}

/** The pastes above the faculty's threshold, as the summary lists them, and the count of smaller ones. */
export type Pastes = { readonly listed: ProcessSummaryV1["pastes"]["listed"]; readonly smaller: number; readonly threshold: number };

export function pastesOf(summary: ProcessSummaryV1): Pastes {
  return { listed: summary.pastes.listed, smaller: summary.pastes.smallerCount, threshold: summary.pastes.listedAboveCharacters };
}
