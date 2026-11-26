// Probe port for the tests and the catalogue until declaration-v1 has a route. Invented data.
import type {
  AnswerWrite, AttachmentLimits, DeclaredTool, HumanHelp, QuestionAnswer, StatementPort, StatementRead, TeacherQuestion,
} from "../../../../../../src/client/statement.ts";

/** NF-3 PR-20: an invented teacher's question for the probe port. */
export const PROBE_QUESTION: TeacherQuestion = {
  questionId: "00000000-0000-4000-8000-0000000000e1", text: "Kako ste provjerili izmišljene izvore koje navodite u radu?",
};

export const PROBE_LIMITS: AttachmentLimits = {
  allowedFormats: [
    { mimeType: "application/pdf", extension: ".pdf" },
    { mimeType: "text/plain", extension: ".txt" },
  ],
  maxBytes: 5 * 1024 * 1024,
};

export function fakeStatementPort(submitted = false, question: TeacherQuestion | null = null): StatementPort & {
  readonly attached: string[]; readonly saved: HumanHelp[]; readonly answers: AnswerWrite[]; readonly toolLists: (readonly DeclaredTool[])[]; submit(): void;
} {
  let isSubmitted = submitted;
  let tools: readonly DeclaredTool[] = [];
  const toolLists: (readonly DeclaredTool[])[] = [];
  let answer: QuestionAnswer | null = null;
  const answers: AnswerWrite[] = [];
  let humanHelp: HumanHelp | null = null;
  let attachment: { name: string; bytes: number } | null = null;
  const attached: string[] = [];
  const saved: HumanHelp[] = [];
  return {
    attached, saved, answers, toolLists,
    submit() { isSubmitted = true; },
    async saveTools(_id, next) {
      if (isSubmitted) return { kind: "readOnly" };
      tools = next; toolLists.push(next); return { kind: "saved" };
    },
    async read(): Promise<StatementRead> {
      return {
        kind: "ready", statementText: "Izmišljeni tekst izjave sa servera.",
        helpKinds: ["none", "proofreading", "content", "other"], limits: PROBE_LIMITS,
        humanHelp, attachment, submitted: isSubmitted, question, answer, tools,
      };
    },
    async saveHumanHelp(_id, help) {
      if (isSubmitted) return { kind: "readOnly" };
      humanHelp = help; saved.push(help); return { kind: "saved" };
    },
    async saveAnswer(_id, next) {
      if (isSubmitted) return { kind: "readOnly" };
      if (question === null || (next !== null && next.questionId !== question.questionId)) return { kind: "rejected" };
      answers.push(next);
      answer = next === null ? null : { ...next, questionText: question.text };
      return { kind: "saved" };
    },
    async attachPrintout(_id, file) {
      if (isSubmitted) return { kind: "readOnly" };
      attachment = { name: file.name, bytes: file.size }; attached.push(file.name); return { kind: "saved" };
    },
  };
}
