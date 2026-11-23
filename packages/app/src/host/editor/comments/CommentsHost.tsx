"use client";

// PIL-K-KOMENTARI-EDITOR: the Comments card (WEB-2130) mounted in the student's editor over the
// real port (port.ts). The editor gives the selection, the size of the text and the jump to a
// place; anchors are made and placed against the text this editor holds (BACKEND 4.11). One card
// per session: under another session the card starts again from nothing (F-088), and once the
// session ends, here or in another tab, no thread or typed reply stays on screen (F-093). A
// submitted work is read only. Without an editor (the submitted view) no place is claimed.
import type { Node as PmNode } from "@tiptap/pm/model";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { watchSessionEnd, type SessionWatch } from "@/client/session-end";
import type { SessionMark } from "@/client/session-marks";
import { ANCHOR_QUOTE_MAX, createTextAnchor, isTextAnchorInput, type TextAnchor } from "../../../../../editor-core/src/document/collaboration/index.ts";
import { anchorRange } from "../../../../../editor-core/src/editor/comment-anchor.ts";
import { NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/interop.ts";
import type { HostSectionContext } from "../../../../../../src/components/editor/EditorPageWork.tsx";

import { CommentsPanel } from "./CommentsPanel";
import styles from "./comments.module.css";
import { commentsHr as t } from "./messages.hr";
import type { Place, Selection } from "./model";
import { commentsPort } from "./port";

type Editor = NonNullable<HostSectionContext["editor"]>;

/** The anchor for a place inside one paragraph of `doc`, or null (another paragraph, blank, too long). */
export function anchorAt(doc: PmNode, place: Place): TextAnchor | null {
  if (place.from < 0 || place.to > doc.content.size || place.to <= place.from) return null;
  const $from = doc.resolve(place.from);
  const $to = doc.resolve(place.to);
  const block = $from.parent;
  const nodeId = block.attrs[NODE_ID_ATTRIBUTE];
  if (!$from.sameParent($to) || !block.isTextblock || typeof nodeId !== "string") return null;
  const nodeText = block.textContent;
  let start = block.textBetween(0, $from.parentOffset).length;
  let end = start + block.textBetween($from.parentOffset, $to.parentOffset).length;
  while (start < end && /\s/u.test(nodeText[start]!)) start += 1;
  while (end > start && /\s/u.test(nodeText[end - 1]!)) end -= 1;
  if (start === end || [...nodeText.slice(start, end)].length > ANCHOR_QUOTE_MAX) return null;
  const anchor = createTextAnchor({ nodeId: nodeId as TextAnchor["nodeId"], nodeText, start, end });
  return isTextAnchorInput(anchor) ? anchor : null;
}

const liveOf = (ref: { readonly current: Editor | null }): Editor | null => (ref.current && !ref.current.isDestroyed ? ref.current : null);

export function CommentsHost(props: { editor: Editor | null; documentId: string; session: SessionMark | null; submitted: boolean; signedOut?: boolean }) {
  return <SessionComments key={props.session?.tag ?? ""} {...props} />;
}

function SessionComments({ editor, documentId, session, submitted, signedOut = false }: {
  editor: Editor | null; documentId: string; session: SessionMark | null; submitted: boolean; signedOut?: boolean;
}) {
  const [ended, setEnded] = useState(false);
  const watchRef = useRef<SessionWatch | null>(null);
  const tag = session?.tag ?? null;
  const at = session?.at ?? 0;
  useEffect(() => {
    const watch = watchSessionEnd(tag === null ? null : { tag, at }, () => setEnded(true));
    watchRef.current = watch;
    return () => { watch.close(); if (watchRef.current === watch) watchRef.current = null; };
  }, [tag, at]);
  const stopped = ended || signedOut;
  const stoppedRef = useRef(stopped);
  stoppedRef.current = stopped;
  const current = useCallback(() => !stoppedRef.current && !(watchRef.current?.ended() ?? false), []);

  const editorRef = useRef(editor);
  editorRef.current = editor;
  const live = () => liveOf(editorRef);
  const port = useMemo(() => commentsPort({
    current,
    locate: (anchor) => { const e = live(); return e ? anchorRange(e.state.doc, anchor) : null; },
    anchorFor: (place) => { const e = live(); return e ? anchorAt(e.state.doc, place) : null; },
  }), [current]);

  const selection = useCallback((): Selection | null => {
    const e = liveOf(editorRef);
    if (!e || submitted) return null;
    const { from, to, $from, $to } = e.state.selection;
    return { from, to, quote: e.state.doc.textBetween(from, to, " "), at: Date.now(), sameParagraph: $from.sameParent($to) && $from.parent.isTextblock };
  }, [submitted]);
  const docSize = useCallback(() => liveOf(editorRef)?.state.doc.content.size ?? 0, []);
  const onJump = useCallback((place: Place) => {
    const e = liveOf(editorRef);
    if (!e) return;
    // Placed again against the text as it is now: an edit since the list was read moves the place.
    const anchor = port.anchorOf(place);
    const range = anchor ? anchorRange(e.state.doc, anchor) : null;
    if (!range) return;
    e.chain().setTextSelection(range).scrollIntoView().run();
    e.view.focus();
  }, [port]);
  const onSessionEnd = useCallback(() => setEnded(true), []);

  if (stopped) return <p role="status" className={styles.muted}>{t.signedOut}</p>;
  return (
    <>
      {submitted && <p className={styles.muted}>{t.submittedNote}</p>}
      {/* No record of the student's last visit exists: nothing is claimed new. */}
      <CommentsPanel workId={documentId} role="student" submitted={submitted} port={port} selection={selection} docSize={docSize}
        seen={Number.POSITIVE_INFINITY} onJump={onJump} onSessionEnd={onSessionEnd} />
    </>
  );
}
