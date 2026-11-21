// Probe port for the tests and the catalogue until declaration-v1 has a route. Invented data.
import type {
  AttachmentLimits, HumanHelp, StatementPort, StatementRead,
} from "../../../../../../src/client/statement.ts";

export const PROBE_LIMITS: AttachmentLimits = {
  allowedFormats: [
    { mimeType: "application/pdf", extension: ".pdf" },
    { mimeType: "text/plain", extension: ".txt" },
  ],
  maxBytes: 5 * 1024 * 1024,
};

export function fakeStatementPort(submitted = false): StatementPort & { readonly attached: string[]; readonly saved: HumanHelp[]; submit(): void } {
  let isSubmitted = submitted;
  let humanHelp: HumanHelp | null = null;
  let attachment: { name: string; bytes: number } | null = null;
  const attached: string[] = [];
  const saved: HumanHelp[] = [];
  return {
    attached, saved,
    submit() { isSubmitted = true; },
    async read(): Promise<StatementRead> {
      return {
        kind: "ready", statementText: "Izmišljeni tekst izjave sa servera.",
        helpKinds: ["none", "proofreading", "content", "other"], limits: PROBE_LIMITS,
        humanHelp, attachment, submitted: isSubmitted,
      };
    },
    async saveHumanHelp(_id, help) {
      if (isSubmitted) return { kind: "readOnly" };
      humanHelp = help; saved.push(help); return { kind: "saved" };
    },
    async attachPrintout(_id, file) {
      if (isSubmitted) return { kind: "readOnly" };
      attachment = { name: file.name, bytes: file.size }; attached.push(file.name); return { kind: "saved" };
    },
  };
}
