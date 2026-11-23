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
 * nothing read to write on), which never stops a submission (PRODUCT §5 rule 11); `refused`: the
 * server answered and did not accept it.
 */
export type ConfirmOutcome = "saved" | "conflict" | "stale" | "signedOut" | "refused" | "technical";

export type StepPorts = {
  /** StudentStatement's port: its writes go on the version the step read. */
  readonly statement: StatementPort;
  read(assignmentId: string): Promise<StepRead>;
  confirm(assignmentId: string): Promise<ConfirmOutcome>;
};

const TECHNICAL = (status: number | null) => status === null || status === 0 || status >= 500;

/** The step's ports over `call` (createApi by default). */
export function createStepPorts(call: Call = createApi()): StepPorts {
  // One GET per refresh for both halves; the state and the last write's status the server gave.
  let held: Promise<unknown> | null = null;
  let state: string | null = null;
  let putStatus: number | null = null;
  const shared = (async (op: string, input: unknown) => {
    const send = () => (call as (op: string, input: unknown) => Promise<{ ok: boolean; status?: number; body?: { state?: string } }>)(op, input);
    if (op === "student.declaration.get") {
      held ??= send().then((result) => {
        state = result.ok ? result.body?.state ?? null : null;
        return result;
      });
      return held;
    }
    if (op !== "student.declaration.put") return send();
    putStatus = 0;
    const result = await send();
    putStatus = result.ok ? 200 : result.status ?? 0;
    if (result.ok) state = result.body?.state ?? null;
    return result;
  }) as Call;
  const ports = createDeclarationStepPorts(shared);

  return {
    statement: ports.statement,

    async read(assignmentId) {
      held = null;
      try {
        const [student, statement] = await Promise.all([ports.declaration.readStudent(assignmentId), ports.statement.read(assignmentId)]);
        if (student.kind === "signedOut" || statement.kind === "signedOut") return { kind: "signedOut" };
        return { kind: "read", view: viewOf(student, statement), statement, confirmed: state === "confirmed" || state === "bound" };
      } finally {
        held = null;
      }
    },

    async confirm(assignmentId) {
      putStatus = null;
      return outcomeOf(await ports.declaration.confirm(assignmentId, []), putStatus);
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
