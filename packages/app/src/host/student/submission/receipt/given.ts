// NF-3 PR-11 (E-11d): "Što je predano", the short list under the receipt. Each line says what the
// server gave or that it could not be read; nothing is guessed and nothing is a percentage (Ustav v1.6).
import type { GateState } from "../summary/declaration-gate";
import type { NotesRead } from "../../../../../../../src/components/predaja/BeforeSubmit.tsx";
import { thousands } from "../submit/model";
import { receiptText as t } from "./messages.hr";
import { when } from "./model";

export type GivenInput = {
  /** The revision the signed receipt names. */
  readonly revision: number;
  /** Words in the server's text of that revision; null when that text could not be read. */
  readonly words: number | null | "loading";
  readonly declaration: GateState;
  readonly notes: NotesRead;
};

const fill = (text: string, n: number | string) => text.replace("{n}", String(n));

function declarationLine(gate: GateState, at: (iso: string) => string): string {
  switch (gate.kind) {
    case "loading": return t.givenDeclarationChecking;
    case "not_required": return t.givenDeclarationNotRequired;
    case "missing": return t.givenDeclarationMissing;
    case "confirmed": {
      return gate.confirmedAt ? t.givenDeclarationAt.replace("{at}", at(gate.confirmedAt)) : t.givenDeclaration;
    }
    default: return t.givenDeclarationUnknown;
  }
}

/** The four lines of E-11d, in the prototype's order. */
export function givenLines(input: GivenInput, at: (iso: string) => string = when): readonly string[] {
  const { words, notes } = input;
  return [
    fill(t.givenVersion, input.revision),
    words === "loading" ? t.givenWordsLoading : words === null ? t.givenWordsUnknown : fill(t.givenWords, thousands(words)),
    declarationLine(input.declaration, at),
    notes.kind === "loading" ? t.givenNotesLoading : notes.kind === "ready" ? fill(t.givenNotes, notes.notes.length) : t.givenNotesUnknown,
  ];
}
