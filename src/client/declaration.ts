// The AI part of the declaration (S31-AI, N-AI-ATT) behind a port. The declaration contract
// declaration-v1 (SRV-M75U) is not approved yet, so there is no route and no wire shape here:
// the types are the view's, and only the fake in declaration-fake.ts implements the port.

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
  | { readonly kind: "no_use" | "ai_disabled" | "unavailable" }
  | { readonly kind: "ready"; readonly uses: readonly DeclarationUse[]; readonly conversations: readonly StudentConversation[] };

export type ConfirmResult =
  | { readonly kind: "confirmed" }
  /** attachment_stale: these conversations changed after the version the student reviewed. */
  | { readonly kind: "stale"; readonly conversationIds: readonly string[] }
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

export type TeacherDeclarationRead =
  | { readonly kind: "pending" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "no_use"; readonly confirmedAt: string }
  | {
      readonly kind: "ready";
      readonly confirmedAt: string;
      readonly assistantAllowed: boolean;
      readonly uses: readonly DeclarationUse[];
      readonly transfers: readonly TeacherTransfer[];
      readonly conversations: readonly TeacherConversation[];
      readonly external: readonly ExternalConversation[];
    };

export interface DeclarationPort {
  readStudent(submissionId: string): Promise<StudentDeclarationRead>;
  confirm(submissionId: string, attachments: readonly Attachment[]): Promise<ConfirmResult>;
  readTeacher(submissionId: string): Promise<TeacherDeclarationRead>;
}
