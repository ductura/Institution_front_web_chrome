import type {
  Attachment,
  ConfirmResult,
  DeclarationPort,
  DeclarationUse,
  ExternalConversation,
  StudentConversation,
  StudentDeclarationRead,
  TeacherDeclarationRead,
  TeacherTransfer,
} from "./declaration";

/** One submission as the fake server holds it; all data is invented. */
export type FakeSubmission = {
  readonly assistantAllowed: boolean;
  readonly uses: readonly DeclarationUse[];
  readonly conversations: readonly StudentConversation[];
  readonly transfers?: readonly TeacherTransfer[];
  readonly external?: readonly ExternalConversation[];
  /** Where text from a conversation went, by conversation id. */
  readonly transferredNotes?: Readonly<Record<string, string>>;
  /** Preformatted confirmation time the fake stamps on a confirmation. */
  readonly confirmedAt: string;
};

/**
 * The only DeclarationPort until declaration-v1 is approved: used by tests and the catalogue.
 * It keeps state per submission, rejects a confirmation that leaves out a required conversation
 * or names a version that is not the current one, and gives the teacher only what was attached.
 */
export function createFakeDeclaration(submissions: Readonly<Record<string, FakeSubmission>>): DeclarationPort & {
  /** A new message in a conversation: the version the student reviewed is no longer current. */
  touch(submissionId: string, conversationId: string, messagesSha256: string): void;
} {
  const current = new Map(Object.entries(submissions).map(([id, s]) => [id, s.conversations]));
  const confirmed = new Map<string, readonly Attachment[]>();

  return {
    async readStudent(submissionId): Promise<StudentDeclarationRead> {
      const submission = submissions[submissionId];
      const conversations = current.get(submissionId);
      if (!submission || !conversations) return { kind: "unavailable" };
      if (!submission.assistantAllowed) return { kind: "ai_disabled" };
      if (submission.uses.length === 0 && conversations.length === 0) return { kind: "no_use" };
      return { kind: "ready", uses: submission.uses, conversations };
    },

    async confirm(submissionId, attachments): Promise<ConfirmResult> {
      const conversations = current.get(submissionId);
      if (!conversations) return { kind: "unavailable" };
      const byId = new Map(conversations.map((c) => [c.conversationId, c]));
      const sent = new Set(attachments.map((a) => a.conversationId));
      if (sent.size !== attachments.length) return { kind: "unavailable" };
      if (conversations.some((c) => c.reason === "transfer" && !sent.has(c.conversationId))) return { kind: "unavailable" };
      const stale: string[] = [];
      for (const a of attachments) {
        const c = byId.get(a.conversationId);
        if (!c || c.reason !== a.reason) return { kind: "unavailable" };
        if (c.throughSeq !== a.throughSeq || c.messagesSha256 !== a.messagesSha256) stale.push(a.conversationId);
      }
      if (stale.length > 0) return { kind: "stale", conversationIds: stale };
      confirmed.set(submissionId, attachments.map((a) => ({ ...a })));
      return { kind: "confirmed" };
    },

    async readTeacher(submissionId): Promise<TeacherDeclarationRead> {
      const submission = submissions[submissionId];
      const conversations = current.get(submissionId);
      if (!submission || !conversations) return { kind: "unavailable" };
      const attachments = confirmed.get(submissionId);
      if (!attachments) return { kind: "pending" };
      if (submission.assistantAllowed && submission.uses.length === 0 && attachments.length === 0) {
        return { kind: "no_use", confirmedAt: submission.confirmedAt };
      }
      const byId = new Map(conversations.map((c) => [c.conversationId, c]));
      return {
        kind: "ready",
        confirmedAt: submission.confirmedAt,
        assistantAllowed: submission.assistantAllowed,
        uses: submission.uses,
        transfers: submission.transfers ?? [],
        // Built from the confirmed attachments alone; nothing else about the work is read.
        conversations: attachments.map((a) => {
          const c = byId.get(a.conversationId)!;
          const note = submission.transferredNotes?.[a.conversationId];
          return {
            conversationId: a.conversationId,
            title: c.title,
            reason: a.reason,
            assistantName: c.assistantName,
            throughSeq: a.throughSeq,
            turns: c.turns.filter((t) => t.seq <= a.throughSeq),
            ...(note === undefined ? {} : { transferredNote: note }),
          };
        }),
        external: submission.external ?? [],
      };
    },

    touch(submissionId, conversationId, messagesSha256) {
      const conversations = current.get(submissionId);
      if (!conversations) return;
      current.set(submissionId, conversations.map((c) => (c.conversationId === conversationId
        ? { ...c, throughSeq: c.throughSeq + 1, messagesSha256, turns: [...c.turns, { seq: c.throughSeq + 1, author: "student" as const, text: "Nova izmišljena poruka." }] }
        : c)));
    },
  };
}
