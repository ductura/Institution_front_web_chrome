"use client";

// ED-110 (prototype tools.js RP.HK.foot, sessNew/sessStart/sessEnd): the writing session at the foot of
// the right panel. A small goal for this sitting, its progress in the row, and at the end what was written,
// per chapter, with the previous sessions. Kept on this device only; the student alone sees it.
import { Button, Dialog, SegmentedControl } from "@ductura/ui";
import { useEffect, useMemo, useState } from "react";

import { useDeviceValue, useWorkSnapshot } from "../left/use-left";
import { writingSessionHr as t } from "./messages.hr";
import {
  DEFAULT_GOALS, MINUTE_GOALS, SHOWN_LOG, WORD_GOALS, chapterWords, logAdd, minutesSince, parseGoals, parseLog, parseSession,
  startSession, summarize, type Goals, type LogEntry, type Session, type Summary,
} from "./session-model";
import styles from "./WritingSession.module.css";

const TICK_MS = 30_000;
const NONE = "none";
const when = new Intl.DateTimeFormat("hr-HR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export function WritingSessionHost({ workId, readOnly }: { workId: string; readOnly: boolean }) {
  const snap = useWorkSnapshot();
  const [session, setSession] = useDeviceValue<Session | null>("session", workId, parseSession, null);
  const [log, setLog] = useDeviceValue<readonly LogEntry[]>("sessionLog", workId, parseLog, []);
  const [goals, setGoals] = useDeviceValue<Goals>("sessionGoals", "all", parseGoals, DEFAULT_GOALS);
  const [choosing, setChoosing] = useState(false);
  const [done, setDone] = useState<{ summary: Summary; previous: readonly LogEntry[] } | null>(null);
  const now = useNow(session !== null);
  const chapters = useMemo(() => chapterWords(snap.headings, snap.words, t.untitled), [snap.headings, snap.words]);

  if (readOnly) return null;

  const begin = (picked: Goals) => {
    setGoals(picked);
    setSession(startSession(picked, snap.total, chapters, Date.now()));
    setChoosing(false);
  };
  const end = () => {
    if (!session) return;
    const at = Date.now();
    const summary = summarize(session, snap.total, chapters, at);
    setDone({ summary, previous: log.slice(-SHOWN_LOG).reverse() });
    setLog(logAdd(log, summary, at));
    setSession(null);
  };

  return <div className={styles.row} data-writing-session="">
    {session ? <>
      <span><b>{t.session}</b> <span>{t.progressWords(snap.total - session.w0, session.goalW)}</span>{", "}
        <span>{t.progressMinutes(minutesSince(session, now), session.goalM)}</span></span>
      <Button tone="quiet" onClick={end}>{t.end}</Button>
    </> : <>
      <Button tone="quiet" onClick={() => setChoosing(true)}>{t.start}</Button>
      <span className={styles.muted}>{t.startHint}</span>
    </>}
    {choosing && <GoalDialog initial={goals} onCancel={() => setChoosing(false)} onBegin={begin} />}
    {done && <SummaryDialog summary={done.summary} previous={done.previous} onClose={() => setDone(null)} />}
  </div>;
}

function GoalDialog({ initial, onCancel, onBegin }: { initial: Goals; onCancel: () => void; onBegin: (goals: Goals) => void }) {
  const [picked, setPicked] = useState(initial);
  const value = (n: number | null) => (n === null ? NONE : String(n));
  const read = (v: string) => (v === NONE ? null : Number(v));
  return <Dialog open title={t.dialogTitle} onClose={onCancel} actions={<>
    <Button tone="quiet" onClick={onCancel}>{t.cancel}</Button>
    <Button onClick={() => onBegin(picked)}>{t.begin}</Button>
  </>}>
    <p>{t.intro}</p>
    <div className={styles.goal}>
      <span>{t.wordsGoal}</span>
      <SegmentedControl label={t.wordsGoal} value={value(picked.words)} onChange={(v) => setPicked({ ...picked, words: read(v) })}
        options={[...WORD_GOALS.map((n) => ({ value: String(n), label: String(n) })), { value: NONE, label: t.noGoal }]} />
    </div>
    <div className={styles.goal}>
      <span>{t.minutesGoal}</span>
      <SegmentedControl label={t.minutesGoal} value={value(picked.minutes)} onChange={(v) => setPicked({ ...picked, minutes: read(v) })}
        options={[...MINUTE_GOALS.map((n) => ({ value: String(n), label: t.minutes(n) })), { value: NONE, label: t.noGoal }]} />
    </div>
  </Dialog>;
}

function SummaryDialog({ summary, previous, onClose }: { summary: Summary; previous: readonly LogEntry[]; onClose: () => void }) {
  const { words, minutes, goalW, chapters } = summary;
  const goalText = goalW === null ? "" : words >= goalW ? t.goalReached(goalW) : t.goalLeft(goalW - words);
  return <Dialog open title={t.doneTitle} onClose={onClose} actions={<Button onClick={onClose}>{t.close}</Button>}>
    <p>{t.written(words, minutes)}{goalText}</p>
    <h3 className={styles.heading}>{t.byChapter}</h3>
    {chapters.length === 0 ? <p className={styles.muted}>{t.noChapterChange}</p> : <ul className={styles.list}>
      {chapters.map((chapter) => <li key={chapter.title}><span>{chapter.title}</span><span>{t.delta(chapter.delta)}</span></li>)}
    </ul>}
    {previous.length > 0 && <>
      <h3 className={styles.heading}>{t.previous}</h3>
      <ul className={styles.list}>
        {previous.map((entry) => <li key={entry.at}><span>{when.format(entry.at)}</span><span>{t.logLine(entry.words, entry.min)}</span></li>)}
      </ul>
    </>}
    <p className={styles.muted}>{t.private}</p>
  </Dialog>;
}
