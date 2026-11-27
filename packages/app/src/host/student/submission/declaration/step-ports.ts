// PIL-K-IZJAVA: the declaration step on declaration-v1, through src/client only. Both halves of the
// step (the AI part and StudentStatement) are the two ports of one session, so they write on one
// version; one refresh reads the declaration once for both, so both show the same version and
// neither writes on a version the other has already replaced (no 409 between them).
//
// F4-PRE-R02: the step reads the student's Asistent conversations and attaches them on declaration-v2
// (Institution_server#890). The extract has student.declaration-second.*, so every read and write of the
// step goes through v2, and each write keeps the attachments the server holds (the v1 draft builder sends
// none). A client that does not know the operations rejects them without a request; the step then stays
// on v1 and offers no attaching.
import { createApi } from "../../../../../../../src/client/api.ts";
import {
  conversationRef, readConversationMessages, readConversations, readSecond, withRef,
  type ConversationRef, type ConversationsRead, type SecondCall,
} from "../../../../../../../src/client/declaration-attachments.ts";
import {
  createDeclarationPort, createDeclarationSession, writeDraft, type ConfirmResult, type StudentDeclarationRead,
} from "../../../../../../../src/client/declaration.ts";
import { createStatementPort, type StatementPort, type StatementRead } from "../../../../../../../src/client/statement.ts";
import { statementMessages } from "../../statement/messages.hr";
import { dateOf } from "../submit/model";
import { declarationStepText as t } from "./messages.hr";
import type { Chat, ChatEntry, DeclarationRead, Declared } from "./model";

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

/** F4-PRE-R02: how attaching or taking off one conversation ended. */
export type AttachOutcome = "saved" | "conflict" | "stale" | "signedOut" | "unavailable";

export type StepPorts = {
  /** StudentStatement's port: its writes go on the version the step read. */
  readonly statement: StatementPort;
  read(assignmentId: string): Promise<StepRead>;
  confirm(assignmentId: string): Promise<ConfirmOutcome>;
  /** F4-PRE-R02: the messages of one conversation for PD-2; null when they cannot be read. */
  chat?(conversationId: string): Promise<readonly ChatEntry[] | null>;
  /** F4-PRE-R02: attach (`true`) or take off one conversation, on the version the step read. */
  attach?(assignmentId: string, conversationId: string, on: boolean): Promise<AttachOutcome>;
};

const TECHNICAL = (status: number | null) => status === null || status === 0 || status >= 500;

type Answer = { readonly ok: boolean; readonly status?: number; readonly code?: string; readonly body?: { readonly state?: string } };
type Input = { readonly params: { readonly assignmentId: string }; readonly query?: undefined; readonly body?: unknown };

const V1_GET = "student.declaration.get";
const V1_PUT = "student.declaration.put";

