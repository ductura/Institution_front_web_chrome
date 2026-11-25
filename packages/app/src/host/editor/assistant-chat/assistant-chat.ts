// ED-10 (NF2-P10, ASIST-1..9): asking the Asistent and reading back what Ductura recorded.
// student.assistant-request.post asks (with an Idempotency-Key, so a retry after a lost answer is the
// same request); student.assistant-conversation.get reads a conversation, oldest message first.
import { assistantRequestCall, createApi, responseMatches, type AssistantRequestTransport } from "../../../../../../src/client/api.ts";
import type { AiPurpose } from "../../../../../../src/components/teacher/assignment-create.ts";

/**
 * The server keeps a purpose catalogue version per assignment and refuses a request on another version.
 * No route the student reads returns it yet, and every assignment is created on version 1
 * (Institution_server server/database/institution-assignments.ts:57), so the card asks on version 1.
 */
export const PURPOSE_CATALOG_VERSION = 1;

/** Purposes the card offers: those the notice allows, without transcription, which needs a faculty switch. */
export function askablePurposes(allowed: readonly string[]): AiPurpose[] {
  const order: readonly AiPurpose[] = ["formatting", "proofreading", "literature_search", "translation"];
  return order.filter((key) => allowed.includes(key));
}

export type AskInput = {
  readonly assignmentId: string;
  readonly conversationId: string | null;
  readonly purposeKey: AiPurpose;
  readonly paragraph: string;
};

export type AskOutcome =
  | { kind: "answered"; conversationId: string }
  /** Settled without an answer; a retry needs a new key. conversationId when the question was recorded. */
  | { kind: "failed" | "busy" | "purpose" | "forbidden" | "disabled" | "limit"; conversationId: string | null }
  /** Nothing is known to have happened: a retry repeats the same key. */
  | { kind: "unavailable" }
  | { kind: "signedOut" };

export type Message = {
  readonly seq: number;
  readonly role: "you" | "assistant";
  readonly text: string;
  readonly at: string;
};

export type ConversationRead =
  | { kind: "ok"; messages: readonly Message[] }
  | { kind: "signedOut" | "unavailable" };

