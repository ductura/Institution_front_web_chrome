"use client";

import { CommentThread as Thread, type CommentThreadLabels } from "@ductura/ui";

import type { CommentThread, ListOutcome } from "../../../../../../src/client/comments.ts";
import type { LiveView } from "../../../../../../src/client/live-reader.ts";
import LiveText, { liveStopped } from "../../../../../../src/components/teacher/LiveText.tsx";

import { commentsWritable, liveFrame, threadData } from "./live-view-model";
import { liveViewMessages as text } from "./messages.hr";

const labels: CommentThreadLabels = { thread: text.commentOn, ...text.thread, showAll: text.showAll };

export type TeacherLiveViewProps = {
  readonly view: LiveView;
  readonly comments: ListOutcome | null;
  /** The threads go through the comment records of wave 8; the view only reports the request. */
  readonly onReply: (thread: CommentThread, body: string) => void;
  readonly onState: (thread: CommentThread, action: "resolve" | "reopen") => void;
  readonly onReload: () => void;
};

/**
 * The teacher's live view of one work (WEB-1701). The text is React text with no editing and no
 * caret; a submitted work shows as submitted with its revision mark. Comments use the existing
 * thread, so a submitted work still gets replies, and the text stays untouched.
 */
export default function TeacherLiveView({ view, comments, onReply, onState, onReload }: TeacherLiveViewProps) {
  const frame = liveFrame(view);
  const stopped = liveStopped(view);
  const writable = commentsWritable(view.connection);
  return (
    <div className="page" data-locked={frame.locked ? "true" : "false"}>
      <h1>{text.title}</h1>
      {frame.revisionLabel && <p data-revision>{frame.revisionLabel}</p>}
      <LiveText view={view} marks={[]} />
      {!stopped && (
        <section aria-label={text.commentsTitle}>
          <h2>{text.commentsTitle}</h2>
          {comments === null ? null : comments.kind !== "ok" ? (
            <>
              <p role="alert">{text.commentsUnavailable}</p>
              <button type="button" onClick={onReload}>{text.retry}</button>
            </>
          ) : comments.threads.length === 0 ? <p>{text.noComments}</p> : comments.threads.map((thread) => (
            <Thread key={thread.id} thread={threadData(thread)} labels={labels} readOnly={!writable}
              onReply={(body) => onReply(thread, body)}
              onResolve={() => onState(thread, "resolve")} onReopen={() => onState(thread, "reopen")} />
          ))}
        </section>
      )}
    </div>
  );
}
