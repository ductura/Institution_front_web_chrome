// PIL-K-IZJAVA: the declaration step on declaration-v1, through src/client only. Both halves of the
// step (the AI part and StudentStatement) are the two ports of one createDeclarationStepPorts, so
// they write on one session; one refresh reads student.declaration.get once for both, so both show
// the same version and neither writes on a version the other has already replaced (no 409 between them).
import { createApi } from "../../../../../../../src/client/api.ts";
import type { ConfirmResult, StudentDeclarationRead } from "../../../../../../../src/client/declaration.ts";
import { createDeclarationStepPorts, type StatementPort, type StatementRead } from "../../../../../../../src/client/statement.ts";
import { statementMessages } from "../../statement/messages.hr";
import { declarationStepText as t } from "./messages.hr";
import type { DeclarationRead, Declared } from "./model";

type Call = ReturnType<typeof createApi>;

/** What one refresh of the step read: both halves of one answer of the server. */
export type StepRead =
  | { readonly kind: "signedOut" }
  | {
      readonly kind: "read";
      readonly view: DeclarationRead;
      readonly statement: StatementRead;
      /** The server holds a confirmed (or bound) declaration: only this opens "Dalje". */
      readonly confirmed: boolean;
    };

/**
 * How a confirmation ended. `technical`: the server could not be reached or failed (0, 5xx, or
 * nothing read to write on); `refused`: the server answered and did not accept it. Neither opens
 * "Dalje": only a confirmation the server holds does.
 */
export type ConfirmOutcome = "saved" | "conflict" | "stale" | "signedOut" | "refused" | "technical";

export type StepPorts = {
  /** StudentStatement's port: its writes go on the version the step read. */
  readonly statement: StatementPort;
  read(assignmentId: string): Promise<StepRead>;
  confirm(assignmentId: string): Promise<ConfirmOutcome>;
};

const TECHNICAL = (status: number | null) => status === null || status === 0 || status >= 500;

type Answer = { readonly ok: boolean; readonly status?: number; readonly body?: { readonly state?: string } };

/** The step's ports over `call` (createApi by default). */
export function createStepPorts(call: Call = createApi()): StepPorts {
  const send = call as unknown as (op: string, input: unknown) => Promise<Answer>;
  // The GET of the refresh that is running: both halves get this one answer.
  let held: Promise<Answer> | null = null;
  // The status of the confirming PUT (confirm: true). The port sends at most one at a time.
  let confirmStatus: number | null = null;
  const shared = (async (op: string, input: unknown) => {
    if (op === "student.declaration.get" && held !== null) return held;
    if (op !== "student.declaration.put" || (input as { body?: { confirm?: boolean } }).body?.confirm !== true) return send(op, input);
    confirmStatus = 0;
    const result = await send(op, input);
    confirmStatus = result.ok ? 200 : result.status ?? 0;
    return result;
  }) as Call;
  const ports = createDeclarationStepPorts(shared);

  return {
    statement: ports.statement,

    async read(assignmentId) {
      const own = send("student.declaration.get", { params: { assignmentId }, query: undefined, body: undefined });
      held = own;
      try {
        const [student, statement, answer] = await Promise.all([
          ports.declaration.readStudent(assignmentId), ports.statement.read(assignmentId), own.catch((): Answer => ({ ok: false })),
        ]);
        if (student.kind === "signedOut" || statement.kind === "signedOut") return { kind: "signedOut" };
        const state = answer.ok ? answer.body?.state : undefined;
        return { kind: "read", view: viewOf(student, statement), statement, confirmed: state === "confirmed" || state === "bound" };
      } finally {
        if (held === own) held = null;
      }
    },

    async confirm(assignmentId) {
      confirmStatus = null;
      const result = await ports.declaration.confirm(assignmentId, []);
      return outcomeOf(result, confirmStatus);
    },
  };
}

export function outcomeOf(result: ConfirmResult, putStatus: number | null): ConfirmOutcome {
  switch (result.kind) {
    case "confirmed": return "saved";
    case "conflict":
    case "stale":
    case "signedOut":
      return result.kind;
    case "unavailable":
      return TECHNICAL(putStatus) ? "technical" : "refused";
  }
}

const joined = (parts: readonly string[]) => parts.filter((p) => p !== "").join(", ");

/**
 * The step's view of the two halves. The server's read carries no record of transfers, no
 * conversation text and no teacher's question (declaration-v1), so those blocks are empty; the
 * declared part is what the draft or the bound declaration holds, and null when there is neither.
 */
export function viewOf(student: StudentDeclarationRead, statement: StatementRead): DeclarationRead {
  if (statement.kind !== "ready" || (student.kind !== "ready" && student.kind !== "no_use" && student.kind !== "ai_disabled")) return { kind: "error" };
  const help = statement.humanHelp;
  let declared: Declared | null = null;
  if (help !== null) {
    const uses = student.kind === "ready" ? student.uses : [];
    declared = {
      form: uses.length > 0 ? "used" : "no_use",
      tools: joined(uses.map((u) => u.provider)) || t.noTools,
      purpose: joined(uses.map((u) => u.purpose)) || t.noValue,
      phase: joined(uses.map((u) => u.phase)) || t.noValue,
      humanHelp: help.kind === "none"
        ? { kind: "none", text: statementMessages.helpKinds.none }
        : { kind: "other", text: `${statementMessages.helpKinds[help.kind]}: ${help.text}` },
    };
  }
  return { kind: "ready", recorded: [], declared, chats: [], question: null };
}
