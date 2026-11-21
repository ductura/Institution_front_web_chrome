/** One message of a conversation; `seq` is the server's order inside the conversation. */
export type DeclarationTurn = {
  readonly seq: number;
  readonly author: "student" | "assistant";
  readonly text: string;
};

/**
 * A conversation that can go with the declaration (ai-request-v1, „Pridruživanje izjavi”).
 * `reason` is `transfer` when text from it entered the work (transferred, or pasted with a
 * `known` verdict, even if that text was later deleted): such a conversation is required.
 * Every other conversation carries `student_added` and goes only if the student picks it.
 * `throughSeq` and `messagesSha256` describe the exact version shown; the server computes them.
 */
export type DeclarationConversation = {
  readonly conversationId: string;
  /** Preformatted, e.g. „Razgovor 1 · Lektura · 2. 11. 14:05”. */
  readonly title: string;
  readonly reason: "transfer" | "student_added";
  /** For a required conversation: where its text went, preformatted. */
  readonly requiredBecause?: string;
  /** Who answered, preformatted, e.g. „Asistent · Primjer d.o.o., Model A”. */
  readonly assistantName: string;
  readonly throughSeq: number;
  readonly messagesSha256: string;
  readonly turns: readonly DeclarationTurn[];
  /** The server reported `attachment_stale`: the conversation changed after this version. */
  readonly stale?: boolean;
};

/** What the confirmation sends for each attached conversation, exactly as shown. */
export type DeclarationAttachment = {
  readonly conversationId: string;
  readonly reason: "transfer" | "student_added";
  readonly throughSeq: number;
  readonly messagesSha256: string;
};

export function isRequired(conversation: DeclarationConversation): boolean {
  return conversation.reason === "transfer";
}

/** Required conversations, then the ones the student picked, in the given order. */
export function attachedConversations(
  conversations: readonly DeclarationConversation[],
  chosen: ReadonlySet<string>,
): DeclarationConversation[] {
  return conversations.filter((c) => isRequired(c) || chosen.has(c.conversationId));
}

/** Identifies the exact set of versions under review; any change asks for a new review. */
export function reviewKey(attached: readonly DeclarationConversation[]): string {
  return attached.map((c) => `${c.conversationId}:${c.throughSeq}:${c.messagesSha256}`).join("|");
}

export function confirmPayload(attached: readonly DeclarationConversation[]): DeclarationAttachment[] {
  return attached.map(({ conversationId, reason, throughSeq, messagesSha256 }) => ({
    conversationId,
    reason,
    throughSeq,
    messagesSha256,
  }));
}

/** Messages up to and including `throughSeq`; anything later is not part of the version. */
export function visibleTurns(conversation: DeclarationConversation): DeclarationTurn[] {
  return conversation.turns.filter((turn) => turn.seq <= conversation.throughSeq);
}
