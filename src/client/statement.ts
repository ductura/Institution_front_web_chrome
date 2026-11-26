// The human-help statement and the attached conversation printout of the declaration step
// (WEB-1503; plan M7.5, R-09, R-10, D-77) behind a port, and its real adapter over declaration-v1
// (PIL-K-IZJAVA-PORT): read is student.declaration.get, saveHumanHelp the same whole-draft PUT
// with only humanHelp changed, attachPrintout student.declaration-attachments.post. The page
// that mounts the view passes the port; the help kinds and limits are the contract's (OD-4, OD-12).
// The client comes through the declaration adapter, so this file names no API module itself.
import {
  browserTransport, createApi, createDeclarationPort, createDeclarationSession, printoutName, readStudentState, responseMatches,
  writeDraft, type AnswerWrite, type Call, type DeclarationPort, type DeclarationPortOptions, type DeclarationSession,
  type QuestionAnswer, type TeacherQuestion,
} from "./declaration";

export type { AnswerWrite, QuestionAnswer, TeacherQuestion };
import migrationContracts from "./migration-contracts.generated.json" with { type: "json" };

/** Closed set of kinds of human help (OD-12). The server may name fewer, never others. */
export type HumanHelpKind = "none" | "proofreading" | "content" | "other";

export type HumanHelp = { readonly kind: HumanHelpKind; readonly text: string };

/** What the server allows an attachment to be; the client only mirrors it to refuse early. */
export type AttachmentLimits = {
  readonly allowedFormats: readonly { readonly mimeType: string; readonly extension: string }[];
  readonly maxBytes: number;
};

