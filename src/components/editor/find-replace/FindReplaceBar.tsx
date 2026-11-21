"use client";

import { useMemo, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { Button, FindBar, stepHit } from "@ductura/ui";

import { findMatches, inSourceQuote, replaceEvery, replaceOne, type HostOutcome } from "./find-replace-model";
import { findReplaceHr as t } from "./messages.hr";
import styles from "./FindReplaceBar.module.css";

/**
 * Find and replace under the editor's command row (WEB-1605 part 2): the
 * shared FindBar for the query and the hits, and one row for the
 * replacement, matching case, "Zamijeni" and "Zamijeni sve". The hit shown
 * is selected in the editor without taking the focus from the field. A
 * locked work can be searched but not changed.
 */
export function FindReplaceBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [current, setCurrent] = useState(0);
  const [message, setMessage] = useState("");
  const view = useEditorState({ editor, selector: ({ editor: e }) => ({ doc: e.state.doc, editable: e.isEditable }) });
  const doc = view?.doc ?? editor.state.doc;
  const editable = view?.editable ?? editor.isEditable;
  const result = useMemo(() => findMatches(doc, query, matchCase), [doc, query, matchCase]);
  const total = result?.matches.length ?? 0;
  const shown = total === 0 ? 0 : Math.min(current, total - 1);

  const show = (index: number) => {
    const match = result?.matches[index];
    setCurrent(index);
    setMessage("");
    if (match && !editor.isDestroyed) editor.chain().setTextSelection({ from: match.from, to: match.to }).scrollIntoView().run();
  };
  const step = (direction: 1 | -1) => {
    const index = stepHit(shown, total, direction);
    if (index >= 0) show(index);
  };
  const apply = (outcome: HostOutcome, count: () => string) => {
    if (!outcome.ok) {
      setMessage(t.refusal[outcome.reason]);
      return;
    }
    editor.view.dispatch(outcome.tr);
    setMessage(count());
  };
  const replaceShown = () => {
    if (result) apply(replaceOne(editor.state, result, shown, replacement), () => t.replaced(1));
  };
  const replaceAll = () => {
    if (!result) return;
    const kept = result.matches.some((match) => inSourceQuote(result.doc, match));
    const outcome = replaceEvery(editor.state, result, replacement);
    apply(outcome, () => `${t.replaced(outcome.ok ? outcome.count : 0)}${kept ? ` ${t.quotesKept}` : ""}`);
  };
  const canReplace = editable && total > 0;

  return (
    <div className={styles.panel}>
      <FindBar query={query} onQueryChange={(next) => { setQuery(next); setCurrent(0); setMessage(""); }}
        current={shown} total={total} onNext={() => step(1)} onPrevious={() => step(-1)} onClose={onClose}
        labels={{ search: t.search, next: t.next, previous: t.previous, close: t.close, none: t.none, count: t.count }} />
      <div className={styles.row} onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
      }}>
        <input type="text" className={styles.input} value={replacement} placeholder={t.replacement} aria-label={t.replacement}
          autoComplete="off" spellCheck={false} disabled={!editable} onChange={(event) => setReplacement(event.target.value)} />
        <label className={styles.check}>
          <input type="checkbox" checked={matchCase} onChange={(event) => { setMatchCase(event.target.checked); setCurrent(0); }} />
          {t.matchCase}
        </label>
        <Button tone="quiet" disabled={!canReplace} onClick={replaceShown}>{t.replace}</Button>
        <Button tone="quiet" disabled={!canReplace} onClick={replaceAll}>{t.replaceAll}</Button>
      </div>
      <p className={styles.message} role="status" aria-live="polite">{message}</p>
    </div>
  );
}
