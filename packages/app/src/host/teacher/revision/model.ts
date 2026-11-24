// Pure rules of the teacher's revision request (WEB-2151): the dd-h form and the banner state.
// The deadline is mandatory (orchestrator decision 22. 11. 2026., as the prototype). No network call here.
import type { RevisionRequest } from "@/client/revision-requests";
import { REVISION_TEXT_MAX } from "@/domain/collaboration/revision-input";
import { zagrebInstant, zagrebWall } from "@/lib/i18n/zagreb";
import { revisionMessages as text } from "./messages.hr";

export type FormError = "emptyInstruction" | "tooLong" | "dueRequired" | "pastDue";
export type RevisionBody = { readonly instruction: string; readonly dueAt: string };

/** Instruction and a required due day (`YYYY-MM-DD`); the deadline is the end of that day in Zagreb time. */
export function buildRevision(
  input: { instruction: string; due: string; today: string },
): { ok: true; body: RevisionBody } | { ok: false; error: FormError } {
  const instruction = input.instruction.normalize("NFC").trim();
  if (instruction === "") return { ok: false, error: "emptyInstruction" };
  if ([...instruction].length > REVISION_TEXT_MAX) return { ok: false, error: "tooLong" };
  if (input.due === "") return { ok: false, error: "dueRequired" };
  const dueAt = input.due < input.today ? null : zagrebInstant(`${input.due}T23:59`);
  return dueAt === null ? { ok: false, error: "pastDue" } : { ok: true, body: { instruction, dueAt } };
}

export type BannerState = keyof typeof text.states;
export type Banner = {
  readonly requestId: string; readonly state: BannerState; readonly head: string; readonly instruction: string;
  /** Accept and reopen only exist once the student answered. */
  readonly canClose: boolean;
  /** "Povuci zahtjev" exists only while the student has not answered (PG-8). */
  readonly canWithdraw: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
/** "5. 11. 2026. u 21:40", Zagreb time. */
export function zagrebStamp(iso: string): string {
  const w = zagrebWall(Date.parse(iso));
  return `${w.day}. ${w.month}. ${w.year}. u ${pad(w.hour)}:${pad(w.minute)}`;
}

/** The newest request that was not withdrawn; null when there is none. */
export function bannerOf(requests: readonly RevisionRequest[]): Banner | null {
  const last = [...requests].reverse().find((r) => r.state !== "withdrawn");
  if (last === undefined || last.state === "withdrawn") return null;
  const version = last.versions.at(-1)!;
  const declined = last.state === "responded" && version.response?.kind === "declined";
  const label = declined ? text.declined : text.states[last.state];
  return {
    requestId: last.id, state: last.state, instruction: version.instruction,
    head: text.stateHead(label, zagrebStamp(version.openedWindow)), canClose: last.state === "responded",
    canWithdraw: last.state === "open" || last.state === "reopened",
  };
}

/** Body of accept: the revision the student answered on, no anchor (contract 4.14). */
export function acceptBody(request: RevisionRequest) {
  const response = request.versions.at(-1)?.response;
  if (!response) return null;
  return { requestId: request.id, expectedSeq: request.rowSeq, acceptedRevision: response.revision, acceptedAnchor: null, rangeHash: null };
}

/** Body of reopen: the same instruction again (a new text is not asked, see PR Pretpostavke). */
export function reopenBody(request: RevisionRequest) {
  const version = request.versions.at(-1);
  if (!version?.response) return null;
  return { requestId: request.id, expectedSeq: request.rowSeq, instruction: version.instruction, requestedRevision: version.response.revision };
}

/** Body of withdraw: only the request and its counter (contract 4.14). */
export function withdrawBody(request: RevisionRequest) {
  return { requestId: request.id, expectedSeq: request.rowSeq };
}
