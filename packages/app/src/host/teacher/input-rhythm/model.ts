// What the rhythm switch says, from the server's answer only (PIL-P1-RITAM-NASTAVNIK).
import type { RhythmAnswer, RhythmState } from "../../../../../../src/client/input-rhythm-teacher";
import { rhythmSwitchHr as text } from "./messages.hr";

export type RhythmLevel = "course" | "assignment";
export type RhythmNote = { readonly tone: "status" | "alert"; readonly text: string };

/** The level the state comes from, in the words of the switch's own level. */
export function sourceText(level: RhythmLevel, state: RhythmState): string {
  return text[level][state.source];
}

/** "Vrati na postavku predmeta" only for an assignment that holds a setting of its own. */
export function canReset(level: RhythmLevel, state: RhythmState): boolean {
  return level === "assignment" && state.source === "assignment";
}

/** The line after a change: saved only on the server's confirmation; null means "go to sign-in". */
export function changeNote(answer: RhythmAnswer): RhythmNote | null {
  if (answer.kind === "signedOut") return null;
  return answer.kind === "ready" ? { tone: "status", text: text.saved } : { tone: "alert", text: text.notSaved };
}
