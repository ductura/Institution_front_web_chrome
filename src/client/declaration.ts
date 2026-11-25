// The AI part of the declaration (S31-AI, N-AI-ATT) behind a port, and the real adapter over
// declaration-v1 (SRV-1210..1214): student.declaration.get/put and teacher.declaration.get, all
// through createApi (PIL-K-IZJAVA-PORT). declaration-fake.ts implements the same port for tests
// and the catalogue only. The student routes are keyed by assignment, so the student's
// `submissionId` here is the assignment id; the teacher's names a student too (`teacherTarget`).
import { browserTransport, createApi, responseMatches, type ApiResult } from "./api";
import type { MigrationOperations } from "./migration-contract-types.generated";

export type DeclarationTurn = {
  readonly seq: number;
  readonly author: "student" | "assistant";
  readonly text: string;
};

export type DeclarationUse = { readonly purpose: string; readonly provider: string; readonly phase: string };

/** `transfer`: text from it entered the work, so it is required. Anything else goes only if picked. */
export type AttachReason = "transfer" | "student_added";

/** A conversation the student may attach, in the exact version the server shows. */
export type StudentConversation = {
  readonly conversationId: string;
  readonly title: string;
  readonly reason: AttachReason;
  readonly requiredBecause?: string;
  readonly assistantName: string;
  readonly throughSeq: number;
  readonly messagesSha256: string;
  readonly turns: readonly DeclarationTurn[];
};

export type Attachment = {
  readonly conversationId: string;
  readonly reason: AttachReason;
  readonly throughSeq: number;
  readonly messagesSha256: string;
};

export type StudentDeclarationRead =
  | { readonly kind: "no_use" | "ai_disabled" | "unavailable" | "signedOut" }
  | { readonly kind: "ready"; readonly uses: readonly DeclarationUse[]; readonly conversations: readonly StudentConversation[] };