/** The step's ports over `call` (createApi by default). */
export function createStepPorts(call: Call = createApi()): StepPorts {
  const send = call as unknown as (op: string, input: unknown) => Promise<Answer>;
  // The v2 shapes stay local (SecondCall) until the WEB part takes the extract's types.
  const second = call as unknown as SecondCall;
  // Whether the client knows declaration-v2: unknown until the first read tries it.
  let onSecond: boolean | null = null;
  // The refs the server holds, by assignment, from the last v2 answer.
  const refs = new Map<string, readonly ConversationRef[]>();
  // The refs the next write sends instead of the held ones (attaching), and only that write.
  let pending: readonly ConversationRef[] | null = null;
  // The GET of the refresh that is running: both halves get this one answer.
  let held: Promise<Answer> | null = null;
  // The status of the confirming PUT (confirm: true). The port sends at most one at a time.
  let confirmStatus: number | null = null;

  async function getDeclaration(assignmentId: string): Promise<Answer> {
    if (onSecond !== false) {
      const read = await readSecond(second, assignmentId);
      if (read.kind !== "unsupported") {
        onSecond = true;
        if (read.kind === "ready") {
          refs.set(assignmentId, read.refs);
          return { ok: true, status: 200, body: read.body as Answer["body"] };
        }
        return { ok: false, status: read.kind === "signedOut" ? 401 : 0, code: read.kind };
      }
      onSecond = false;
    }
    return send(V1_GET, { params: { assignmentId }, query: undefined, body: undefined });
  }

  async function put(input: Input): Promise<Answer> {
    if (onSecond !== true) return send(V1_PUT, input);
    const assignmentId = input.params.assignmentId;
    const body = input.body as { readonly ai: Record<string, unknown> };
    const attachments = pending ?? refs.get(assignmentId) ?? [];
    const answer = await second("student.declaration-second.put", { ...input, query: undefined, body: { ...body, ai: { ...body.ai, attachments } } });
    if (answer.ok) refs.set(assignmentId, attachments);
    return answer as Answer;
  }

  const shared = (async (op: string, input: Input) => {
    if (op === V1_GET) return held ?? getDeclaration(input.params.assignmentId);
    if (op !== V1_PUT) return send(op, input);
    if ((input.body as { confirm?: boolean } | undefined)?.confirm !== true) return put(input);
    confirmStatus = 0;
    const result = await put(input);
    confirmStatus = result.ok ? 200 : result.status ?? 0;
    return result;
  }) as unknown as Call;
  const session = createDeclarationSession();
  const declaration = createDeclarationPort(shared, { session });
  const statement = createStatementPort(shared, { session });

  return {
    statement,

    async read(assignmentId) {
      const own = getDeclaration(assignmentId);
      held = own;
      try {
        const [student, read, answer, list] = await Promise.all([
          declaration.readStudent(assignmentId), statement.read(assignmentId), own.catch((): Answer => ({ ok: false })),
          readConversations(call, assignmentId),
        ]);
        if (student.kind === "signedOut" || read.kind === "signedOut") return { kind: "signedOut" };
        const state = answer.ok ? answer.body?.state : undefined;
        const attached = onSecond === true && answer.ok ? refs.get(assignmentId) ?? null : null;
        return { kind: "read", view: viewOf(student, read, chatsOf(list, attached)), statement: read, confirmed: state === "confirmed" || state === "bound" };
      } finally {
        if (held === own) held = null;
      }
    },

    async confirm(assignmentId) {
      confirmStatus = null;
      const result = await declaration.confirm(assignmentId, []);
      return outcomeOf(result, confirmStatus);
    },

    async chat(conversationId) {
      const messages = await readConversationMessages(call, conversationId);
      return messages === null ? null : messages.map((m) => ({
        who: m.role === "student_paragraph" ? "you" : "ai", time: dateOf(m.createdAt).time, text: m.content,
      }));
    },

    async attach(assignmentId, conversationId, on) {
      if (onSecond !== true) return "unavailable";
      let ref: ConversationRef | null = null;
      if (on) {
        const messages = await readConversationMessages(call, conversationId);
        ref = messages === null ? null : await conversationRef(conversationId, messages);
        if (ref === null) return "unavailable";
      }
      pending = withRef(refs.get(assignmentId) ?? [], conversationId, ref);
      try {
        const write = await writeDraft(shared, session, assignmentId, {});
        switch (write.kind) {
          case "saved": return "saved";
          case "conflict":
          case "signedOut":
            return write.kind;
          case "refused": return write.code === "attachment_stale" ? "stale" : "unavailable";
          default: return "unavailable";
        }
      } finally {
        pending = null;
      }
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

/**
 * F4-PRE-R02: the conversations as PD-2 chats, numbered oldest first. Their messages are read when one
 * is opened. `attached` null: the attachments cannot be read, so none is shown as attached or not.
 * Before a write the server names no conversation as required (a 409 does), so none is marked required.
 */
export function chatsOf(list: ConversationsRead, attached: readonly ConversationRef[] | null): readonly Chat[] | null {
  if (list.kind !== "ready") return null;
  const ids = attached === null ? null : new Set(attached.map((r) => r.conversationId));
  return list.conversations.map((c, i) => ({
    n: i + 1, date: dateOf(c.createdAt).date, required: false, entries: [], conversationId: c.conversationId,
    attached: ids === null ? null : ids.has(c.conversationId),
  }));
}

const joined = (parts: readonly string[]) => parts.filter((p) => p !== "").join(", ");

/**
 * The step's view of the two halves. The server's read carries no record of transfers (declaration-v1
 * and v2 keep `ai.recorded` empty), so that block is empty; the conversations come from the assistant's
 * own route (`chats`, null when that read failed). The teacher's question travels in the statement half
 * and is shown by TeacherQuestion (NF-3 PR-20), not here. The declared part is what the draft or the
 * bound declaration holds, and null when there is neither.
 */
export function viewOf(student: StudentDeclarationRead, statement: StatementRead, chats: readonly Chat[] | null = []): DeclarationRead {
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
  return { kind: "ready", recorded: [], declared, chats: chats ?? [], question: null, ...(chats === null ? { chatsUnavailable: true } : {}) };
}
