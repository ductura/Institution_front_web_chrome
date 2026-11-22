"use client";

// WEB-2128: the card of a chapter (advice.js and plus.js): role of the
// chapter, "Što ovdje ide", "Za pogledati, iz Vašeg teksta", the chapter
// review before "gotovo", the plan, own tasks and sources in the chapter.
// Per-chapter facts that only the server knows (what the mentor saw, notes of
// sources waiting) are stated as unavailable instead of invented.
import { useState } from "react";

import { Button, Details, Dialog, Select, TextArea, TextField } from "@ductura/ui";

import { observationsOf, ROLE_KEYS, roleOf, isRole, type AdviceInput } from "./advice";
import { norm, ownAndSub } from "./blocks";
import { assistHr as t } from "./messages.hr";
import { openTodos, planItemInText, type WorkNotes } from "./work-notes";
import styles from "./Assist.module.css";

export type ChapterHelpProps = {
  readonly input: AdviceInput;
  readonly chapterId: string;
  readonly notes: WorkNotes;
  /** false in the mentor and read-only views: no select, no buttons, the hints stay visible. */
  readonly editable: boolean;
  /** "Autor (godina)" labels of the sources cited in the chapter; null when the editor cannot list them. */
  readonly sourceLabels: readonly string[] | null;
  readonly onRole: (role: (typeof ROLE_KEYS)[number]) => void;
  readonly onPlan: (text: string) => void;
  readonly onTodoAdd: (text: string) => void;
  readonly onTodoDone: (id: string, done: boolean) => void;
  readonly onTodoRemove: (id: string) => void;
  /** Marks the chapter "gotovo" after the review; absent when the shell has no chapter status. */
  readonly onMarkDone?: () => void;
  readonly onJump: (id: string) => void;
};

export function ChapterHelp(props: ChapterHelpProps) {
  const { input, chapterId, notes, editable, sourceLabels } = props;
  const chapter = input.chapters.find((c) => c.id === chapterId);
  const [review, setReview] = useState(false);
  const [dialog, setDialog] = useState<null | "plan" | "task">(null);
  const [draft, setDraft] = useState("");
  if (!chapter) return null;
  const top = chapter.parentId === null;
  const role = roleOf(input.chapters, chapterId, input.roles);
  const agg = top ? ownAndSub(input.chapters, chapterId) : { text: chapter.text, words: chapter.words, cites: chapter.cites };
  const { ready, items } = observationsOf(input, chapterId);
  const plan = notes.plans[chapterId] ?? [];
  const open = openTodos(notes, chapterId);
  const subs = input.chapters.filter((c) => c.parentId === chapterId);
  const close = () => { setDialog(null); setDraft(""); };
  return (
    <section data-chapter-help={chapterId}>
      {top && editable && (
        <Select label={t.roleLabel} value={role} options={ROLE_KEYS.map((k) => ({ value: k, label: t.roles[k] }))}
          onChange={(e) => { if (isRole(e.target.value)) props.onRole(e.target.value); }} />
      )}
      {top && (
        <Details summary={agg.words < 30 && plan.length === 0 ? t.recSummary : t.recSummaryOpen} open={agg.words < 30 && plan.length === 0 ? true : undefined}>
          <p>{t.recIntro(t.roles[role])}</p>
          <ul>{t.rec[role].map((line) => <li key={line}>{line}</li>)}</ul>
        </Details>
      )}
      {ready && items.length > 0 ? (
        <div data-observations="">
          <b>{t.observationsTitle}</b>
          <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
          <small className={styles.muted}>{t.source}</small>
        </div>
      ) : agg.words > 0 ? <p className={styles.muted}>{t.observationsLater}</p> : null}
      {editable && agg.words > 0 && top && <Button tone="quiet" onClick={() => setReview(true)}>{t.review.open}</Button>}

      {top && (
        <Details summary={t.chapter.plan(plan.length)}>
          {plan.length === 0 ? <p>{t.chapter.planIntro}</p> : (
            <ul>{plan.map((item) => (
              <li key={item}>{item}{agg.words >= 150 && <small> · {planItemInText(item, agg.text, norm) ? t.chapter.planIn : t.chapter.planNot}</small>}</li>
            ))}</ul>
          )}
          {editable && <Button tone="quiet" onClick={() => { setDraft(plan.join("\n")); setDialog("plan"); }}>{plan.length === 0 ? t.chapter.planWrite : t.chapter.planEdit}</Button>}
        </Details>
      )}

      {top && (
        <Details summary={t.chapter.tasks(open.length)}>
          <ul className={styles.list}>{(notes.todos[chapterId] ?? []).map((todo) => (
            <li key={todo.id}>
              <label><input type="checkbox" checked={todo.done} disabled={!editable} onChange={(e) => props.onTodoDone(todo.id, e.target.checked)} /> <span className={todo.done ? styles.done : undefined}>{todo.text}</span></label>
              {editable && <button type="button" aria-label={t.chapter.taskDelete} onClick={() => props.onTodoRemove(todo.id)}>×</button>}
            </li>
          ))}</ul>
          {editable && <Button tone="quiet" onClick={() => setDialog("task")}>{t.chapter.taskAdd}</Button>}
        </Details>
      )}

      {top && (
        <Details summary={t.chapter.sources(sourceLabels?.length ?? 0)}>
          {sourceLabels === null ? <p>{t.chapter.pendingUnavailable}</p> : sourceLabels.length === 0 ? <p>{t.chapter.noSources}</p> : <p>{sourceLabels.join(", ")}</p>}
        </Details>
      )}
      {top && <p className={styles.muted}>{t.chapter.mentorUnavailable}</p>}

      <Dialog open={review} title={t.review.title} onClose={() => setReview(false)} actions={(
        <>
          <Button tone="quiet" onClick={() => setReview(false)}>{props.onMarkDone ? t.review.later : t.review.close}</Button>
          {props.onMarkDone && <Button onClick={() => { props.onMarkDone?.(); setReview(false); }}>{t.review.markDone}</Button>}
        </>
      )}>
        <p>{t.review.heading(chapter.number, chapter.title, agg.words, agg.cites, t.roles[role])}</p>
        {agg.words < 150 ? <p>{t.review.tooShort}</p> : items.length > 0 ? (
          <><b>{t.observationsTitle}</b><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></>
        ) : <p>{t.review.nothing}</p>}
        {subs.length > 0 && <><b>{t.review.subchapters}</b><ul>{subs.map((s) => <li key={s.id}><button type="button" onClick={() => { setReview(false); props.onJump(s.id); }}>{s.number} {s.title}</button></li>)}</ul></>}
        <p className={styles.muted}>{t.review.footer}</p>
      </Dialog>

      <Dialog open={dialog === "plan"} title={t.chapter.planDialog} onClose={close} actions={(
        <><Button tone="quiet" onClick={close}>{t.chapter.cancel}</Button><Button onClick={() => { props.onPlan(draft); close(); }}>{t.chapter.planSave}</Button></>
      )}>
        <TextArea label={t.chapter.planHint} rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} />
      </Dialog>

      <Dialog open={dialog === "task"} title={t.chapter.taskDialog} onClose={close} actions={(
        <><Button tone="quiet" onClick={close}>{t.chapter.cancel}</Button><Button disabled={draft.trim() === ""} onClick={() => { props.onTodoAdd(draft); close(); }}>{t.chapter.taskSave}</Button></>
      )}>
        <TextField label={t.chapter.taskLabel} placeholder={t.chapter.taskPlaceholder} value={draft} onChange={(e) => setDraft(e.target.value)} />
      </Dialog>
    </section>
  );
}
