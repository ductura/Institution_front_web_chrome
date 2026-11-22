// Student side of the interview preparation (SRV-1530, N-14). The route has no WEB extract yet, so
// the port is the smallest contract the page needs; the dev server and the tests answer through
// the fake. There is deliberately no field for an outcome, grade, sanction or suspicion.
export const NOTE_MAX_BYTES = 2 * 1024 * 1024;
export const NOTE_FORMATS = [".pdf", ".txt", ".md"] as const;

export type InterviewQuestion = { readonly id: string; readonly paragraphRef: string | null; readonly paragraphExcerpt?: string; readonly text: string };
export type InterviewSlot = { readonly kind: "consultation" | "free"; readonly place: string; readonly at: string };
export type InterviewExplanation = { readonly id: string; readonly questionId: string | null; readonly text: string };

export type InterviewRead =
  | { readonly kind: "ready"; readonly workTitle: string; readonly questions: readonly InterviewQuestion[];
      readonly slot: InterviewSlot | null; readonly heldAt: string | null; readonly explanations: readonly InterviewExplanation[];
      readonly attachments: readonly string[] }
  | { readonly kind: "notInvited" }
  | { readonly kind: "unavailable" };

export type InterviewWrite = { readonly kind: "saved" } | { readonly kind: "rejected" } | { readonly kind: "unavailable" };

export interface InterviewPort {
  read(documentId: string): Promise<InterviewRead>;
  explain(documentId: string, input: { readonly questionId: string | null; readonly text: string }): Promise<InterviewWrite>;
  attachNote(documentId: string, file: File): Promise<InterviewWrite>;
}
