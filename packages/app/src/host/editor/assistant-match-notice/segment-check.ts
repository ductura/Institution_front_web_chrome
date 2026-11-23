// PIL-P1-PODUDARANJE-PROVJERA-WEB: which segments of the student's writing go to the check. A segment
// is a block of the editor with a node id and no block inside it; it goes once its text has changed
// since it was last checked (or since the editor opened) and it has a run of 8 words the server can
// match. The text is sent as the editor shows it; the server normalizes case, spacing and punctuation.
import type { SegmentToCheck } from "@/client/assistant-match";

/** The server matches 8 or more words in a row: a shorter segment cannot match. */
export const MIN_WORDS = 8;
/** The longest text the route accepts. */
export const MAX_TEXT = 40_000;
const SEGMENT_REF = /^[^\u0000-\u001f\u007f-\u009f]{1,128}$/;

/** The segments now in the editor, in document order. */
export function segmentsIn(root: ParentNode): SegmentToCheck[] {
  const blocks = [...root.querySelectorAll<HTMLElement>("[data-node-id]")];
  return blocks
    .filter((block) => block.querySelector("[data-node-id]") === null)
    .map((block) => ({ segmentRef: block.dataset["nodeId"] ?? "", text: (block.textContent ?? "").trim() }))
    .filter((s) => SEGMENT_REF.test(s.segmentRef));
}

const words = (text: string) => text.split(/\s+/).filter((w) => w !== "").length;

/** The segments whose text differs from the one last checked and that could match at all. */
export function segmentsToCheck(now: readonly SegmentToCheck[], checked: ReadonlyMap<string, string>): SegmentToCheck[] {
  return now.filter((s) => checked.get(s.segmentRef) !== s.text && s.text.length <= MAX_TEXT && words(s.text) >= MIN_WORDS);
}
