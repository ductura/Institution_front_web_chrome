// Pure rules of the teacher's live view (WEB-1701; plan M6.1, DAN-332, DAN-215). The view is
// always read-only: the work is the last text the student's browser sent, or, once handed in,
// the submitted revision, which is locked and labelled with its revision mark. The comment
// thread is the one from wave 8 (src/client/comments.ts); nothing here reads or writes by itself.
import type { CommentThread, ThreadComment } from "../../../../../../src/client/comments.ts";
import type { LiveView } from "../../../../../../src/client/live-reader.ts";
import type { CommentEntry, CommentThreadData } from "@ductura/ui";

import { liveViewMessages as text } from "./messages.hr";

export type LiveFrame = {
  readonly locked: boolean;
  /** No caret, no editing: true in every state, the teacher never edits the student's text (D-34). */
  readonly readOnly: true;
  readonly statusLabel: string;
  readonly noteLabel: string | null;
  /** Short mark of the submitted revision, taken from the hash of the shown bytes. */
  readonly revisionLabel: string | null;
};

/** The first eight hex digits of the revision's SHA-256, or null while there is none. */
export function revisionMark(hash: string | null): string | null {
  return hash !== null && /^[0-9a-f]{64}$/.test(hash) ? hash.slice(0, 8) : null;
}

/** What the frame around the text says. A submitted text stays submitted through failed requests. */
export function liveFrame(view: LiveView): LiveFrame {
  const shown = view.document !== null;
  const locked = shown && view.submitted;
  const mark = locked ? revisionMark(view.hash) : null;
  return {
    locked,
    readOnly: true,
    statusLabel: locked ? text.submitted : text.live,
    noteLabel: !shown ? null : locked ? text.lockedNote : text.liveNote,
    revisionLabel: mark === null ? null : `${text.revision} ${mark}`,
  };
}

/** The teacher may reply and resolve on a live work and on a submitted one: the thread is not the text. */
export function commentsWritable(connection: LiveView["connection"]): boolean {
  return connection !== "signedOut" && connection !== "notFound";
}

function entryOf(comment: ThreadComment): CommentEntry {
  return {
    id: comment.id,
    author: comment.role === "teacher" ? text.roleTeacher : text.roleStudent,
    at: comment.createdWindow.slice(0, 10),
    text: comment.body ?? text.deletedComment,
    mentor: comment.role === "teacher",
  };
}

/** A thread of the existing comment records as the thread component takes it. */
export function threadData(thread: CommentThread): CommentThreadData {
  return {
    id: thread.id,
    anchor: thread.anchor?.quote,
    resolved: thread.state === "resolved",
    entries: thread.comments.map(entryOf),
  };
}
