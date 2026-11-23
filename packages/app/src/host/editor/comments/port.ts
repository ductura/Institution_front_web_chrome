// The real CommentsPort over the shared client src/client/comments.ts (PIL-K-KOMENTARI-EDITOR):
// listComments, replyComment, createComment and changeThreadState, unchanged (INT-15/INT-15b). A
// thread of the route is one Comment of the card: its first comment is the text, the rest are the
// replies. The route answers a write without the thread, so a write is reported only from a fresh
// list that holds it (B-6); a write that went out but cannot be seen again is "unknown". The route
// has no kinds, rounds, mentor confirmation, extra places or saved comments: those operations are
// refused here and the card keeps them hidden from the student. fake-port.ts stays for the tests.
import {
  changeThreadState, createComment, listComments, replyComment,
  type CommentThread, type ReplyOutcome, type ThreadComment,
} from "@/client/comments";
import type { ApiOptions } from "@/client/api";
import type { TextAnchor } from "../../../../../editor-core/src/document/collaboration/index.ts";

import { commentsHr as text } from "./messages.hr";
import type { Comment, CommentsPort, Place, Read, Reply, Write } from "./model";

export type CommentsPortDeps = {
  /** Asked right before each request: false once the session of the page has ended (F-093). */
  readonly current?: () => boolean;
  /** Where an anchor stands in the text now; null when it cannot be placed reliably (attack 7). */
  readonly locate?: (anchor: TextAnchor) => { readonly from: number; readonly to: number } | null;
  /** The anchor for a place of the selection; null when the place cannot be anchored. */
  readonly anchorFor?: (place: Place) => TextAnchor | null;
  readonly options?: ApiOptions;
};

const bodyOf = (c: ThreadComment): string => c.body ?? text.deleted;
const timeOf = (c: ThreadComment): number => Date.parse(c.createdWindow);

/** One thread of the route as a card comment; `anchors` remembers each place's anchor. */
export function commentOf(thread: CommentThread, deps: CommentsPortDeps, anchors?: WeakMap<Place, TextAnchor>): Comment {
  const [first, ...rest] = thread.comments;
  const range = thread.anchor && deps.locate ? deps.locate(thread.anchor) : null;
  const place: Place = range
    ? { from: range.from, to: range.to, quote: thread.anchor!.quote, lost: false }
    : { from: 0, to: 0, quote: thread.anchor?.quote ?? "", lost: true };
  if (thread.anchor) anchors?.set(place, thread.anchor);
  const replies: Reply[] = rest.map((r) => ({ id: r.id, role: r.role, text: bodyOf(r), ts: timeOf(r) }));
  return {
    id: thread.id,
    role: first?.role ?? "teacher",
    kind: null,
    text: first ? bodyOf(first) : "",
    place,
    also: [],
    resolved: thread.state === "resolved",
    confirmed: null,
    round: 1,
    ts: first ? timeOf(first) : 0,
    replies,
    template: null,
  };
}

const refused: Write = { kind: "rejected" };

function failed(outcome: Exclude<ReplyOutcome, "ok">): Write {
  if (outcome === "signedOut") return { kind: "signedOut" };
  // No answer or a 5xx: the write may or may not have been applied.
  return outcome === "unavailable" ? { kind: "unknown" } : { kind: "rejected" };
}

export function commentsPort(deps: CommentsPortDeps = {}): CommentsPort & { readonly anchorOf: (place: Place) => TextAnchor | null } {
  const current = deps.current ?? (() => true);
  const anchors = new WeakMap<Place, TextAnchor>();
  const list = async (documentId: string) => {
    try { return await listComments(documentId, current, deps.options); } catch { return { kind: "unavailable" as const }; }
  };
  /** After a write the route confirmed: the thread as the server now holds it, or unknown. */
  const after = async (documentId: string, pick: (threads: readonly CommentThread[]) => CommentThread | undefined): Promise<Write> => {
    const read = await list(documentId);
    if (read.kind === "signedOut") return { kind: "signedOut" };
    const thread = read.kind === "ok" ? pick(read.threads) : undefined;
    return thread ? { kind: "ok", comment: commentOf(thread, deps, anchors) } : { kind: "unknown" };
  };
  const write = async (documentId: string, call: () => Promise<ReplyOutcome>, pick: (threads: readonly CommentThread[]) => CommentThread | undefined): Promise<Write> => {
    let outcome: ReplyOutcome;
    try { outcome = await call(); } catch { return { kind: "unknown" }; }
    return outcome === "ok" ? after(documentId, pick) : failed(outcome);
  };
  return {
    anchorOf: (place) => anchors.get(place) ?? null,
    async read(documentId): Promise<Read> {
      const read = await list(documentId);
      if (read.kind === "ok") return { kind: "ready", comments: read.threads.map((t) => commentOf(t, deps, anchors)), round: 1, templates: [] };
      return read.kind === "signedOut" ? { kind: "signedOut" } : { kind: "unavailable" };
    },
    reply: (documentId, threadId, body) =>
      write(documentId, () => replyComment(threadId, body, current, deps.options), (ts) => ts.find((t) => t.id === threadId)),
    setResolved: (documentId, threadId, resolved) =>
      write(documentId, () => changeThreadState(threadId, resolved ? "resolve" : "reopen", current, deps.options), (ts) => ts.find((t) => t.id === threadId)),
    async create(documentId, input) {
      const anchor = deps.anchorFor?.(input.place) ?? null;
      if (!anchor) return refused;
      const body = input.text.normalize("NFC");
      // The route answers without the new thread: the newest of this person's threads with this text.
      return write(documentId, () => createComment(documentId, body, anchor, current, deps.options),
        (ts) => ts.filter((t) => t.comments[0]?.isOwn && t.comments[0].body === body).at(-1));
    },
    // No route for these: the student never sees them (abilities), and nothing is sent.
    confirm: async () => refused,
    sendBack: async () => refused,
    addPlace: async () => refused,
    saveTemplate: async () => ({ kind: "rejected" }),
    deleteTemplate: async () => ({ kind: "rejected" }),
  };
}
