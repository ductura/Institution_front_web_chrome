"use client";

// WEB-2126: the sections of the left panel (Zahtjevi, Prikazi i fusnote,
// Odloženo, Napredak, Rokovi, Nit rada). Only what the work itself holds is
// shown; the faculty's rules, the submission and revision deadlines and the
// sources count come from the server and say "nedostupno" until it gives them.
import { Button, TextField } from "@ductura/ui";
import { useRef, useState, type ReactNode } from "react";

import { useLocalEditor } from "../../../../../../src/components/editor/LocalDocument.tsx";
import { ChapterLength } from "../chapter-length/ChapterLength";
import { useChapterTargets } from "../chapter-length/use-chapter-targets";
import {
  addDeadline, daysUntil, EMPTY_THREAD, goalStatus, MAX_HYPOTHESES, pagesOf, parseDeadlines, parseStash, parseThread, preview,
  progressRatio, stashAdd, stashRemove, type OwnDeadline,
} from "./left-model";
import { leftHr as t } from "./messages.hr";
import { useDeviceValue, useWorkSnapshot } from "./use-left";
import styles from "./Left.module.css";

type Props = { workId: string };
const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

function Requirements() {
  const snap = useWorkSnapshot();
  const targets = useChapterTargets(true);
  const rows = snap.headings.flatMap((h, i) => {
    const goal = h.id ? targets.get(h.id) : undefined;
    return goal ? [{ h, goal, words: snap.words[i] ?? 0 }] : [];
  });
  return (
    <div className={styles.stack}>
      <h3>{t.requirements.heading}</h3>
      {rows.length === 0 ? <p className={styles.muted}>{t.requirements.none}</p> : (
        <ul className={styles.list}>
          {rows.map(({ h, goal, words }) => {
            const status = goalStatus(words, goal);
            return (
              <li key={h.id ?? h.pos} className={styles.item}>
                <span>{h.number}. {h.title}<br /><ChapterLength words={words} target={goal} /></span>
                <span className={styles.chip}>{status === "met" ? t.requirements.met : status === "below" ? t.requirements.below(goal.min ?? 0) : t.requirements.above(goal.max ?? 0)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className={styles.muted}>{t.requirements.rulesUnavailable}</p>
    </div>
  );
}

function Figures() {
  const editor = useLocalEditor();
  const { figures } = useWorkSnapshot();
  if (figures.length === 0) return <p className={styles.muted}>{t.figures.none}</p>;
  const go = (pos: number) => {
    if (!editor || editor.isDestroyed) return;
    editor.chain().setTextSelection(Math.min(pos + 1, editor.state.doc.content.size)).scrollIntoView().focus().run();
  };
  return (
    <ol className={styles.list}>
      {figures.map((f, i) => (
        <li key={`${f.kind}-${f.pos}`} className={styles.item}>
          <span>{t.figures[f.kind]} {i + 1}{f.text ? ` · ${preview(f.text, 40)}` : ""}</span>
          <Button tone="quiet" onClick={() => go(f.pos)}>{t.figures.go}</Button>
        </li>
      ))}
    </ol>
  );
}

function Stash({ workId }: Props) {
  const editor = useLocalEditor();
  const snap = useWorkSnapshot();
  const [items, setItems] = useDeviceValue("stash", workId, parseStash, []);
  const [message, setMessage] = useState("");
  const live = Boolean(editor && !editor.isDestroyed && editor.isEditable);
  const stashSelection = () => {
    if (!editor || !live || snap.selected.trim() === "") return setMessage(t.stash.selectFirst);
    setItems(stashAdd(items, snap.selected, newId(), new Date().toISOString()));
    editor.chain().deleteSelection().focus().run();
    setMessage(t.stash.stashed);
  };
  const restore = (text: string, id: string) => {
    if (!editor || !live) return;
    editor.chain().insertContent(text).focus().run();
    setItems(stashRemove(items, id));
    setMessage(t.stash.restored);
  };
  return (
    <div className={styles.stack}>
      <Button tone="quiet" disabled={!live} onClick={stashSelection}>{t.stash.stashSelection}</Button>
      {items.length === 0 ? <p className={styles.muted}>{t.stash.empty}</p> : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <span>{preview(item.text)}</span>
              <span>
                <Button tone="quiet" disabled={!live} onClick={() => restore(item.text, item.id)}>{t.stash.restore}</Button>
                <Button tone="quiet" onClick={() => setItems(stashRemove(items, item.id))}>{t.stash.remove}</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.muted}>{t.stash.hint}</p>
      <p role="status" className={styles.live}>{message}</p>
    </div>
  );
}

function Progress() {
  const snap = useWorkSnapshot();
  const targets = useChapterTargets(true);
  const start = useRef<number | null>(null);
  if (start.current === null && snap.headings.length > 0) start.current = snap.total;
  const goals = snap.headings.flatMap((h, i) => (h.id && targets.get(h.id) ? [{ h, goal: targets.get(h.id)!, words: snap.words[i] ?? 0 }] : []));
  const met = goals.filter((g) => goalStatus(g.words, g.goal) === "met").length;
  const current = snap.headings[snap.current];
  const goal = current?.id ? targets.get(current.id) : undefined;
  return (
    <div className={styles.stack}>
      <p>{t.progress.words(snap.total)} · {t.progress.pages(pagesOf(snap.total))}</p>
      <p className={styles.muted}>{t.progress.session(snap.total - (start.current ?? snap.total))}</p>
      <p className={styles.muted}>{t.progress.sources}: {t.progress.sourcesUnavailable}</p>
      <p className={styles.muted}>{t.progress.deadline}: {t.progress.deadlineUnavailable}</p>
      {goals.length > 0 && <p>{t.progress.goals(met, goals.length)}</p>}
      {current && <p className={styles.muted}>{t.progress.footer(snap.words[snap.current] ?? 0, goal?.min ?? null, goal?.max ?? null)}</p>}
      <h3>{t.progress.byChapter}</h3>
      <ul className={styles.list}>
        {snap.headings.map((h, i) => {
          const g = h.id ? targets.get(h.id) : undefined;
          const ratio = progressRatio(snap.words[i] ?? 0, g);
          return (
            <li key={h.id ?? h.pos}>
              <span>{h.number}. {h.title} · {snap.words[i] ?? 0}</span>
              {ratio !== null && <div className={styles.bar} role="progressbar" aria-label={`${h.number}. ${h.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}><span style={{ inlineSize: `${ratio * 100}%` }} /></div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Deadlines({ workId, now = new Date() }: Props & { now?: Date }) {
  const [items, setItems] = useDeviceValue<OwnDeadline[]>("deadlines", workId, parseDeadlines, []);
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const add = () => {
    const next = addDeadline(items, label, date, newId());
    if (!next) return setError(t.deadlines.invalid);
    setItems(next);
    setLabel(""); setDate(""); setError("");
  };
  const when = (iso: string) => {
    const days = daysUntil(iso, now);
    return days === null ? "" : days < 0 ? t.deadlines.late(-days) : t.deadlines.in(days);
  };
  return (
    <div className={styles.stack}>
      <p>{t.deadlines.submission}: <span className={styles.muted}>{t.deadlines.submissionUnavailable}</span></p>
      <p>{t.deadlines.revision}: <span className={styles.muted}>{t.deadlines.revisionUnavailable}</span></p>
      <p>{t.deadlines.faculty}: <span className={styles.muted}>{t.deadlines.facultyUnavailable}</span></p>
      <h3>{t.deadlines.own}</h3>
      {items.length === 0 ? <p className={styles.muted}>{t.deadlines.ownEmpty}</p> : (
        <ul className={styles.list}>
          {items.map((d) => (
            <li key={d.id} className={styles.item}>
              <span>{d.label} · {d.date} · {when(d.date)}</span>
              <Button tone="quiet" aria-label={`${t.deadlines.remove}: ${d.label}`} onClick={() => setItems(items.filter((x) => x.id !== d.id))}>×</Button>
            </li>
          ))}
        </ul>
      )}
      <TextField label={t.deadlines.label} value={label} maxLength={80} onChange={(e) => setLabel(e.currentTarget.value)} />
      <TextField label={t.deadlines.date} type="date" value={date} onChange={(e) => setDate(e.currentTarget.value)} error={error || undefined} />
      <Button tone="quiet" onClick={add}>{t.deadlines.add}</Button>
    </div>
  );
}

function Thread({ workId }: Props) {
  const [thread, setThread] = useDeviceValue("thread", workId, parseThread, EMPTY_THREAD);
  const [draft, setDraft] = useState("");
  return (
    <div className={styles.stack}>
      <p><strong>{t.thread.question}:</strong> {thread.question || <span className={styles.muted}>{t.thesis.empty}</span>}</p>
      <h3>{t.thread.hypotheses}</h3>
      {thread.hypotheses.length === 0 ? <p className={styles.muted}>{t.thread.noHypotheses}</p> : (
        <ol className={styles.list}>
          {thread.hypotheses.map((h, i) => (
            <li key={`${i}-${h}`} className={styles.item}>
              <span><strong>{t.thread.hypothesisOf(i + 1)}</strong> {h}</span>
              <Button tone="quiet" aria-label={`${t.thread.removeHypothesis} ${t.thread.hypothesisOf(i + 1)}`}
                onClick={() => setThread({ ...thread, hypotheses: thread.hypotheses.filter((_, j) => j !== i) })}>×</Button>
            </li>
          ))}
        </ol>
      )}
      <TextField label={t.thread.hypothesisText} value={draft} maxLength={500} onChange={(e) => setDraft(e.currentTarget.value)} />
      <Button tone="quiet" disabled={draft.trim() === "" || thread.hypotheses.length >= MAX_HYPOTHESES}
        onClick={() => { setThread({ ...thread, hypotheses: [...thread.hypotheses, draft.trim()] }); setDraft(""); }}>{t.thread.addHypothesis}</Button>
      <h3>{t.thread.wholeWork}</h3>
      <p className={styles.muted}>{t.thread.wholeWorkHint}</p>
    </div>
  );
}

/** The six sections, keyed as the left panel expects them. */
export function leftSectionsFor(workId: string): Record<"requirements" | "figures" | "stash" | "progress" | "deadlines" | "thread", ReactNode> {
  return {
    requirements: <Requirements />, figures: <Figures />, stash: <Stash workId={workId} />,
    progress: <Progress />, deadlines: <Deadlines workId={workId} />, thread: <Thread workId={workId} />,
  };
}

export { Deadlines, Figures, Progress, Requirements, Stash, Thread };
