/**
 * The browser side of the comment route (F-9 step 1; route and RPCs: B-10,
 * docs/BACKEND.md 4.11), ported from Ductus 0cdb0f1. Every read and write is
 * collaboration.comments.post of the contract, through createApi of api.ts,
 * with the action as its path parameter; the client never names an author, a
 * role or an institution, the database takes them from the session. A
 * response that is not exactly the documented shape is treated as
 * unavailable, never shown.
 */

import { isTextAnchorInput, type TextAnchor } from "../../packages/editor-core/src/document/collaboration";

import { createApi, type ApiOptions, type ApiResult, type Input } from "./api";

export type CommentRole = "teacher" | "student";
export type ThreadState = "open" | "answered" | "resolved";

export type ThreadComment = {
  readonly id: string;
  readonly role: CommentRole;
  readonly isOwn: boolean;
  /** Null once the student who wrote it deleted it; it keeps its place (DAN-215). */
  readonly body: string | null;
  /** Start of the 5-minute window (P-03) the comment was written in. */
  readonly createdWindow: string;
  /** Start of the 5-minute window of the deletion; null while the comment stands. */
  readonly deletedWindow: string | null;
};

export type CommentThread = {
  readonly id: string;
  /** 1, 2, 3… in the order the threads were opened; threads are never deleted (B-10). */
  readonly number: number;
  readonly state: ThreadState;
  /** Null when the stored anchor is not a valid TextAnchor: shown, never placed. */
  readonly anchor: TextAnchor | null;
  /**
   * The revision of the work the thread was written on (INT-15, API 1.97.0); a
   * reply has its thread's. Null for a thread written before revisions were
   * recorded, a draft, or a server that does not send it.
   */
  readonly revision: number | null;
  readonly comments: readonly ThreadComment[];
};

export type ListOutcome =
  | { kind: "ok"; threads: CommentThread[] }
  | { kind: "signedOut" | "forbidden" | "unavailable" };

