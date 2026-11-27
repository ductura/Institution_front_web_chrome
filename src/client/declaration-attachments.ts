/**
 * F4-PRE-R02: Asistent conversations attached to the declaration (declaration-v2, Institution_server#890).
 * The student reads their conversations (student.assistant-conversations.get) and the messages of one
 * (student.assistant-conversation.get). An attachment names a conversation up to `throughSeq` with the
 * hash of its messages, as the server checks it
 * (db/main/migrations/20261220360000_teacher_declaration_conversation.sql): the sha256 of the JSON array
 * text of each message's contentSha256, seq 1..throughSeq.
 *
 * The extract has student.declaration-second.get/put. The shape the step needs of the attachments stays
 * local (below). A client that does not know the operation rejects it without a request
 * (`client_rejected`): `readSecond` says `unsupported` and the step stays on declaration-v1.
 */
import type { createApi } from "./api";
import type { MigrationOperations } from "./migration-contract-types.generated";
import { matchesSchema, type Schema } from "./schema-check";

type Call = ReturnType<typeof createApi>;

export type ConversationRef = { readonly conversationId: string; readonly throughSeq: number; readonly messagesSha256: string };
export type ConversationSummary = MigrationOperations["student.assistant-conversations.get"]["success"]["body"]["conversations"][number];
export type ConversationMessage = MigrationOperations["student.assistant-conversation.get"]["success"]["body"]["messages"][number];

const HEX64 = "^[0-9a-f]{64}$";

const CONVERSATION_REF: Schema = {
  type: "object",
  required: ["conversationId", "throughSeq", "messagesSha256"],
  properties: {
    conversationId: { type: "string", minLength: 1 },
    throughSeq: { type: "integer", minimum: 1 },
    messagesSha256: { type: "string", pattern: HEX64 },
  },
  additionalProperties: false,
};

const AI_OF = (items: Schema): Schema => ({
  anyOf: [
    { type: "null" },
    { type: "object", required: ["ai"], properties: { ai: { type: "object", required: ["attachments"], properties: { attachments: { type: "array", items } } } } },
  ],
});

/** What the step needs of a declaration-v2 answer: the draft's attachments are refs; the payload's may also be uploads. */
const SECOND_READ: Schema = {
  type: "object",
  required: ["state", "draft", "payload"],
  properties: {
    state: { type: "string" },
    draft: AI_OF(CONVERSATION_REF),
    payload: AI_OF({ type: "object" }),
  },
};

type SecondBody = {
  readonly state: string;
  readonly draft: { readonly ai: { readonly attachments: readonly ConversationRef[] } } | null;
  readonly payload: { readonly ai: { readonly attachments: readonly { readonly conversationId?: unknown }[] } } | null;
};

/** The refs a declaration-v2 draft holds, or null when the answer is off the shape. */
export function attachedRefs(body: unknown): readonly ConversationRef[] | null {
  if (!matchesSchema(SECOND_READ, body)) return null;
  return (body as SecondBody).draft?.ai.attachments ?? [];
}

/**
 * How many conversations go with the declaration: the confirmed one's while it holds, else the draft's.
 * Null when the answer is off the shape.
 */
export function attachedCount(body: unknown): number | null {
  if (!matchesSchema(SECOND_READ, body)) return null;
  const read = body as SecondBody;
  if ((read.state === "confirmed" || read.state === "bound") && read.payload !== null) {
    return read.payload.ai.attachments.filter((a) => typeof a.conversationId === "string").length;
  }
  return read.draft?.ai.attachments.length ?? 0;
}

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** sha256 hex of `["h1","h2",…]`, the text Postgres gives for array_to_json of the hashes. */
export async function messagesSha256(contentHashes: readonly string[]): Promise<string> {
  const text = JSON.stringify(contentHashes);
  return hex(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/**
 * The ref of the whole conversation as read: every message from seq 1 on, with no gap. Null when the
 * messages do not run 1..n or a hash is not a sha256, so nothing is attached that the server would refuse.
 */
export async function conversationRef(
  conversationId: string, messages: readonly Pick<ConversationMessage, "seq" | "contentSha256">[],
): Promise<ConversationRef | null> {
  const sorted = [...messages].sort((a, b) => a.seq - b.seq);
  if (sorted.length === 0 || sorted.some((m, i) => m.seq !== i + 1 || !/^[0-9a-f]{64}$/.test(m.contentSha256))) return null;
  return { conversationId, throughSeq: sorted.length, messagesSha256: await messagesSha256(sorted.map((m) => m.contentSha256)) };
}

export type ConversationsRead =
  | { readonly kind: "ready"; readonly conversations: readonly ConversationSummary[] }
  | { readonly kind: "signedOut" | "unavailable" };

/** The student's conversations of one assignment, oldest first. */
export async function readConversations(call: Call, assignmentId: string): Promise<ConversationsRead> {
  try {
    const list = await call("student.assistant-conversations.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!list.ok) return { kind: list.status === 401 ? "signedOut" : "unavailable" };
    const conversations = [...list.body.conversations].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.conversationId.localeCompare(b.conversationId));
    return { kind: "ready", conversations };
  } catch {
    return { kind: "unavailable" };
  }
}

/** The messages of one conversation, by seq; null when the read fails. */
export async function readConversationMessages(call: Call, conversationId: string): Promise<readonly ConversationMessage[] | null> {
  try {
    const read = await call("student.assistant-conversation.get", { params: { conversationId }, query: undefined, body: undefined });
    if (!read.ok) return null;
    return [...read.body.messages].sort((a, b) => a.seq - b.seq);
  } catch {
    return null;
  }
}

/** The transport for the two declaration-v2 operations, until the extract types them. */
export type SecondCall = (
  id: "student.declaration-second.get" | "student.declaration-second.put",
  input: { readonly params: { readonly assignmentId: string }; readonly query: undefined; readonly body: unknown },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type SecondRead =
  | { readonly kind: "ready"; readonly body: unknown; readonly refs: readonly ConversationRef[]; readonly count: number }
  /** The client does not know the operation: nothing was sent. */
  | { readonly kind: "unsupported" }
  | { readonly kind: "signedOut" | "unavailable" };

/** One declaration-v2 read. An answer off the local shape is `unavailable`, never "nothing attached". */
export async function readSecond(call: SecondCall, assignmentId: string): Promise<SecondRead> {
  let answer: Awaited<ReturnType<SecondCall>>;
  try {
    answer = await call("student.declaration-second.get", { params: { assignmentId }, query: undefined, body: undefined });
  } catch {
    return { kind: "unavailable" };
  }
  if (!answer.ok) {
    if (answer.code === "client_rejected") return { kind: "unsupported" };
    return { kind: answer.status === 401 ? "signedOut" : "unavailable" };
  }
  const refs = attachedRefs(answer.body);
  const count = attachedCount(answer.body);
  return refs === null || count === null ? { kind: "unavailable" } : { kind: "ready", body: answer.body, refs, count };
}

/** The refs after attaching (`ref`) or taking off (`null`) one conversation, in the order they were attached. */
export function withRef(refs: readonly ConversationRef[], conversationId: string, ref: ConversationRef | null): readonly ConversationRef[] {
  const others = refs.filter((r) => r.conversationId !== conversationId);
  return ref === null ? others : [...others, ref];
}
