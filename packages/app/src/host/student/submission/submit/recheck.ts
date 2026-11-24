// WEB-NUZ-PREDAJA-2 (NF-3 PR-9, G-14, G-16): after a submission whose outcome is unknown, the state is
// read again (student.submission.get) when the connection comes back and 10 s after each read that
// did not answer, at most three times. Until the state is read, sending is not offered; after the
// third read without an answer, the student may report a problem. Pure: the hook in use-recheck.ts
// brings the clock, the network and the read.
import type { SubmissionRead } from "../../../../../../../src/client/submission";

export const RECHECK_AFTER_MS = 10_000;
export const RECHECK_LIMIT = 3;

/** `attempt`: the number of the next read (1 to 3); `gaveUp`: the third read did not answer either. */
export type RecheckState = { readonly attempt: number; readonly reading: boolean; readonly gaveUp: boolean };

export const RECHECK_START: RecheckState = { attempt: 1, reading: false, gaveUp: false };

/** Whether a read of the state answered: the server's state, an ended session, or a work not found. */
export function answered(read: SubmissionRead): boolean {
  return read.kind === "none" || read.kind === "ceka" || read.kind === "potvrdeno" || read.kind === "session-expired"
    || (read.kind === "greska" && read.code === "not_found");
}

/** One read starts, unless one is on its way or the reads have given up. */
export function startRead(state: RecheckState): RecheckState | null {
  return state.reading || state.gaveUp ? null : { ...state, reading: true };
}

/** After a read that did not answer: the next attempt, or giving up after the last one. */
export function afterUnanswered(state: RecheckState): RecheckState {
  return state.attempt >= RECHECK_LIMIT ? { ...state, reading: false, gaveUp: true } : { attempt: state.attempt + 1, reading: false, gaveUp: false };
}