export type StatementRead =
  | {
      readonly kind: "ready";
      /** The wording the student confirms, as the server holds it. */
      readonly statementText: string;
      readonly helpKinds: readonly HumanHelpKind[];
      readonly limits: AttachmentLimits;
      readonly humanHelp: HumanHelp | null;
      readonly attachment: { readonly name: string; readonly bytes: number } | null;
      /** Set after the work is submitted: everything is then read only. */
      readonly submitted: boolean;
      /** NF-3 PR-20: the teacher's question beside the declaration; null when none was asked. */
      readonly question: TeacherQuestion | null;
      /** The student's answer the server holds; null when there is none. */
      readonly answer: QuestionAnswer | null;
      /** ED-12 (NF2-P12): the tools outside Ductura the student declared (ai.declaredTools); absent where the port keeps none. */
      readonly tools?: readonly DeclaredTool[];
    }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export type StatementWrite =
  | { readonly kind: "saved" }
  | { readonly kind: "rejected" }
  /** The declaration changed on the server since it was read (409, B-6): nothing was saved. */
  | { readonly kind: "conflict" }
  | { readonly kind: "readOnly" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export type StatementFile = { readonly name: string; readonly type: string; readonly size: number };

export interface StatementPort {
  read(assignmentId: string): Promise<StatementRead>;
  saveHumanHelp(assignmentId: string, help: HumanHelp): Promise<StatementWrite>;
  attachPrintout(assignmentId: string, file: File): Promise<StatementWrite>;
  /** The answer to the teacher's question on the same draft (null takes it back); the answer is not obligatory. */
  saveAnswer(assignmentId: string, answer: AnswerWrite): Promise<StatementWrite>;
  /** ED-12 (NF2-P12): the whole list of tools outside Ductura on the same draft; a port without it shows no list. */
  saveTools?(assignmentId: string, tools: readonly DeclaredTool[]): Promise<StatementWrite>;
}

/** One tool outside Ductura, as the student declares it: the tool, what for, and in which phase of the work. */
export type DeclaredTool = { readonly tool: string; readonly purpose: string; readonly phase: string };

/** declaration-v1 (ai.declaredTools): at most this many tools, each field this many code points; the server checks again. */
export const TOOLS_MAX = 20;
export const TOOL_FIELD_MAX = 200;

export type FileCheck =
  | { readonly kind: "ok" }
  | { readonly kind: "format" }
  | { readonly kind: "tooLarge" }
  | { readonly kind: "empty" };

/** Refuses a printout before anything is sent: format first, then size against the server's limit. */
export function checkPrintout(file: StatementFile, limits: AttachmentLimits): FileCheck {
  const name = file.name.toLowerCase();
  const allowed = limits.allowedFormats.some((f) =>
    f.mimeType === file.type && name.endsWith(f.extension.toLowerCase()));
  if (!allowed) return { kind: "format" };
  if (file.size <= 0) return { kind: "empty" };
  if (file.size > limits.maxBytes) return { kind: "tooLarge" };
  return { kind: "ok" };
}

// ---------------------------------------------------------------------------
// The adapter. The port's help kinds are the view's; the wire's closed set (OD-12) is wider.

type WireKind = "language" | "structure" | "sources" | "content" | "technical" | "other";
const TO_WIRE: Readonly<Record<Exclude<HumanHelpKind, "none">, WireKind>> = { proofreading: "language", content: "content", other: "other" };
const FROM_WIRE: Readonly<Record<WireKind, Exclude<HumanHelpKind, "none">>> = {
  language: "proofreading", content: "content", structure: "other", sources: "other", technical: "other", other: "other",
};

/** OD-4: the printout limits of declaration-v1, named; the server checks them again. */
export const PRINTOUT_MAX_BYTES = 2 * 1024 * 1024;
export const PRINTOUT_LIMITS: AttachmentLimits = {
  allowedFormats: [{ mimeType: "application/pdf", extension: ".pdf" }, { mimeType: "text/plain", extension: ".txt" }],
  maxBytes: PRINTOUT_MAX_BYTES,
};
const HELP_KINDS: readonly HumanHelpKind[] = ["none", "proofreading", "content", "other"];
const UPLOAD = migrationContracts["student.declaration-attachments.post"];

export type StatementPortOptions = {
  readonly baseUrl?: string;
  /** Transport of the printout upload, for tests; api.ts's browserTransport by default. */
  readonly transport?: typeof browserTransport;
  /** Shared with the view's DeclarationPort, so both write on the version the view read. */
  readonly session?: DeclarationSession;
};

/** The real StatementPort over declaration-v1. */
export function createStatementPort(call: Call = createApi(), options: StatementPortOptions = {}): StatementPort {
  const session = options.session ?? createDeclarationSession();
  return {
    async read(assignmentId) {
      const read = await readStudentState(call, session, assignmentId);
      if (read.kind !== "ok") return read;
      const state = read.state;
      const statementText = state.currentForm?.text ?? state.formText;
      if (statementText === null) return { kind: "unavailable" };
      const help = state.draft?.humanHelp ?? state.payload?.humanHelp ?? null;
      const first = help?.received ? help.entries[0] : undefined;
      const upload = state.uploads.at(-1);
      return {
        kind: "ready",
        statementText,
        helpKinds: HELP_KINDS,
        limits: PRINTOUT_LIMITS,
        humanHelp: help === null ? null : first === undefined ? { kind: "none", text: "" } : { kind: FROM_WIRE[first.kind], text: first.text },
        attachment: upload === undefined ? null : { name: printoutName(upload.externalAttachmentId, upload.format), bytes: upload.byteLength },
        submitted: state.submitted || state.state === "bound",
        question: state.teacherQuestion ?? null,
        answer: state.questionAnswer ?? null,
        tools: (state.draft?.ai ?? state.payload?.ai ?? null)?.declaredTools
          .map((t) => ({ tool: t.toolLabel, purpose: t.purposeText, phase: t.phaseText })) ?? [],
      };
    },

    async saveTools(assignmentId, tools) {
      const declaredTools = tools.map((t) => ({ toolLabel: t.tool, purposeText: t.purpose, phaseText: t.phase }));
      // A listed tool means tools were used; an empty list leaves the declared use as it is.
      const write = await writeDraft(call, session, assignmentId, { ai: declaredTools.length > 0 ? { use: "used", declaredTools } : { declaredTools } });
      if (write.kind === "refused") return { kind: "rejected" };
      return { kind: write.kind };
    },

    async saveAnswer(assignmentId, answer) {
      const write = await writeDraft(call, session, assignmentId, { questionAnswer: answer });
      if (write.kind === "refused") return { kind: "rejected" };
      return { kind: write.kind };
    },

    async saveHumanHelp(assignmentId, help) {
      const text = help.text.trim();
      if (help.kind !== "none" && text === "") return { kind: "rejected" };
      const humanHelp = help.kind === "none"
        ? { received: false, entries: [] }
        : { received: true, entries: [{ kind: TO_WIRE[help.kind], text }] };
      const write = await writeDraft(call, session, assignmentId, { humanHelp });
      if (write.kind === "refused") return { kind: "rejected" };
      return { kind: write.kind };
    },

    async attachPrintout(assignmentId, file) {
      // Refused before anything is sent: wrong format, empty or over the limit (OD-4).
      if (checkPrintout(file, PRINTOUT_LIMITS).kind !== "ok") return { kind: "rejected" };
      const path = UPLOAD.path.replace("{assignmentId}", encodeURIComponent(assignmentId));
      const transport = options.transport ?? browserTransport;
      try {
        const res = await transport(new URL(path, options.baseUrl ?? globalThis.location.origin), {
          method: UPLOAD.method, redirect: "manual", headers: { "content-type": file.type }, body: file,
        });
        if (res.status === 401) return { kind: "signedOut" };
        if (res.status === 409) return { kind: await conflictOf(res) };
        if (res.status === 413 || res.status === 415 || res.status === 422) return { kind: "rejected" };
        if (res.status !== 200 || !res.headers.get("content-type")?.startsWith("application/json")) return { kind: "unavailable" };
        const bytes = await res.arrayBuffer();
        const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
        if (!responseMatches("student.declaration-attachments.post", 200, body, bytes.byteLength)) return { kind: "unavailable" };
        // Linked to the draft by the view's next write, after what the draft already names.
        const id = (body as { externalAttachmentId: string }).externalAttachmentId;
        session.uploaded.set(assignmentId, [...(session.uploaded.get(assignmentId) ?? []), id]);
        return { kind: "saved" };
      } catch {
        return { kind: "unavailable" };
      }
    },
  };
}

/** A 409 of the upload by its code: a conflict, a submitted work, a refused attachment; anything else is unknown. */
async function conflictOf(res: Response): Promise<"conflict" | "readOnly" | "rejected" | "unavailable"> {
  let code: unknown;
  try {
    code = (JSON.parse(await res.text()) as { code?: unknown }).code;
  } catch {
    code = undefined;
  }
  if (code === "already_submitted") return "readOnly";
  if (code === "too_many_attachments" || code === "attachments_too_large") return "rejected";
  return code === "conflict" ? "conflict" : "unavailable";
}

/** Both ports of one view's declaration step, on one session: each writes on the version the view read. */
export function createDeclarationStepPorts(
  call: Call = createApi(), options: Omit<DeclarationPortOptions & StatementPortOptions, "session"> = {},
): { readonly declaration: DeclarationPort; readonly statement: StatementPort } {
  const session = createDeclarationSession();
  return { declaration: createDeclarationPort(call, { ...options, session }), statement: createStatementPort(call, { ...options, session }) };
}
