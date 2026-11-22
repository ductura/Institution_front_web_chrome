"use client";

// WEB-2128: the cards of the left panel of the writing help (plus.js):
// "Sljedeći korak", "Nastavi gdje ste stali", "Brzi skok", "Ravnoteža
// poglavlja", "Rokovi". They take the work as data and report a click as a
// callback; mounting them into the panel and moving the cursor is the shell's.
import { useState } from "react";

import { Button, TextArea } from "@ductura/ui";

import type { AssistChapter } from "./blocks";
import { balanceRows, statusText, type BalanceStatus } from "./balance";
import { deadlineRows, type Deadline } from "./deadlines";
import { chipsOf, filterHeadings, nextPlace, type JumpKind, type JumpPlace } from "./jump";
import type { Step, StepTarget } from "./next-step";
import { assistHr as t } from "./messages.hr";
import styles from "./Assist.module.css";

export function NextStepCard({ steps, onGo }: { steps: readonly Step[]; onGo: (target: StepTarget) => void }) {
  const [more, setMore] = useState(false);
  const [first, ...rest] = steps;
  if (!first) return null;
  const go = (step: Step) => { if (step.target) onGo(step.target); };
  return (
    <section className={styles.card} aria-label={t.next.label} data-next-step="">
      <span className={styles.label}>{t.next.label}</span>
      <button type="button" className={`${styles.next} ${styles.nextMain}`} onClick={() => go(first)}>{first.text}</button>
      {rest.length > 0 && (
        <>
          <button type="button" className={styles.chip} aria-expanded={more} onClick={() => setMore(!more)}>{more ? t.next.less : t.next.more(rest.length)}</button>
          {more && <ul className={styles.list}>{rest.map((step, i) => <li key={i}><button type="button" className={styles.next} onClick={() => go(step)}>{step.text}</button></li>)}</ul>}
        </>
      )}
    </section>
  );
}

export function ResumeCard({ chapter, selfNote, editable, onGo, onSaveNote }: {
  chapter: AssistChapter | null; selfNote: string; editable: boolean; onGo: (id: string) => void; onSaveNote: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <section className={styles.card} data-resume="">
      {chapter && <button type="button" className={styles.next} onClick={() => onGo(chapter.id)}>{t.resume.label(chapter.number, chapter.title)}</button>}
      {selfNote !== "" && (
        <div data-self-note="">
          <b>{t.resume.noteTitle}</b>
          <p>{selfNote}</p>
          {chapter && <Button tone="quiet" onClick={() => onGo(chapter.id)}>{t.resume.go}</Button>}
          {editable && <Button tone="quiet" onClick={() => onSaveNote("")}>{t.resume.delete}</Button>}
        </div>
      )}
      {editable && selfNote === "" && (
        <>
          <TextArea label={t.resume.noteTitle} hint={t.resume.hint} placeholder={t.resume.notePlaceholder} rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Button tone="quiet" disabled={draft.trim() === ""} onClick={() => { onSaveNote(draft); setDraft(""); }}>{t.resume.save}</Button>
        </>
      )}
    </section>
  );
}

export function QuickJump({ chapters, places, onJump }: {
  chapters: readonly AssistChapter[]; places: Readonly<Partial<Record<JumpKind, readonly JumpPlace[]>>>; onJump: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState<Partial<Record<JumpKind, number>>>({});
  const shown = filterHeadings(chapters, query);
  return (
    <section className={styles.card} data-quick-jump="">
      <input type="search" value={query} placeholder={t.jump.search} aria-label={t.jump.searchLabel} onChange={(e) => setQuery(e.target.value)} />
      <div className={styles.chips}>
        {chipsOf(places).map((chip) => (
          <button key={chip.kind} type="button" className={styles.chip} title={t.jump.title} onClick={() => {
            const next = nextPlace(chip.places, cursor[chip.kind] ?? -1);
            if (!next) return;
            setCursor({ ...cursor, [chip.kind]: next.cursor });
            onJump(next.place.chapterId);
          }}>{chip.label}</button>
        ))}
      </div>
      {query.trim() !== "" && (shown.length === 0
        ? <p className={styles.muted}>{t.jump.none}</p>
        : <ul className={styles.list}>{shown.map((c) => <li key={c.id}><button type="button" className={styles.row} onClick={() => onJump(c.id)}>{c.number} {c.title}</button></li>)}</ul>)}
    </section>
  );
}

export function BalancePanel({ chapters, targets, status, canDistribute, onDistribute, onJump }: {
  chapters: readonly AssistChapter[]; targets: Readonly<Record<string, number | undefined>>; status: BalanceStatus;
  /** false for the mentor view and when the range of the work is not given. */
  canDistribute: boolean; onDistribute: () => number | null; onJump: (id: string) => void;
}) {
  const [armed, setArmed] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const rows = balanceRows(chapters, targets);
  const hasGoals = Object.keys(targets).length > 0;
  return (
    <section className={styles.card} aria-label={t.balance.title} data-balance="">
      <h3>{t.balance.title}</h3>
      <p>{statusText(status)} <span className={styles.muted}>{t.balance.markerHint}</span></p>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" className={styles.row} onClick={() => onJump(row.id)}>
              <span>{row.number} {row.title}</span>
              <span className={styles.bar} aria-hidden="true"><i style={{ width: `${row.fill}%` }} data-over={row.over ? "" : undefined} />{row.marker !== null && <b style={{ left: `${row.marker}%` }} />}</span>
              <span className={styles.muted}>{row.text}</span>
            </button>
          </li>
        ))}
      </ul>
      {canDistribute && (
        <>
          <Button tone="quiet" onClick={() => {
            if (hasGoals && !armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
            setArmed(false);
            setDone(onDistribute());
          }}>{armed ? t.balance.distributeConfirm : t.balance.distribute}</Button>
          <p className={styles.muted} role="status">{done !== null ? t.balance.distributed(done) : t.balance.note}</p>
        </>
      )}
    </section>
  );
}

export function DeadlinesPanel({ deadlines, facts, today }: { deadlines: readonly Deadline[] | null; facts: readonly string[]; today: Date }) {
  if (deadlines === null) return <p className={styles.muted}>{t.deadlines.unavailable}</p>;
  const rows = deadlineRows(deadlines, today);
  if (rows.length === 0 && facts.length === 0) return <p className={styles.muted}>{t.deadlines.empty}</p>;
  return (
    <section className={styles.card} aria-label={t.deadlines.title} data-deadlines="">
      <ul className={styles.list}>{rows.map((row) => <li key={row.key}><b>{row.label}</b> {row.when}<br /><span className={styles.muted}>{row.note}</span></li>)}</ul>
      {facts.length > 0 && <><b>{t.deadlines.faculty}</b><ul className={styles.list}>{facts.map((f) => <li key={f}>{f}</li>)}</ul></>}
    </section>
  );
}
