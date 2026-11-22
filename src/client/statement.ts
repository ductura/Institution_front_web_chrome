// The human-help statement and the attached conversation printout of the declaration step
// (WEB-1503; plan M7.5, R-09, R-10, D-77) behind a port, and its real adapter over declaration-v1
// (PIL-K-IZJAVA-PORT): read is student.declaration.get, saveHumanHelp the same whole-draft PUT
// with only humanHelp changed, attachPrintout student.declaration-attachments.post. The page
// that mounts the view passes the port; the help kinds and limits are the contract's (OD-4, OD-12).
// The client comes through the declaration adapter, so this file names no API module itself.
import {
  browserTransport, createApi, linkedUploads, nextDraft, putDraft, readStudentState, responseMatches, type Call,
} from "./declaration";
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
}

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
const EXTENSION: Readonly<Record<string, string>> = { "application/pdf": ".pdf", "text/plain": ".txt" };
const UPLOAD = migrationContracts["student.declaration-attachments.post"];

export type StatementPortOptions = {
  readonly baseUrl?: string;
  /** Transport of the printout upload, for tests; api.ts's browserTransport by default. */
  readonly transport?: typeof browserTransport;
};

/** The real StatementPort over declaration-v1. */
export function createStatementPort(call: Call = createApi(), options: StatementPortOptions = {}): StatementPort {
  return {
    async read(assignmentId) {
      const read = await readStudentState(call, assignmentId);
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
        attachment: upload === undefined ? null : { name: `${upload.externalAttachmentId}${EXTENSION[upload.format] ?? ""}`, bytes: upload.byteLength },
        submitted: state.submitted || state.state === "bound",
      };
    },

    async saveHumanHelp(assignmentId, help) {
      const read = await readStudentState(call, assignmentId);
      if (read.kind !== "ok") return read;
      const text = help.text.trim();
      if (help.kind !== "none" && text === "") return { kind: "rejected" };
      const humanHelp = help.kind === "none"
        ? { received: false, entries: [] }
        : { received: true, entries: [{ kind: TO_WIRE[help.kind], text }] };
      const body = nextDraft(read.state, { humanHelp, ai: { externalAttachmentIds: linkedUploads(read.state) } });
      if (body === null) return { kind: read.state.submitted || read.state.state === "bound" ? "readOnly" : "unavailable" };
      const write = await putDraft(call, assignmentId, body);
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
        return responseMatches("student.declaration-attachments.post", 200, body, bytes.byteLength) ? { kind: "saved" } : { kind: "unavailable" };
      } catch {
        return { kind: "unavailable" };
      }
    },
  };
}

/** A 409 of the upload by its code: a version conflict, a submitted work or a refused attachment. */
async function conflictOf(res: Response): Promise<"conflict" | "readOnly" | "rejected"> {
  let code: unknown;
  try {
    code = (JSON.parse(await res.text()) as { code?: unknown }).code;
  } catch {
    code = undefined;
  }
  if (code === "already_submitted") return "readOnly";
  if (code === "too_many_attachments" || code === "attachments_too_large") return "rejected";
  return "conflict";
}
