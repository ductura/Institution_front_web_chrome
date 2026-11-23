// The view's model of E-9 "Izjava" and PD-2 "Razgovor N" (WEB-2107). The host reads it from
// declaration-v1 through step-ports.ts (PIL-K-IZJAVA); only tests and the catalogue pass a fake.
import { chatDialogText, declarationStepText as t } from "./messages.hr";

export type RecordedItem =
  | { readonly kind: "transfer"; readonly at: string; readonly model: string; readonly target: string }
  | { readonly kind: "chat"; readonly date: string; readonly model: string };

export type ChatEntry = {
  readonly who: "you" | "ai" | "transfer";
  readonly time: string;
  /** Model of an "ai" entry. */
  readonly model?: string;
  readonly text: string;
};

export type Chat = {
  readonly n: number;
  readonly date: string;
  /** Text from it entered the work: it cannot be left out. */
  readonly required: boolean;
  readonly entries: readonly ChatEntry[];
};

export type FormChoice = "no_use" | "used";

/** OD-12: the human help is a closed kind with a free text. */
export type Declared = {
  readonly form: FormChoice;
  readonly tools: string;
  readonly purpose: string;
  readonly phase: string;
  readonly humanHelp: { readonly kind: "none" | "colleague" | "other"; readonly text: string };
};

export type DeclarationRead =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | {
      readonly kind: "ready";
      readonly recorded: readonly RecordedItem[];
      readonly declared: Declared | null;
      readonly chats: readonly Chat[];
      /** The teacher's question; null when the teacher asked none. */
      readonly question: string | null;
    };

export type DeclarationReader = (assignmentId: string) => Promise<DeclarationRead>;

export const ANSWER_MAX_LENGTH = 1000;

/** What the page shows: the work's state first, then what was read. */
export type StepView = "notStarted" | "submitted" | "loading" | "error" | "empty" | "full";

export function stepView(workState: string, read: DeclarationRead): StepView {
  if (workState === "not_started") return "notStarted";
  if (workState === "submitted") return "submitted";
  if (read.kind !== "ready") return read.kind;
  return read.recorded.length === 0 && read.chats.length === 0 ? "empty" : "full";
}

/** The transfer the record holds, which the "no use" form contradicts. */
export function mismatchTarget(recorded: readonly RecordedItem[], form: FormChoice): string | null {
  if (form !== "no_use") return null;
  const transfer = recorded.find((item) => item.kind === "transfer");
  return transfer?.kind === "transfer" ? transfer.target : null;
}

export function mismatchText(target: string): string {
  return t.mismatch.replace("{target}", target);
}

export function chatTitle(chat: Pick<Chat, "n" | "date">): string {
  return chatDialogText.title.replace("{n}", String(chat.n)).replace("{date}", chat.date);
}

export function entryLabel(entry: ChatEntry): string {
  const who = entry.who === "you" ? chatDialogText.you
    : entry.who === "ai" ? chatDialogText.ai.replace("{model}", entry.model ?? "")
      : chatDialogText.transfer;
  return `${who} · ${entry.time}`;
}

/** Where the confirmation stands: `saved` only once the server holds it (step-ports.ts). */
export type ConfirmState = "none" | "sending" | "saved" | "conflict" | "stale" | "refused" | "technical";

/**
 * "Dalje" is open only once the server holds the confirmation (R-32). A technical error never stops
 * a submission (PRODUCT §5 rule 11): a confirmation that could not reach the server opens it too,
 * shown as not saved.
 */
export function canProceed(view: StepView, confirm: ConfirmState): boolean {
  return (confirm === "saved" || confirm === "technical") && (view === "full" || view === "empty" || view === "error");
}

/** The line under the confirmation for each state; null when there is nothing to say. */
export function confirmLine(confirm: ConfirmState): { readonly role: "status" | "alert"; readonly text: string } | null {
  switch (confirm) {
    case "none": case "saved": return null;
    case "sending": return { role: "status", text: t.confirming };
    case "conflict": return { role: "alert", text: t.conflict };
    case "stale": return { role: "alert", text: t.stale };
    case "refused": return { role: "alert", text: t.confirmRefused };
    case "technical": return { role: "alert", text: t.confirmTechnical };
  }
}

export function recordedLine(item: RecordedItem): { readonly line: string; readonly who: string } {
  return item.kind === "transfer"
    ? { line: t.transferLine.replace("{at}", item.at), who: t.transferWho.replace("{model}", item.model).replace("{target}", item.target) }
    : { line: t.chatLine.replace("{date}", item.date), who: t.chatWho.replace("{model}", item.model) };
}
