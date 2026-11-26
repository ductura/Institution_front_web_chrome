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

import { SuggestionCard, acceptanceTransaction, editorSuggestionsHr, planAcceptance, type ActionOutcome, type Decision, type Suggestion } from "../../../../../../src/components/editor/suggestions/index.ts";

import { CommentsPanel } from "./CommentsPanel";
import styles from "./comments.module.css";
import { commentsHr as t } from "./messages.hr";
import type { Place, Selection } from "./model";
import { readMyChanges } from "./my-changes";
import { commentsPort } from "./port";
import { decideProposal, readProposals, type ProposalsRead } from "./suggestions-port";
import { browserSeenStorage, readSeen, writeSeen } from "./seen-store";

type Editor = NonNullable<HostSectionContext["editor"]>;

/**
 * EDI-R10 (N-08): the teacher's proposals as cards of the student's Comments card, with "Prihvati" and
 * "Odbij". Acceptance is the student's own change: the place is found in the text this editor holds
 * BEFORE the server is asked, and a place not found reliably asks nothing and changes nothing; only
 * when the server confirms is the text changed. A read-only view (submitted, no editor) offers no action.
 */
function Proposals({ editorRef, documentId, submitted, current }: {
  editorRef: { readonly current: Editor | null }; documentId: string; submitted: boolean; current: () => boolean;
}) {
  const [read, setRead] = useState<ProposalsRead>({ kind: "unavailable" });
  const [loaded, setLoaded] = useState(false);
  const alive = useRef(true);
  const load = useCallback(async () => {
    const out = current() ? await readProposals(documentId) : ({ kind: "signedOut" } as const);
    if (alive.current) { setRead(out); setLoaded(true); }
  }, [documentId, current]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [load]);

  const decide = async (s: Suggestion, decision: Decision): Promise<ActionOutcome> => {
    if (decision === "withdraw" || submitted || !current()) return "forbidden";
    const editor = liveOf(editorRef);
    if (decision === "accept") {
      const plan = editor ? planAcceptance(editor.state.doc, s) : null;
      if (!editor || !plan) return "invalid";
      const out = await decideProposal(s.id, "accept");
      if (out === "ok" && current() && !editor.isDestroyed) editor.view.dispatch(acceptanceTransaction(editor.state, plan, s.id));
      if (out === "ok" || out === "conflict") void load();
      return out;
    }
    const out = await decideProposal(s.id, "reject");
    if (out === "ok" || out === "conflict") void load();
    return out;
  };

  if (!loaded) return <p role="status" className={styles.muted}>{t.proposalsLoading}</p>;
  if (read.kind === "signedOut") return null;
  if (read.kind !== "ok") return <p role="status" className={styles.muted}>{t.proposalsUnavailable}</p>;
  // Only a proposal still open or already decided is a card; nothing to show is no section at all.
  if (read.suggestions.length === 0) return null;
  return (
    <section aria-label={editorSuggestionsHr.title}>
      <h3>{editorSuggestionsHr.title}</h3>
      <p className={styles.muted}>{editorSuggestionsHr.note}</p>
      {submitted && <p className={styles.muted}>{t.proposalsReadOnly}</p>}
      {read.suggestions.map((s) => (
        <SuggestionCard key={s.id} suggestion={s} viewer="student" readOnly={submitted} onDecide={(d) => decide(s, d)} />
      ))}
    </section>
  );
}

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
  const currentText = useCallback((place: Place): string | null => {
    const e = liveOf(editorRef);
    const anchor = e ? port.anchorOf(place) : null;
    const range = e && anchor ? anchorRange(e.state.doc, anchor) : null;
    return e && range ? e.state.doc.textBetween(range.from, range.to, " ") : null;
  }, [port]);
  const onSessionEnd = useCallback(() => setEnded(true), []);

  // ED-42 („Novo”): the last visit is kept in this browser only. It is read once when the card opens,
  // so what was new stays marked while the card is open, and recorded when the card closes or the
  // page is left. Without a record (first visit, storage off) nothing is claimed new.
  const [seen] = useState(() => readSeen(browserSeenStorage(), documentId));
  const onSeen = useCallback(() => { writeSeen(browserSeenStorage(), documentId, Date.now()); }, [documentId]);
  useEffect(() => {
    window.addEventListener("pagehide", onSeen);
    return () => window.removeEventListener("pagehide", onSeen);
  }, [onSeen]);

  if (stopped) return <p role="status" className={styles.muted}>{t.signedOut}</p>;
  return (
    <>
      {submitted && <p className={styles.muted}>{t.submittedNote}</p>}
      <CommentsPanel workId={documentId} role="student" submitted={submitted} port={port} selection={selection} docSize={docSize} currentText={currentText}
        seen={seen} onJump={onJump} onSessionEnd={onSessionEnd} onSeen={onSeen} changes={readMyChanges} />
      <Proposals editorRef={editorRef} documentId={documentId} submitted={submitted} current={current} />
    </>
  );
}
