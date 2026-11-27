"use client";

// ED-78: "Riješi redom" (prototype tools.js `RP.walk`, `walkDone`, `walkSkip`, `walkEnd`, `walkCopy`). The
// student's open comments one at a time, in the order of the text: the comment, its place in the text,
// and a field for what was changed. "Riješeno, dalje" sends that text to the mentor as a reply and marks
// the comment resolved, each from the server's answer; a failed step keeps what was typed and stays on
// the comment. At the end the student gets the list of what was done, to copy.
import { Button } from "@ductura/ui";
import { useEffect, useRef, useState } from "react";

import styles from "./comments.module.css";
import { commentsHr as t } from "./messages.hr";
import { walkSummary, type Comment, type Place } from "./model";

export type WalkState = { readonly ids: readonly string[]; readonly i: number; readonly fixes: Readonly<Record<string, string>> };

export function CommentsWalk({ comments, walk, busy, onJump, onResolve, onSkip, onEnd, onCopy }: {
  comments: readonly Comment[]; walk: WalkState; busy: boolean;
  onJump: (place: Place) => void;
  /** Sends the fix (if any) and resolves the comment; true when both were done. */
  onResolve: (comment: Comment, fix: string) => Promise<boolean>;
  onSkip: () => void; onEnd: () => void; onCopy: (text: string) => void;
}) {
  const [fix, setFix] = useState("");
  const heading = useRef<HTMLElement | null>(null);
  const hold = (el: HTMLElement | null) => { heading.current = el; };
  const id = walk.ids[walk.i];
  const comment = id === undefined ? undefined : comments.find((c) => c.id === id);
  useEffect(() => {
    setFix("");
    heading.current?.focus();
    if (comment && !comment.place.lost) onJump(comment.place);
    // Only when the walk moves to another comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk.i]);

  if (comment === undefined) {
    const summary = walkSummary(comments, walk.ids, walk.fixes);
    return (
      <section className={styles.walk} aria-label={t.walk.group}>
        <h4 className={styles.ptitle} tabIndex={-1} ref={hold}>{t.walk.finished}</h4>
        <p className={styles.muted}>{t.walk.finishedNote}</p>
        <label className={styles.label}>{t.walk.summaryLabel}
          <textarea className={styles.field} readOnly rows={Math.min(10, walk.ids.length + 2)} value={summary} />
        </label>
        <div className={styles.actions}>
          <Button size="dense" onClick={() => onCopy(summary)}>{t.walk.copy}</Button>
          <Button tone="quiet" size="dense" onClick={onEnd}>{t.walk.close}</Button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.walk} aria-label={t.walk.group}>
      <div className={styles.meta}>
        <b tabIndex={-1} ref={hold}>{t.walk.at(walk.i + 1, walk.ids.length)}</b>
        <span className={styles.grow} />
        <Button tone="ghost" size="dense" onClick={onEnd}>{t.walk.end}</Button>
      </div>
      <div className={`${styles.card} ${styles.active}`} data-cid={comment.id}>
        {comment.place.lost
          ? <p className={styles.quote}>„{comment.place.quote}”</p>
          : <button type="button" className={`${styles.quote} ${styles.jump}`} onClick={() => onJump(comment.place)}>„{comment.place.quote}”</button>}
        <p className={styles.body}>{comment.text}</p>
        {comment.replies.map((r) => <p key={r.id} className={styles.reply}>{r.text}</p>)}
      </div>
      <label className={styles.label}>{t.walk.fixLabel}
        <textarea className={styles.field} rows={3} value={fix} placeholder={t.walk.fixPlaceholder} maxLength={2000}
          onChange={(e) => setFix(e.target.value)} />
      </label>
      <div className={styles.actions}>
        <Button size="dense" busy={busy} onClick={() => void onResolve(comment, fix)}>{t.walk.done}</Button>
        <Button tone="secondary" size="dense" onClick={onSkip}>{t.walk.skip}</Button>
      </div>
      <p className={styles.muted}>{t.walk.hint}</p>
    </section>
  );
}
