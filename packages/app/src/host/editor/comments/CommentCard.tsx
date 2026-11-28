"use client";

// ED-98 (prototype text2.js `#t2card`, INVENTAR „Kartica komentara”): up to 1050 px a tap on a comment
// in the text opens a card at the bottom of the screen: who wrote it, its kind, "i od N" or "riješeno",
// the text with the last two replies, ‹ › through the open comments, "Odgovori" (the Comments card in
// the panel) and "Riješeno" / "Otvori ponovno" while the work can be written. Esc closes it.
// The host reads the comments over the same port as the panel and lights their places in the text.
import { Button, PillTag } from "@ductura/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { watchSessionEnd, type SessionWatch } from "@/client/session-end";
import type { SessionMark } from "@/client/session-marks";
import { requestPanel } from "@/components/editor/layout-prefs/open-panel";
import { useLocalEditor } from "@/components/editor/LocalDocument";
import { anchorRange, commentHighlightKey, commentHighlightPlugin } from "../../../../../editor-core/src/editor/comment-anchor.ts";

import { COMMENT_CARD_EVENT, cardFits, cardPosition, commentAt } from "./comment-card";
import styles from "./comments.module.css";
import { commentsHr as t } from "./messages.hr";
import { abilities, type Comment } from "./model";
import { commentsPort } from "./port";

/** The open comments placed in the text, in the order of the text. */
export function openInText(comments: readonly Comment[]): Comment[] {
  return comments.filter((c) => !c.resolved && !c.place.lost).sort((a, b) => a.place.from - b.place.from);
}

// ED-119: the comment at a position moved to comment-card (the panel asks for it too); kept here for callers.
export { commentAt };

export function CommentCard({ comment, comments, submitted, busy, onClose, onStep, onReply, onResolve }: {
  comment: Comment; comments: readonly Comment[]; submitted: boolean; busy?: boolean;
  onClose: () => void; onStep: (by: 1 | -1) => void; onReply: () => void; onResolve: (resolved: boolean) => void;
}) {
  const open = openInText(comments);
  const i = open.findIndex((c) => c.id === comment.id);
  const can = abilities(comment, "student", submitted);
  const replies = comment.replies;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={styles.card2} role="dialog" aria-label={t.card.label} data-comment-card="">
      <div className={styles.card2Head}>
        <b>{t.card.who[comment.role]}</b>
        {comment.kind && <PillTag tone="neutral">{t.kinds[comment.kind]}</PillTag>}
        <span className={styles.muted}>{i >= 0 ? t.card.at(i + 1, open.length) : t.status.resolved}</span>
        <span className={styles.grow} />
        <Button tone="quiet" size="dense" aria-label={t.card.close} onClick={onClose}>✕</Button>
      </div>
      <div className={styles.card2Body}>
        <p>{comment.text}</p>
        {replies.slice(-2).map((r) => <p key={r.id} className={styles.card2Reply}><b>{t.card.who[r.role]}</b> {r.text}</p>)}
        {replies.length > 2 && <p className={styles.muted}>{t.card.earlier(replies.length - 2)}</p>}
      </div>
      <div className={styles.card2Foot}>
        {open.length > 1 && <>
          <Button tone="secondary" size="dense" aria-label={t.prevComment} onClick={() => onStep(-1)}>‹</Button>
          <Button tone="secondary" size="dense" aria-label={t.nextComment} onClick={() => onStep(1)}>›</Button>
        </>}
        <span className={styles.grow} />
        <Button tone="secondary" size="dense" onClick={onReply}>{t.reply}</Button>
        {(can.resolve || can.reopen) && (
          <Button size="dense" disabled={busy} onClick={() => onResolve(!comment.resolved)}>{comment.resolved ? t.card.reopen : t.card.resolve}</Button>
        )}
      </div>
    </div>
  );
}

/** Mounted beside the marks host, inside the work's editor: highlights and the card. */
export function CommentCardHost({ documentId, session }: { documentId: string; session: SessionMark | null }) {
  const editor = useLocalEditor();
  const [comments, setComments] = useState<readonly Comment[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 0 : window.innerWidth));
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const watchRef = useRef<SessionWatch | null>(null);
  const tag = session?.tag ?? null;
  const at = session?.at ?? 0;
  useEffect(() => {
    const watch = watchSessionEnd(tag === null ? null : { tag, at }, () => setActiveId(null));
    watchRef.current = watch;
    return () => { watch.close(); if (watchRef.current === watch) watchRef.current = null; };
  }, [tag, at]);
  const port = useMemo(() => commentsPort({
    current: () => !(watchRef.current?.ended() ?? false),
    locate: (anchor) => { const e = editorRef.current; return e && !e.isDestroyed ? anchorRange(e.state.doc, anchor) : null; },
  }), []);

  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const read = useCallback(async () => {
    let out;
    try { out = await port.read(documentId); } catch { out = null; }
    if (alive.current && out?.kind === "ready") setComments(out.comments);
  }, [port, documentId]);
  useEffect(() => { if (editor && !editor.isDestroyed) void read(); }, [editor, read]);

  // The places of the open comments, lit in the text (the same decoration the marks host reads).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const own = !commentHighlightKey.get(editor.state);
    if (own) editor.registerPlugin(commentHighlightPlugin());
    return () => { if (own && !editor.isDestroyed) editor.unregisterPlugin(commentHighlightKey); };
  }, [editor]);
  useEffect(() => {
    if (!editor || editor.isDestroyed || !commentHighlightKey.get(editor.state)) return;
    const ranges = openInText(comments).map((c) => ({ from: c.place.from, to: c.place.to }));
    editor.view.dispatch(editor.state.tr.setMeta(commentHighlightKey, ranges).setMeta("addToHistory", false));
  }, [editor, comments]);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    const onAsk = (event: Event) => {
      const pos = cardPosition(event);
      const hit = pos === null ? null : commentAt(comments, pos);
      if (hit) setActiveId(hit.id);
    };
    document.addEventListener(COMMENT_CARD_EVENT, onAsk);
    return () => document.removeEventListener(COMMENT_CARD_EVENT, onAsk);
  }, [comments]);

  const close = useCallback(() => setActiveId(null), []);
  const active = comments.find((c) => c.id === activeId) ?? null;
  if (!editor || editor.isDestroyed || !active || !cardFits(width) || (watchRef.current?.ended() ?? false)) return null;

  const step = (by: 1 | -1) => {
    const open = openInText(comments);
    if (open.length === 0) return;
    const i = open.findIndex((c) => c.id === active.id);
    const next = open[i < 0 ? (by === 1 ? 0 : open.length - 1) : (i + by + open.length) % open.length]!;
    setActiveId(next.id);
    editor.chain().setTextSelection({ from: next.place.from, to: next.place.to }).scrollIntoView().run();
  };
  const reply = () => {
    const id = active.id;
    setActiveId(null);
    requestPanel("comments");
    window.setTimeout(() => {
      const card = [...document.querySelectorAll("[data-cid]")].find((el) => el.getAttribute("data-cid") === id);
      if (card && typeof card.scrollIntoView === "function") card.scrollIntoView({ block: "nearest" });
    }, 60);
  };
  const resolve = async (resolved: boolean) => {
    if (busy) return;
    setBusy(true);
    try { await port.setResolved(documentId, active.id, resolved); } catch { /* the list read next says what holds */ }
    if (!alive.current) return;
    setBusy(false);
    await read();
  };
  return <CommentCard comment={active} comments={comments} submitted={!editor.isEditable} busy={busy}
    onClose={close} onStep={step} onReply={reply} onResolve={(r) => void resolve(r)} />;
}