export interface AssistantPort {
  ask(input: AskInput, key: string): Promise<AskOutcome>;
  read(conversationId: string): Promise<ConversationRead>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SETTLED: Readonly<Record<string, Exclude<AskOutcome["kind"], "answered" | "unavailable" | "signedOut">>> = {
  provider_failed: "failed",
  request_outcome_unknown: "failed",
  idempotency_conflict: "failed",
  in_progress: "busy",
  purpose_not_allowed: "purpose",
  forbidden: "forbidden",
  ai_disabled: "disabled",
  budget_exceeded: "limit",
};

type RequestBody =
  | { outcome: "completed"; conversationId: string }
  | { outcome: string; conversationId: string | null };

export function createAssistantPort(
  send: AssistantRequestTransport = assistantRequestCall(),
  call = createApi(),
): AssistantPort {
  return {
    async ask(input, key) {
      try {
        const res = await send({ ...input, purposeCatalogVersion: PURPOSE_CATALOG_VERSION }, key);
        if (res.status === 401) return { kind: "signedOut" };
        if (res.status === 422 || res.status === 428) return { kind: "failed", conversationId: null };
        if (res.status !== 200 || !res.headers.get("content-type")?.startsWith("application/json")) return { kind: "unavailable" };
        const bytes = await res.arrayBuffer();
        const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
        if (!responseMatches("student.assistant-request.post", 200, body, bytes.byteLength)) return { kind: "unavailable" };
        const answer = body as RequestBody;
        if (answer.outcome === "completed" && answer.conversationId !== null) return { kind: "answered", conversationId: answer.conversationId };
        return { kind: SETTLED[answer.outcome] ?? "failed", conversationId: answer.conversationId };
      } catch {
        return { kind: "unavailable" };
      }
    },

    async read(conversationId) {
      if (!UUID.test(conversationId)) return { kind: "unavailable" };
      try {
        const result = await call("student.assistant-conversation.get", { params: { conversationId }, query: undefined, body: undefined });
        if (!result.ok) return { kind: result.status === 401 ? "signedOut" : "unavailable" };
        return {
          kind: "ok",
          messages: result.body.messages.map((m) => ({
            seq: m.seq,
            role: m.role === "student_paragraph" ? "you" : "assistant",
            text: m.content,
            at: m.createdAt,
          })),
        };
      } catch {
        return { kind: "unavailable" };
      }
    },
  };
}

/** One recorded question and its answer, if the Asistent gave one. */
export type Exchange = { readonly question: Message; readonly answer: Message | null };

export function exchangesOf(messages: readonly Message[]): Exchange[] {
  const out: Exchange[] = [];
  for (const m of [...messages].sort((a, b) => a.seq - b.seq)) {
    if (m.role === "you") out.push({ question: m, answer: null });
    else if (out.length > 0 && out[out.length - 1]!.answer === null) out[out.length - 1] = { ...out[out.length - 1]!, answer: m };
  }
  return out;
}

export function titleOf(messages: readonly Message[]): string {
  const first = messages.find((m) => m.role === "you")?.text.replace(/\s+/g, " ").trim() ?? "";
  return first.length > 48 ? `${first.slice(0, 48)}…` : first;
}

export function clockOf(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? new Date(ms).toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" }) : "";
}

/**
 * The conversations of an assignment started on this device, newest last. No route lists a student's
 * conversations yet, so the card keeps their ids (and the purpose asked, which the conversation does
 * not return); the messages always come from the server.
 */
export type Kept = { readonly id: string; readonly purposeKey: string };

/** How many conversations the card keeps and reads: each one shown is also read, so none waits for ever. */
export const SHOWN = 10;

type Store = Pick<Storage, "getItem" | "setItem">;
// Under the person's journal scope: another person signed in on this device never sees these conversations.
const keyOf = (scope: string, assignmentId: string) => `ductura.asistent.razgovori.${scope}.${assignmentId}`;

function storage(): Store | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function keptConversations(scope: string, assignmentId: string, store: Store | null = storage()): Kept[] {
  try {
    const raw: unknown = JSON.parse(store?.getItem(keyOf(scope, assignmentId)) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((k): k is Kept =>
      typeof k === "object" && k !== null && typeof k.id === "string" && UUID.test(k.id) && typeof k.purposeKey === "string");
  } catch {
    return [];
  }
}

/**
 * Adds a conversation to the list the card holds. The held list is the source: storage is only a
 * best-effort copy, so blocked or full storage never drops a conversation already on the card.
 */
export function keepConversation(scope: string, assignmentId: string, kept: Kept, store: Store | null = storage(), held?: readonly Kept[]): Kept[] {
  const list = held ? [...held] : keptConversations(scope, assignmentId, store);
  if (list.some((k) => k.id === kept.id)) return list;
  const next = [...list, kept].slice(-SHOWN);
  try {
    store?.setItem(keyOf(scope, assignmentId), JSON.stringify(next));
  } catch {
    // Storage full or blocked: the conversation stays on the server and in this view.
  }
  return next;
}

/**
 * What the card holds for one person and assignment while the page lives. On a narrow screen the card
 * sits in a drawer that unmounts when closed; this keeps the draft, the open conversation and the key
 * of an unresolved request, so reopening continues instead of starting over. Never written to storage.
 */
export type HeldChat = {
  kept: readonly Kept[] | null;
  current: string | null;
  purpose: string;
  draft: string;
  pendingKey: string | null;
};

const held = new Map<string, HeldChat>();

export function heldChat(scope: string, assignmentId: string): HeldChat {
  const key = `${scope}.${assignmentId}`;
  let slot = held.get(key);
  if (slot === undefined) {
    slot = { kept: null, current: null, purpose: "", draft: "", pendingKey: null };
    held.set(key, slot);
  }
  return slot;
}

export function newKey(): string {
  return globalThis.crypto.randomUUID();
}