export type ConfirmResult =
  | { readonly kind: "confirmed" }
  /** attachment_stale: these conversations changed after the version the student reviewed. */
  | { readonly kind: "stale"; readonly conversationIds: readonly string[] }
  /** The declaration changed on the server since it was read (409, B-6): nothing was confirmed. */
  | { readonly kind: "conflict" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

/** What the teacher receives: attached conversations only, with no trace of the others (D-41). */
export type TeacherConversation = {
  readonly conversationId: string;
  readonly title: string;
  readonly reason: AttachReason;
  readonly assistantName: string;
  readonly throughSeq: number;
  readonly turns: readonly DeclarationTurn[];
  readonly transferredNote?: string;
};

export type TeacherTransfer = { readonly id: string; readonly heading: string; readonly source: string; readonly text: string };
export type ExternalConversation = { readonly id: string; readonly title: string };

/** The teacher's question beside the declaration (NF-3 PR-20, R-33), as the server holds it. */
export type TeacherQuestion = { readonly questionId: string; readonly text: string };
/** The student's answer, with the wording of the question it answers. */
export type QuestionAnswer = { readonly questionId: string; readonly questionText: string; readonly text: string };
/** What the student sends: the answer to one question, or null to take it back. */
export type AnswerWrite = { readonly questionId: string; readonly text: string } | null;

/** The question and the answer of a teacher read, when the server gives them (PG-6); absent is none. */
export type TeacherQuestionPart = { readonly question?: TeacherQuestion | null; readonly answer?: QuestionAnswer | null };

export type TeacherDeclarationRead =
  | ({ readonly kind: "pending" } & TeacherQuestionPart)
  | { readonly kind: "unavailable" }
  | { readonly kind: "signedOut" }
  | ({ readonly kind: "no_use"; readonly confirmedAt: string } & TeacherQuestionPart)
  | ({
      readonly kind: "ready";
      readonly confirmedAt: string;
      readonly assistantAllowed: boolean;
      readonly uses: readonly DeclarationUse[];
      readonly transfers: readonly TeacherTransfer[];
      readonly conversations: readonly TeacherConversation[];
      readonly external: readonly ExternalConversation[];
    } & TeacherQuestionPart);

export interface DeclarationPort {
  readStudent(submissionId: string): Promise<StudentDeclarationRead>;
  confirm(submissionId: string, attachments: readonly Attachment[]): Promise<ConfirmResult>;
  readTeacher(submissionId: string): Promise<TeacherDeclarationRead>;
}

// ---------------------------------------------------------------------------
// The adapter over declaration-v1. A write is a whole draft on top of the version the view read
// (baseVersion), never on a fresh read: a 409 for that version is a conflict, never a quiet
// success (B-6). The view's two ports (the AI part and the statement) share one session.

export type Call = ReturnType<typeof createApi>;
/** Re-exported for statement.ts, the other half of the declaration step. */
export { browserTransport, createApi, responseMatches };

type StudentState = MigrationOperations["student.declaration.get"]["success"]["body"];
type PutBody = MigrationOperations["student.declaration.put"]["body"];
type WireHelp = NonNullable<StudentState["draft"]>["humanHelp"];
type WireAi = NonNullable<StudentState["draft"]>["ai"];

/** The 409 codes that mean "someone wrote first": the read is no longer the current version. */
export const VERSION_CONFLICTS: ReadonlySet<string> = new Set(["declaration_conflict", "conflict", "stale_revision", "form_outdated"]);

/**
 * What one view read, by assignment, and the printouts it uploaded since its last saved draft.
 * The view's two ports share it: a write goes on the latest read of either half, so a mount
 * builds both with createDeclarationStepPorts and refreshes the two halves together.
 */
export type DeclarationSession = {
  readonly states: Map<string, StudentState>;
  readonly uploaded: Map<string, readonly string[]>;
};

export function createDeclarationSession(): DeclarationSession {
  return { states: new Map(), uploaded: new Map() };
}

export type StudentRead =
  | { readonly kind: "ok"; readonly state: StudentState }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

/** The student's declaration as the server holds it, kept as the version the view writes on. */
export async function readStudentState(call: Call, session: DeclarationSession, assignmentId: string): Promise<StudentRead> {
  try {
    const result = await call("student.declaration.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!result.ok) return { kind: result.status === 401 ? "signedOut" : "unavailable" };
    session.states.set(assignmentId, result.body);
    return { kind: "ok", state: result.body };
  } catch {
    return { kind: "unavailable" };
  }
}

/**
 * Whether steps 3 and 4 may send (PIL-K-IZJAVA-VRATA, PRODUCT §5 rule 11, OD-6): read only from the
 * server, never from this browser (no sessionStorage, no `?izjava=`). `unavailable` is a failed read
 * and never opens sending; the server checks the declaration again when the work is submitted.
 */
export type DeclarationGate =
  | {
      readonly kind: "confirmed";
      /** WEB-NUZ-PREDAJA-1 (PR-2): `bound` once the declaration went with a submission. */
      readonly detail?: "confirmed" | "bound";
      readonly confirmedAt?: string | null;
      readonly form?: DeclarationFormRef | null;
    }
  /** The assignment asks for no declaration: the server holds no form and nothing declared. */
  | { readonly kind: "not_required" }
  /** Asked for, and not confirmed for the current revision (none, a draft, or stale). */
  | { readonly kind: "missing"; readonly detail?: "none" | "draft" | "stale"; readonly form?: DeclarationFormRef | null }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

/** The faculty's form the declaration is written on, as the server names it (OD-11). */
export type DeclarationFormRef = { readonly formId: string; readonly formVersion: number };

/** The words of one declaration state, the same everywhere the student sees it (PR-2, P-11). */
export type DeclarationDetail = "none" | "draft" | "stale" | "confirmed" | "bound";

/** The detail of a gate: which of the five states, or null when the gate names none. */
export function declarationDetailOf(gate: DeclarationGate): DeclarationDetail | null {
  if (gate.kind === "confirmed") return gate.detail ?? "confirmed";
  if (gate.kind === "missing") return gate.detail ?? null;
  return null;
}

/**
 * The gate as one read of student.declaration.get gives it. This is the one selector of the
 * declaration's state (WEB-NUZ-PREDAJA-1, PR-2): the steps of the submission, the rehearsal and
 * the workspace's top bar all read it, so none of them can say "confirmed" while another refuses.
 */
export function declarationGateFrom(state: StudentState): DeclarationGate {
  const form = formRefOf(state);
  const settled = state.state === "confirmed" || state.state === "bound";
  if (settled && state.payload !== null && state.currentRevision !== null && state.payload.revision === state.currentRevision) {
    return { kind: "confirmed", detail: state.state === "bound" ? "bound" : "confirmed", confirmedAt: state.payload.confirmedAt, form };
  }
  if (state.state === "none" && state.currentForm === null && state.draft === null && state.payload === null) return { kind: "not_required" };
  // The server says outright that the assignment asks for no declaration (G-11): nothing is missing.
  if (state.declarationRequired === false) return { kind: "not_required" };
  // A confirmation for an earlier revision is stale, whatever the server's own word for it.
  const detail = state.state === "stale" || (settled && state.payload !== null) ? "stale" : state.state === "draft" || state.draft !== null ? "draft" : "none";
  return { kind: "missing", detail, form };
}

function formRefOf(state: StudentState): DeclarationFormRef | null {
  const form = state.currentForm ?? state.payload?.form ?? null;
  return form === null ? null : { formId: form.formId, formVersion: form.formVersion };
}

/** Reads the gate from the server; anything but a read that matches the contract is `unavailable`. */
export async function readDeclarationGate(call: Call, assignmentId: string): Promise<DeclarationGate> {
  const read = await readStudentState(call, createDeclarationSession(), assignmentId);
  return read.kind === "ok" ? declarationGateFrom(read.state) : read;
}

const NO_HELP: WireHelp = { received: false, entries: [] };
const NO_AI: WireAi = { use: null, declaredTools: [], attachments: [], externalAttachmentIds: [] };

type Change = {
  readonly ownWork?: boolean; readonly humanHelp?: WireHelp; readonly ai?: Partial<Omit<WireAi, "attachments">>; readonly confirm?: boolean;
  /** NF-3 PR-20: set only by the answer's own write; every other write keeps the answer the server holds. */
  readonly questionAnswer?: AnswerWrite;
};

/**
 * The answer a write carries when it does not change it: the held one, while it answers the
 * question the server asks now. Without an answer the field is left out, as before PR-20.
 */
export function heldAnswer(state: StudentState): AnswerWrite | undefined {
  const answer = state.questionAnswer ?? null;
  const question = state.teacherQuestion ?? null;
  if (answer === null || question === null || answer.questionId !== question.questionId) return undefined;
  return { questionId: answer.questionId, text: answer.text };
}

/**
 * The next whole draft on top of `state`, or null when the server gives nothing to write on
 * (no current form or revision, or the work is submitted). The change replaces only its parts;
 * ai.attachments is always empty, as declaration-v1 has it (maxItems 0).
 */
export function nextDraft(state: StudentState, change: Change): PutBody | null {
  const form = state.currentForm;
  if (state.submitted || state.state === "bound" || form === null || state.currentRevision === null || state.currentRevision < 1) return null;
  const draft = state.draft;
  const help = change.humanHelp ?? draft?.humanHelp ?? NO_HELP;
  const ai = { ...(draft?.ai ?? NO_AI), ...change.ai };
  const answer = change.questionAnswer !== undefined ? change.questionAnswer : heldAnswer(state);
  return {
    baseVersion: state.version,
    revision: state.currentRevision,
    form: { formId: form.formId, formVersion: form.formVersion, formSha256: form.formSha256 },
    ownWork: { confirmed: change.ownWork ?? draft?.ownWork.confirmed ?? false },
    humanHelp: { received: help.received, entries: help.entries },
    ai: { use: ai.use, declaredTools: ai.declaredTools, attachments: [], externalAttachmentIds: ai.externalAttachmentIds },
    confirm: change.confirm ?? false,
    ...(answer === undefined ? {} : { questionAnswer: answer }),
  };
}

/** declaration-v1: at most this many external printouts in a draft (externalAttachmentIds maxItems). */
export const MAX_LINKED_PRINTOUTS = 10;

/**
 * The printouts a write links: the draft's, then every upload the server holds that the draft does
 * not name yet (also after a reload), then this view's newer ones, each once, within the limit.
 */
export function linkedUploads(state: StudentState, uploaded: readonly string[] = []): string[] {
  const held = state.uploads.map((u) => u.externalAttachmentId);
  return [...new Set([...(state.draft?.ai.externalAttachmentIds ?? []), ...held, ...uploaded])].slice(0, MAX_LINKED_PRINTOUTS);
}

/** The file name a printout is shown under: the contract keeps no original name. */
export function printoutName(id: string, format: "application/pdf" | "text/plain"): string {
  return `${id}${format === "application/pdf" ? ".pdf" : ".txt"}`;
}

export type DraftWrite =
  | { readonly kind: "saved"; readonly state: StudentState }
  | { readonly kind: "conflict" | "signedOut" | "readOnly" | "rejected" | "unavailable" }
  | { readonly kind: "refused"; readonly code: string };

/**
 * One PUT of a whole draft on the version this view read; with nothing read there is nothing to
 * write on. A saved draft becomes the view's version. A version 409 is a conflict; other 409s keep
 * their code (`refused`).
 */
export async function writeDraft(call: Call, session: DeclarationSession, assignmentId: string, change: Change): Promise<DraftWrite> {
  const state = session.states.get(assignmentId);
  if (state === undefined) return { kind: "unavailable" };
  const uploaded = session.uploaded.get(assignmentId) ?? [];
  const body = nextDraft(state, { ...change, ai: { ...change.ai, externalAttachmentIds: linkedUploads(state, uploaded) } });
  if (body === null) return { kind: state.submitted || state.state === "bound" ? "readOnly" : "unavailable" };
  let result: ApiResult<"student.declaration.put">;
  try {
    result = await call("student.declaration.put", { params: { assignmentId }, query: undefined, body });
  } catch {
    return { kind: "unavailable" };
  }
  if (result.ok) {
    session.states.set(assignmentId, result.body);
    session.uploaded.delete(assignmentId);
    return { kind: "saved", state: result.body };
  }
  if (result.status === 401) return { kind: "signedOut" };
  if (result.status === 0 || result.status === 422) return { kind: "rejected" };
  if (result.status === 409) {
    if (VERSION_CONFLICTS.has(result.code)) return { kind: "conflict" };
    if (result.code === "already_submitted") return { kind: "readOnly" };
    return { kind: "refused", code: result.code };
  }
  return { kind: "unavailable" };
}

export type DeclarationTarget = { readonly assignmentId: string; readonly studentId: string };

export type DeclarationPortOptions = {
  /** Which student's declaration a teacher's submission id names; without it the teacher read is unavailable. */
  readonly teacherTarget?: (submissionId: string) => DeclarationTarget | null;
  /** Shared with the view's StatementPort, so both write on the version the view read. */
  readonly session?: DeclarationSession;
};

/** The real DeclarationPort over declaration-v1 (PIL-K-IZJAVA-PORT). */
export function createDeclarationPort(call: Call = createApi(), options: DeclarationPortOptions = {}): DeclarationPort {
  const session = options.session ?? createDeclarationSession();
  // A second confirmation while one is on its way gets the same answer, not a second PUT.
  const confirming = new Map<string, Promise<ConfirmResult>>();

  async function confirmOnce(assignmentId: string, attachments: readonly Attachment[]): Promise<ConfirmResult> {
    const draft = session.states.get(assignmentId)?.draft ?? null;
    const tools = draft?.ai.declaredTools ?? [];
    // The reviewed conversations are not sent: declaration-v1 keeps ai.attachments empty.
    const use = draft?.ai.use ?? (tools.length > 0 || attachments.length > 0 ? "used" : "not_used");
    const write = await writeDraft(call, session, assignmentId, { ownWork: true, ai: { use }, confirm: true });
    switch (write.kind) {
      case "saved":
        return write.state.state === "confirmed" || write.state.state === "bound" ? { kind: "confirmed" } : { kind: "unavailable" };
      case "conflict":
      case "signedOut":
        return { kind: write.kind };
      case "refused":
        // The error body's conversationIds do not travel through createApi: every reviewed one is named.
        return write.code === "attachment_stale" ? { kind: "stale", conversationIds: attachments.map((a) => a.conversationId) } : { kind: "unavailable" };
      default:
        return { kind: "unavailable" };
    }
  }

  return {
    async readStudent(assignmentId) {
      const read = await readStudentState(call, session, assignmentId);
      if (read.kind !== "ok") return read;
      const ai = read.state.draft?.ai ?? read.state.payload?.ai ?? null;
      const uses = (ai?.declaredTools ?? []).map((t) => ({ purpose: t.purposeText, provider: t.toolLabel, phase: t.phaseText }));
      // The read carries no conversation text; the conversations come from the assistant's own route.
      if (uses.length === 0) return { kind: "no_use" };
      return { kind: "ready", uses, conversations: [] };
    },

    confirm(assignmentId, attachments) {
      const pending = confirming.get(assignmentId);
      if (pending !== undefined) return pending;
      const run = confirmOnce(assignmentId, attachments).finally(() => confirming.delete(assignmentId));
      confirming.set(assignmentId, run);
      return run;
    },

    async readTeacher(submissionId) {
      const target = options.teacherTarget?.(submissionId) ?? null;
      if (target === null) return { kind: "unavailable" };
      let result: ApiResult<"teacher.declaration.get">;
      try {
        result = await call("teacher.declaration.get", { params: { assignmentId: target.assignmentId, studentId: target.studentId }, query: undefined, body: undefined });
      } catch {
        return { kind: "unavailable" };
      }
      if (!result.ok) return { kind: result.status === 401 ? "signedOut" : "unavailable" };
      // Present only when the server gives them, so a read without a question is what it was before PR-20.
      const asked = result.body.question ?? null;
      const answered = result.body.questionAnswer ?? null;
      const qa: TeacherQuestionPart = { ...(asked === null ? {} : { question: asked }), ...(answered === null ? {} : { answer: answered }) };
      if (result.body.state === "none") return { kind: "pending", ...qa };
      const payload = result.body.payload;
      if (payload.ai.use === "not_used") return { kind: "no_use", confirmedAt: payload.confirmedAt, ...qa };
      return {
        ...qa,
        kind: "ready",
        confirmedAt: payload.confirmedAt,
        // The payload does not say whether the assistant was allowed; nothing is claimed off.
        assistantAllowed: true,
        uses: payload.ai.declaredTools.map((t) => ({ purpose: t.purposeText, provider: t.toolLabel, phase: t.phaseText })),
        transfers: [],
        conversations: [],
        external: payload.ai.attachments.map((a) => ({ id: a.externalAttachmentId, title: printoutName(a.externalAttachmentId, a.format) })),
      };
    },
  };
}
