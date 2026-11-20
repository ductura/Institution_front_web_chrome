/**
 * The suggestion of a teacher's text change (N-08, Ductus docs/ARCHITECTURE.md
 * 5a, D-133/D-134/D-266). A suggestion is a derived view of a SEPARATE record
 * with an anchor: never a mark in the Tiptap schema, never a change of the
 * document, and the mentor's entry is not in the work's hash chain. Only the
 * student's acceptance changes the text, and that change is the student's own,
 * with the source "izmjena nastavnika".
 *
 * The route is not in the contract yet: the shape below is the smallest
 * reasonable one (the action path `suggestions/{action}`), recorded as an assumption
 * in the PR, and `suggestionsFromList` trusts nothing: a body not exactly
 * this shape is unavailable as a whole, never shown in part.
 */

import { isTextAnchorInput, type TextAnchor } from "../../../../packages/editor-core/src/document/collaboration";

export type SuggestionState = "pending" | "withdrawn" | "accepted" | "rejected";

export type Suggestion = {
  readonly id: string;
  /** 1, 2, 3… in the order the suggestions were made. */
  readonly number: number;
  readonly state: SuggestionState;
  /** The counter a transition must carry back unchanged (409 on a stale one). */
  readonly rowSeq: number;
  readonly anchor: TextAnchor;
  /** The text that replaces `anchor.quote`. */
  readonly replacement: string;
  readonly isOwn: boolean;
  /** Start of the 5-minute window (P-03) the suggestion was made in. */
  readonly madeAt: string;
};

/** The only text a suggestion may be marked with in the evidence of the work. */
export const SUGGESTION_SOURCE = "teacher-suggestion" as const;
export const SUGGESTION_TEXT_MAX = 2000;

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const STATES: ReadonlySet<string> = new Set(["pending", "withdrawn", "accepted", "rejected"]);
const KEYS = ["anchor", "id", "is_own", "opened_window", "replacement", "row_seq", "state"];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isReplacement = (value: unknown): value is string =>
  typeof value === "string" && [...value].length >= 1 && [...value].length <= SUGGESTION_TEXT_MAX;

/** Suggestions from the body of `list`; null for any row out of shape. */
export function suggestionsFromList(value: unknown): Suggestion[] | null {
  if (!isObject(value) || !Array.isArray(value.suggestions)) return null;
  const out: Suggestion[] = [];
  for (const row of value.suggestions as unknown[]) {
    if (!isObject(row)) return null;
    const keys = Object.keys(row).sort();
    if (keys.length !== KEYS.length || keys.some((key, i) => key !== KEYS[i])) return null;
    const { id, state, row_seq: rowSeq, anchor, replacement, is_own: isOwn, opened_window: at } = row;
    if (typeof id !== "string" || !UUID.test(id) || out.some((s) => s.id === id)
      || typeof state !== "string" || !STATES.has(state)
      || typeof rowSeq !== "number" || !Number.isSafeInteger(rowSeq) || rowSeq < 1
      || !isTextAnchorInput(anchor) || !isReplacement(replacement) || typeof isOwn !== "boolean"
      || typeof at !== "string" || Number.isNaN(Date.parse(at))) return null;
    out.push({
      id, number: out.length + 1, state: state as SuggestionState, rowSeq, anchor, replacement, isOwn, madeAt: at,
    });
  }
  return out;
}
