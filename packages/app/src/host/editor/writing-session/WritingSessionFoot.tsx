"use client";

/**
 * ED-96: the right panel's foot (prototype RP.HK.foot): "Započni sesiju pisanja", while one runs
 * "Sesija +N / cilj riječi, M / cilj min" with "Završi", then the summary. Only on this device.
 */
import { useEffect, useState } from "react";
import { Button, Dialog, SegmentedControl } from "@ductura/ui";
import type { Editor } from "@tiptap/core";

import { useDeviceValue } from "../left/use-left";
import {
  countsOf, DEFAULT_GOAL, endSession, footLine, LOG_KEPT, parseGoal, parseLog, parseSession, sessionHr as t,
  signed, startSession, summaryLine, TIME_GOALS, whenOf, WORD_GOALS, wordsWord, type SessionSummary, type WorkCounts,
} from "./session-model";
import styles from "./WritingSession.module.css";

const TICK_MS = 30_000;
const EMPTY: WorkCounts = { total: 0, chapters: [] };

export function WritingSessionFoot({ editor, workId, hidden = false, now = Date.now }: {
  editor: Editor | null; workId: string;
  /** A submitted work, or a signed-out page: no foot. */
  hidden?: boolean;
  now?: () => number;
}) {
  const [session, setSession] = useDeviceValue("writing-session", workId, parseSession, null);
  const [log, setLog] = useDeviceValue("writing-session-log", workId, parseLog, []);
  const [goal, setGoal] = useDeviceValue("writing-session-goal", workId, parseGoal, DEFAULT_GOAL);
  const [dialog, setDialog] = useState<"pick" | SessionSummary | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => tick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, [session]);
  if (hidden) return null;
  const counts = () => (editor && !editor.isDestroyed ? countsOf(editor.state.doc) : EMPTY);
  const begin = () => { setSession(startSession(counts(), goal, now())); setDialog(null); };
  const end = () => {
    if (!session) return;
    const at = now();
    const sum = endSession(session, counts(), at);
    setLog([...log, { when: whenOf(at), words: sum.words, min: sum.min }].slice(-LOG_KEPT));
    setSession(null);
    setDialog(sum);
  };
  const pick = (key: "w" | "m", values: readonly number[], label: string) => (
    <SegmentedControl label={label} value={String(goal[key])} onChange={(v) => setGoal({ ...goal, [key]: Number(v) })}
      options={values.map((v) => ({ value: String(v), label: v === 0 ? t.noGoal : key === "m" ? `${v} min` : String(v) }))} />
  );
  return <>
    <div className={styles.foot} data-writing-session="">
      {session ? <>
        <span className={styles.line}><b>{t.label}</b> {footLine(session, counts(), now())}</span>
        <Button tone="secondary" size="small" onClick={end}>{t.end}</Button>
      </> : <>
        <button type="button" className={styles.link} onClick={() => setDialog("pick")}>{t.start}</button>
        <span className={styles.muted}>{t.startHint}</span>
      </>}
    </div>
    {dialog === "pick" && <Dialog open title={t.title} onClose={() => setDialog(null)} actions={<>
      <Button tone="quiet" onClick={() => setDialog(null)}>{t.cancel}</Button>
      <Button onClick={begin}>{t.begin}</Button>
    </>}>
      <p className={styles.muted}>{t.intro}</p>
      <p className={styles.title}>{t.words}</p>
      {pick("w", WORD_GOALS, t.words)}
      <p className={styles.title}>{t.time}</p>
      {pick("m", TIME_GOALS, t.time)}
    </Dialog>}
    {dialog !== null && dialog !== "pick" && <Summary sum={dialog} log={log} onClose={() => setDialog(null)} />}
  </>;
}

function Summary({ sum, log, onClose }: { sum: SessionSummary; log: readonly { when: string; words: number; min: number }[]; onClose: () => void }) {
  const line = summaryLine(sum);
  return (
    <Dialog open title={t.doneTitle} onClose={onClose} actions={<Button onClick={onClose}>{t.close}</Button>}>
      <p><b>{line.lead}</b>{line.rest}</p>
      <p className={styles.title}>{t.byChapter}</p>
      {sum.ch.length ? <ul className={styles.rows}>
        {sum.ch.map((c) => <li key={c.title}><b>{c.title}</b><span className={styles.muted}>{signed(c.delta)}</span></li>)}
      </ul> : <p className={styles.muted}>{t.noChapterChange}</p>}
      <p className={styles.title}>{t.previous}</p>
      <ul className={styles.rows}>
        {log.slice(-5).reverse().map((x, i) => <li key={`${x.when}-${i}`}><span>{x.when}</span><span className={styles.muted}>{signed(x.words)} {wordsWord(Math.abs(x.words))}, {x.min} min</span></li>)}
      </ul>
      <p className={styles.muted}>{t.onlyYou}</p>
    </Dialog>
  );
}
