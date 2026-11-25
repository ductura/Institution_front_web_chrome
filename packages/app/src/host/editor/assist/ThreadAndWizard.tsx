"use client";

// WEB-2128: "Nit rada" (question of the work, hypotheses table, notes about
// the whole) and the three-step "Započnite rad".
import { useState } from "react";

import { Button, Dialog, TextArea, TextField } from "@ductura/ui";

import { wholeNotes, threadTable, type AdviceInput } from "./advice";
import { assistHr as t, type KindKey } from "./messages.hr";
import { chaptersOfKind, DEFAULT_KIND, KIND_KEYS, makeSkeleton, wizardAllowed, type Skeleton } from "./wizard";
import styles from "./Assist.module.css";

export function ThreadPanel({ input, editable, onThesis, onJump }: { input: AdviceInput; editable: boolean; onThesis: (text: string) => void; onJump: (id: string) => void }) {
  const notes = wholeNotes(input);
  const table = threadTable(input.chapters);
  return (
    <section className={styles.card} aria-label={t.thread.title} data-thread="">
      <p>{t.thread.intro}</p>
      {editable
        ? <TextArea label={t.thread.thesisLabel} placeholder={t.thread.thesisPlaceholder} rows={3} value={input.thesis} onChange={(e) => onThesis(e.target.value)} />
        : <p>{input.thesis !== "" ? input.thesis : t.thread.thesisEmpty}</p>}
      {table.rows.length === 0 ? <p className={styles.muted}>{t.thread.noHypotheses}</p> : (
        <>
          <p className={styles.muted}>{t.thread.tableIntro}</p>
          <table className={styles.table}>
            <thead><tr><th scope="col">{t.thread.hypothesis}</th>{table.columns.map((c) => <th key={c.id} scope="col">{c.number}</th>)}</tr></thead>
            <tbody>{table.rows.map((row) => (
              <tr key={row.label}><th scope="row">{row.label}</th>{row.cells.map((hit, i) => <td key={i} aria-label={hit ? t.thread.mentionedIn : undefined}>{hit ? "●" : ""}</td>)}</tr>
            ))}</tbody>
          </table>
        </>
      )}
      <ul className={styles.list}>{notes.map((note) => (
        <li key={note.text}>{note.text}{note.hint && <><br /><span className={styles.muted}>{note.hint}</span></>}
          {note.chapterId && <> <button type="button" className={styles.chip} onClick={() => onJump(note.chapterId!)}>{t.thread.jump}</button></>}
        </li>
      ))}</ul>
    </section>
  );
}

export function StartWizard({ open, chapterCount, profileLabel, onClose, onCreate }: {
  open: boolean; chapterCount: number; profileLabel: string | null; onClose: () => void;
  /** Puts the skeleton into the work; false when the work cannot take it. */
  onCreate: (skeleton: Skeleton) => boolean;
}) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<KindKey>(DEFAULT_KIND);
  const [question, setQuestion] = useState("");
  const [chapters, setChapters] = useState(chaptersOfKind(DEFAULT_KIND).join("\n"));
  const [error, setError] = useState<string | undefined>();
  const reset = () => { setStep(0); setError(undefined); };
  const finish = () => { reset(); onClose(); };
  if (!wizardAllowed(chapterCount)) {
    return <Dialog open={open} title={t.wizard.title} onClose={onClose} actions={<Button onClick={onClose}>{t.review.close}</Button>}><p>{t.wizard.alreadyHas}</p></Dialog>;
  }
  const actions = (
    <>
      <Button tone="quiet" onClick={step === 0 ? finish : () => setStep(step - 1)}>{step === 0 ? t.wizard.cancel : t.wizard.back}</Button>
      {step < 2
        ? <Button onClick={() => { if (step === 0) setChapters(chaptersOfKind(kind).join("\n")); setStep(step + 1); }}>{t.wizard.next}</Button>
        : <Button onClick={() => {
          const skeleton = makeSkeleton(title, question, chapters);
          if (!skeleton || !onCreate(skeleton)) { setError(t.wizard.unavailable); return; }
          finish();
        }}>{t.wizard.make}</Button>}
    </>
  );
  return (
    <Dialog open={open} title={t.wizard.title} onClose={finish} actions={actions} error={error}>
      <ol aria-label={t.wizard.title}>{t.wizard.steps.map((s, i) => <li key={s} aria-current={i === step ? "step" : undefined}>{s}</li>)}</ol>
      {step === 0 && (
        <>
          <p>{t.wizard.profile(profileLabel)}</p>
          <TextField label={t.wizard.titleLabel} placeholder={t.wizard.titlePlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} />
          <p><b>{t.wizard.kind}</b></p>
          <div className="segmented">{KIND_KEYS.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{t.wizard.kinds[k].label}</button>
          ))}</div>
        </>
      )}
      {step === 1 && (
        <>
          <TextArea label={t.wizard.questionTitle} placeholder={t.wizard.questionPlaceholder} rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} />
          {kind === "emp" && <p className={styles.muted}>{t.wizard.hypothesesNote}</p>}
        </>
      )}
      {step === 2 && <TextArea label={t.wizard.skeletonTitle} hint={t.wizard.skeletonHint} rows={7} value={chapters} onChange={(e) => setChapters(e.target.value)} />}
    </Dialog>
  );
}
