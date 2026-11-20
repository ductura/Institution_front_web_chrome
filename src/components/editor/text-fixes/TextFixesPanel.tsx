"use client";

/**
 * Sitnice and "Riješi redom" of the Pregled card (WEB-1103). Sitnice lists the
 * small writing slips with a fix for each and one for all of them; "Riješi
 * redom" walks the open findings of the review in order. Every change is an
 * editor transaction (see `fixes.ts`); nothing is sent from here.
 */

import { useMemo, useState } from "react";
import { Button } from "@ductura/ui";
import { useEditorState, type Editor } from "@tiptap/react";

import { jumpTo, readReviewDoc, runChecks } from "../review";
import { ignore, readIgnored, splitIgnored, writeIgnored } from "../review/ignored";
import { applyAllFixes, applyFix, scanFixes, type ApplyOutcome } from "./fixes";
import { textFixesMessagesHr as t } from "./messages.hr";
import { fixFor, stepAfter } from "./steps";

export type TextFixesPanelProps = {
  editor: Editor | null;
  /** The work; "nije greška" is kept per work, shared with the Pregled card. */
  documentId: string;
  /** Check ids the institution enabled; null when none were read. */
  enabledCheckIds: readonly string[] | null;
};

const storage = (): Storage | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };
const fill = (text: string, n: number, total?: number) => text.replace("{n}", String(n)).replace("{total}", String(total ?? ""));

export function TextFixesPanel({ editor, documentId, enabledCheckIds }: TextFixesPanelProps) {
  const doc = useEditorState({ editor, selector: ({ editor: e }) => (e && !e.isDestroyed ? e.state.doc : null), equalityFn: (a, b) => a === b });
  const scan = useMemo(() => (doc ? scanFixes(doc) : null), [doc]);
  const findings = useMemo(() => (doc ? runChecks(readReviewDoc(doc), enabledCheckIds) : []), [doc, enabledCheckIds]);
  const [walking, setWalking] = useState(false);
  const [cur, setCur] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  if (!editor || editor.isDestroyed || !scan) return null;

  // Read at each render and merged at each write: the Pregled card keeps its marks under the same key.
  const open = splitIgnored(findings, readIgnored(storage(), documentId)).open;
  const run = (outcome: ApplyOutcome, done: string) => {
    if (!outcome.ok) { setNote(outcome.reason === "stale" ? t.stale : t.empty); return; }
    editor.view.dispatch(outcome.tr);
    setNote(done.replace("{n}", String(outcome.count)));
  };
  const atCur = cur === null ? -1 : open.findIndex((f) => f.id === cur);
  // The finding shown stays until it is solved or marked; then the walk continues with the one after it.
  const step = !walking ? null : atCur >= 0 ? { finding: open[atCur]!, index: atCur, total: open.length } : stepAfter(open, cur, seen);
  const go = (afterId: string | null) => {
    const next = stepAfter(open, afterId, open.map((f) => f.id));
    setSeen(open.map((f) => f.id));
    setCur(next ? next.finding.id : null);
    if (next) jumpTo(editor, next.finding);
    else setWalking(false);
    setNote(next ? null : t.step.done);
  };
  const stepFix = step ? fixFor(step.finding, scan.fixes) : null;

  return (
    <section aria-label={t.title}>
      <p>{t.intro}</p>
      <p role="status">{scan.fixes.length === 0 ? t.empty : fill(t.count, scan.fixes.length)}</p>
      {scan.fixes.length > 0 && (
        <ul aria-label={t.list}>
          {scan.fixes.map((fix) => (
            <li key={fix.id}>
              <strong>{t.kind[fix.kind]}</strong> {fix.excerpt}{" "}
              <Button tone="quiet" onClick={() => run(applyFix(editor.state, scan, fix.id), t.fixedOne)}>{t.fixOne}</Button>
            </li>
          ))}
        </ul>
      )}
      {scan.fixes.length > 1 && <Button onClick={() => run(applyAllFixes(editor.state, scan), t.fixedAll)}>{fill(t.fixAll, scan.fixes.length)}</Button>}
      {scan.skippedProvenance > 0 && <p role="status">{fill(t.skipped, scan.skippedProvenance)}</p>}

      <h3>{t.step.title}</h3>
      {!step && <Button tone="quiet" disabled={open.length === 0} onClick={() => { setWalking(true); go(null); }}>{open.length === 0 ? t.step.none : t.step.start}</Button>}
      {walking && step && (
        <div role="group" aria-label={t.step.title}>
          <p role="status">{fill(t.step.position, step.index + 1, step.total)}: {step.finding.excerpt}</p>
          {stepFix ? (
            <Button onClick={() => { run(applyFix(editor.state, scan, stepFix.id), t.fixedOne); }}>{t.fixOne}</Button>
          ) : <p>{t.step.noFix}</p>}
          <Button tone="quiet" onClick={() => { writeIgnored(storage(), documentId, ignore(readIgnored(storage(), documentId), step.finding.key)); go(step.finding.id); }}>{t.step.notAnError}</Button>
          <Button tone="quiet" onClick={() => go(step.finding.id)}>{t.step.next}</Button>
          <Button tone="quiet" onClick={() => setWalking(false)}>{t.step.stop}</Button>
        </div>
      )}
      {note && <p role="status">{note}</p>}
    </section>
  );
}
