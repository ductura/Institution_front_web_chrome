"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { findStatus, stepHit } from "@ductura/ui";

import { findMatches, inSourceQuote, replaceEvery, replaceOne, type HostOutcome } from "../find-replace/find-replace-model";
import { chapterRange, inScope, type FindScope } from "./find-scope";
import { findRowHr as t } from "./messages.hr";
import styles from "./FindRow.module.css";

/**
 * The find bar as the prototype draws it (`#find`, INVENTAR-editor §1.4): one
 * row with the query, the replacement, the scope (whole work, this chapter,
 * only in quotes), "Dalje", "Zamijeni", "Sve", the message and "✕". It does
 * what FindReplaceBar does (same search, same rules: no replacing in a source
 * quote, one undo for "Sve", a locked work is searched but not changed) and
 * adds the scope. Enter = next, Shift+Enter = previous, Esc closes.
 */
export function FindRow({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [scope, setScope] = useState<FindScope>("all");
  const [matchCase, setMatchCase] = useState(false);
  const [current, setCurrent] = useState(0);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.select(), []);
  const view = useEditorState({ editor, selector: ({ editor: e }) => ({ doc: e.state.doc, editable: e.isEditable, head: e.state.selection.head }) });
  const doc = view?.doc ?? editor.state.doc;
  const editable = view?.editable ?? editor.isEditable;
  const head = view?.head ?? editor.state.selection.head;

  const result = useMemo(() => {
    const found = findMatches(doc, query, matchCase);
    if (!found) return null;
    const matches = inScope(found.matches, scope, chapterRange(doc, head), (m) => inSourceQuote(found.doc, m));
    return { ...found, matches };
    // The chapter is the one the cursor was in when the search began; the cursor moving to a hit must not move it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, query, matchCase, scope]);
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
    if (!outcome.ok) return setMessage(t.refusal[outcome.reason]);
    editor.view.dispatch(outcome.tr);
    setMessage(count());
  };
  const replaceShown = () => result && apply(replaceOne(editor.state, result, shown, replacement), () => t.replaced(1));
  const replaceAll = () => {
    if (!result) return;
    const outcome = replaceEvery(editor.state, result, replacement);
    const kept = result.matches.some((m) => inSourceQuote(result.doc, m));
    apply(outcome, () => `${t.replaced(outcome.ok ? outcome.count : 0)}${kept ? ` ${t.quotesKept}` : ""}`);
  };

  const status = findStatus(query, shown, total);
  const hits = status.kind === "hit" ? t.count(status.position, status.total) : status.kind === "none" ? t.none : "";
  const canReplace = editable && total > 0;
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Enter" && event.target === input.current) {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
    }
  };

  return (
    <div className={styles.find} role="search" aria-label={t.search} onKeyDown={onKeyDown}>
      <input ref={input} type="search" className={styles.in} value={query} placeholder={t.search} aria-label={t.search}
        autoComplete="off" spellCheck={false} onChange={(e) => { setQuery(e.target.value); setCurrent(0); setMessage(""); }} />
      <input type="text" className={styles.in} value={replacement} placeholder={t.replacement} aria-label={t.replacementLabel}
        autoComplete="off" spellCheck={false} disabled={!editable} onChange={(e) => setReplacement(e.target.value)} />
      <select className={styles.sel} value={scope} aria-label={t.scopeLabel}
        onChange={(e) => { setScope(e.target.value as FindScope); setCurrent(0); setMessage(""); }}>
        <option value="all">{t.scope.all}</option>
        <option value="chap">{t.scope.chap}</option>
        <option value="quote">{t.scope.quote}</option>
      </select>
      <button type="button" className={styles.case} aria-pressed={matchCase} aria-label={t.matchCaseLabel} title={t.matchCaseLabel}
        onClick={() => { setMatchCase(!matchCase); setCurrent(0); }}>{t.matchCase}</button>
      <button type="button" className={styles.btn} aria-label={t.nextLabel} title={t.nextLabel} disabled={total === 0} onClick={() => step(1)}>{t.next}</button>
      <button type="button" className={styles.btn} disabled={!canReplace} onClick={replaceShown}>{t.replace}</button>
      <button type="button" className={styles.btn} aria-label={t.allLabel} title={t.allLabel} disabled={!canReplace} onClick={replaceAll}>{t.all}</button>
      <span className={styles.msg} role="status" aria-live="polite">{message || hits}</span>
      <span className={styles.grow} />
      <button type="button" className={styles.x} aria-label={t.closeLabel} title={t.closeLabel} onClick={onClose}>{t.close}</button>
    </div>
  );
}
