// The human-help statement and the attached conversation printout of the declaration step
// (WEB-1503; plan M7.5, R-09, R-10, D-77). declaration-v1 (SRV-1210..1214) has no route in this
// repo yet, so this is the smallest contract the plan implies, behind a port: the statement text,
// the closed set of help kinds and the attachment limits all come from the server (OD-4, OD-12).
// Nothing here sends a request; the page that mounts the view passes the real port.

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
