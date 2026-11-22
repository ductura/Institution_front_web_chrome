import type { SummaryRead } from "../../../../../../../src/components/predaja/BeforeSubmit.tsx";
import type { SummaryOutcome } from "../../../../../../../src/client/process-summary.ts";
import type { LocalCall } from "../../../../../../../src/client/submission.ts";

// WEB-2108 (PD-1, PD-4): step 3 reads the process summary and the notes from
// the server instead of the fixed "unavailable". The summary needs the work's
// document, which only evidence.open.post names; nothing here guesses one.

/** The work as evidence.open.post gave it; only `ready` names a document. */
export type StepWork =
  | { readonly kind: "ready"; readonly documentId: string }
  | { readonly kind: "empty" | "unavailable" | "loading" | "notice" | "signIn" };

export type SummaryPorts = {
  readonly readWork: (assignmentId: string) => Promise<StepWork>;
  readonly readSummary: (documentId: string) => Promise<SummaryOutcome>;
};

/** What step 3 shows in the summary column, or that the session has ended. */
export type StepSummary = SummaryRead | { readonly kind: "signIn" };

const UNREACHED = { kind: "unavailable" } as const;

/**
 * The summary of the assignment's work. A work with no text yet has nothing to
 * summarise (`unavailable`, no retry); a failed read may be repeated (`error`).
 * Neither holds the submission (§5 rule 11).
 */
export async function readStepSummary(assignmentId: string, ports: SummaryPorts): Promise<StepSummary> {
  const work: StepWork = await ports.readWork(assignmentId).catch(() => UNREACHED);
  if (work.kind === "signIn") return { kind: "signIn" };
  if (work.kind === "empty") return { kind: "unavailable" };
  if (work.kind !== "ready") return { kind: "error" };
  const outcome: SummaryOutcome = await ports.readSummary(work.documentId).catch(() => UNREACHED);
  if (outcome.kind === "ok") return { kind: "ready", summary: outcome.summary };
  return outcome.kind === "signedOut" ? { kind: "signIn" } : { kind: "error" };
}

/** What the shared client answers for one notes route. */
export type ClientAnswer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code?: string };

export type NotesClient = {
  readonly list: (assignmentId: string) => Promise<ClientAnswer>;
  readonly add: (assignmentId: string, text: string) => Promise<ClientAnswer>;
};

const failed = (answer: Extract<ClientAnswer, { ok: false }>) =>
  ({ ok: false, status: answer.status, code: answer.code ?? "unavailable" }) as const;

/**
 * The notes transport over the shared client. The server answers a new note
 * with the note itself (201); src/client reads it as `{ note }`, so it is
 * wrapped here, never rebuilt from what was typed.
 */
export function notesCall(client: NotesClient): LocalCall {
  return async (id, { params, body }) => {
    if (id === "student.submission-notes.get") {
      const answer = await client.list(params.assignmentId);
      return answer.ok ? answer : failed(answer);
    }
    if (id === "student.submission-notes.post" && body !== undefined) {
      const answer = await client.add(body.assignmentId, body.text);
      return answer.ok ? { ok: true, status: answer.status, body: { note: answer.body } } : failed(answer);
    }
    return { ok: false, status: 0, code: "client_rejected" };
  };
}