export type ReplyOutcome = "ok" | "signedOut" | "forbidden" | "conflict" | "invalid" | "unavailable";
export type CreateOutcome = "ok" | "signedOut" | "forbidden" | "invalid" | "unavailable";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ROLES: ReadonlySet<string> = new Set(["teacher", "student"]);
const STATES: ReadonlySet<string> = new Set(["open", "answered", "resolved"]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A revision as the contract bounds it: a safe integer from 1. */
export const isRevision = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1;

/**
 * Threads from the body of `list`, whose rows come ordered by thread and
 * position. Null for any row out of shape or out of order.
 */
export function threadsFromList(value: unknown): CommentThread[] | null {
  if (!isObject(value) || !Array.isArray(value.comments)) return null;
  const threads: {
    id: string; state: ThreadState; anchor: TextAnchor | null; revision: number | null; comments: ThreadComment[];
  }[] = [];
  for (const row of value.comments as unknown[]) {
    if (!isObject(row)) return null;
    const { threadId, commentId, position, authorRole, isOwn, body, anchor, state, createdWindow, deletedWindow } = row;
    const revision = row.revision === undefined ? null : row.revision;
    const standing = deletedWindow === null && typeof body === "string";
    const deleted = body === null && typeof deletedWindow === "string" && !Number.isNaN(Date.parse(deletedWindow));
    if (typeof threadId !== "string" || !UUID.test(threadId) || typeof commentId !== "string" || !UUID.test(commentId)
      || typeof position !== "number" || !Number.isSafeInteger(position) || position < 1
      || typeof authorRole !== "string" || !ROLES.has(authorRole) || typeof isOwn !== "boolean"
      || !(standing || deleted) || typeof state !== "string" || !STATES.has(state)
      || typeof createdWindow !== "string" || Number.isNaN(Date.parse(createdWindow))
      || !(revision === null || isRevision(revision))) {
      return null;
    }
    const comment: ThreadComment = {
      id: commentId, role: authorRole as CommentRole, isOwn, body: body as string | null, createdWindow,
      deletedWindow: deletedWindow as string | null,
    };
    const last = threads.at(-1);
    if (position === 1) {
      if (threads.some((t) => t.id === threadId)) return null;
      threads.push({
        id: threadId, state: state as ThreadState, anchor: isTextAnchorInput(anchor) ? anchor : null,
        revision: revision as number | null, comments: [comment],
      });
    } else if (last?.id === threadId && anchor === null && position === last.comments.length + 1
      && revision === last.revision) {
      last.comments.push(comment);
    } else {
      return null;
    }
  }
  return threads.map((t, index) => ({ ...t, number: index + 1 }));
}

type CommentAction = "list" | "reply" | "create" | "resolve" | "reopen";
type CommentResult = ApiResult<"collaboration.comments.post">;

/** One call of the route; null when no answer came (offline, aborted). */
async function post(action: CommentAction, input: Record<string, unknown>, options: ApiOptions): Promise<CommentResult | null> {
  try {
    const call = { params: { action }, query: undefined, body: input } as unknown as Input<"collaboration.comments.post">;
    return await createApi(options)("collaboration.comments.post", call);
  } catch {
    return null;
  }
}

/**
 * The outcome of a write from the status, as the Ductus route answered it.
 * Input the contract refuses never leaves (client_rejected): the server would
 * have answered 422.
 */
function writeOutcome(result: CommentResult | null, success: 200 | 204): ReplyOutcome {
  if (result === null) return "unavailable";
  if (result.ok) return result.status === success ? "ok" : "unavailable";
  if (result.code === "client_rejected") return "invalid";
  switch (result.status) {
    case 401: return "signedOut";
    case 403: return "forbidden";
    case 409: return "conflict";
    case 422: return "invalid";
    default: return "unavailable";
  }
}

/** `options` is for tests and other origins; the page's own origin and transport by default. */
export async function listComments(
  documentId: string, current: () => boolean = () => true, options: ApiOptions = {},
): Promise<ListOutcome> {
  if (!current()) return { kind: "signedOut" };
  const result = await post("list", { documentId }, options);
  if (result?.status === 401) return { kind: "signedOut" };
  if (result?.status === 403) return { kind: "forbidden" };
  if (!result?.ok || result.status !== 200) return { kind: "unavailable" };
  const threads = threadsFromList(result.body);
  return threads ? { kind: "ok", threads } : { kind: "unavailable" };
}

/**
 * `current` is asked right before the request: a reply typed under a session
 * that has since ended in this browser is never sent, since the cookie it
 * would carry may now be another person's (F-093).
 */
export async function replyComment(
  threadId: string, body: string, current: () => boolean = () => true, options: ApiOptions = {},
): Promise<ReplyOutcome> {
  if (!current()) return "signedOut";
  return writeOutcome(await post("reply", { threadId, body: body.normalize("NFC") }, options), 200);
}

/**
 * Opens a thread on a passage (teacher only; DAN-86 step 2c). The anchor is
 * made from the text the teacher sees; the route takes nothing else.
 */
export async function createComment(
  documentId: string, body: string, anchor: TextAnchor, current: () => boolean = () => true, options: ApiOptions = {},
): Promise<CreateOutcome> {
  if (!current()) return "signedOut";
  const outcome = writeOutcome(await post("create", { documentId, body: body.normalize("NFC"), anchor }, options), 200);
  // Creating has no conflict of its own: a 409 is not one of its answers.
  return outcome === "conflict" ? "unavailable" : outcome;
}

/**
 * Opens a thread on a revision of the work (INT-15; API 1.97.0): the teacher
 * names the revision shown, and the server checks that it exists and that the
 * teacher may read it (422 otherwise). The anchor is made from the text on
 * screen; null makes it a general comment, which is what a comment on an older
 * version than the one on screen must be, since the server checks an anchor
 * against the text the teacher reads now (409).
 */
export async function createRevisionComment(
  documentId: string, body: string, anchor: TextAnchor | null, revision: number,
  current: () => boolean = () => true, options: ApiOptions = {},
): Promise<CreateOutcome> {
  if (!current()) return "signedOut";
  if (!isRevision(revision)) return "invalid";
  const outcome = writeOutcome(
    await post("create", { documentId, body: body.normalize("NFC"), anchor, revision }, options), 200,
  );
  return outcome === "conflict" ? "unavailable" : outcome;
}

/** Marks a thread resolved or opens it again (teacher only); the route answers 204. */
export async function changeThreadState(
  threadId: string, action: "resolve" | "reopen", current: () => boolean = () => true, options: ApiOptions = {},
): Promise<ReplyOutcome> {
  if (!current()) return "signedOut";
  return writeOutcome(await post(action, { threadId }, options), 204);
}
