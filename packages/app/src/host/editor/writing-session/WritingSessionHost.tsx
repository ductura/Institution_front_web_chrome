"use client";

// ED-77 (paritet, prototip tools.js „DANAŠNJA SESIJA”): the footer of the right panel. Without a session it offers
// "Započni sesiju pisanja"; the dialog sets a small goal; while it runs the footer shows words and minutes against
// the goal, and "Završi" opens the summary by chapter with the last sessions. Kept on this device, per person.
import { useEffect, useState } from "react";
import { Button, Dialog, SegmentedControl } from "@ductura/ui";
import type { useLocalEditor } from "@/components/editor/LocalDocument";

import { readReviewDoc } from "../../../../../../src/components/editor/review/model";
import { momentHr } from "../../student/work/frame";
import { writingSessionHr as t } from "./messages.hr";
import {
  appendLog, DEFAULT_GOAL, loadLog, loadSession, MINUTE_GOALS, minutesOf, recentSessions, saveSession, startSession,
  summarize, totalWords, WORD_GOALS, type LoggedSession, type OpenSession, type SessionStorage, type SessionSummary,
} from "./session-model";

type Editor = NonNullable<ReturnType<typeof useLocalEditor>>;

const browserStorage = (): SessionStorage | null => { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } };

/** Words of the open work, read again on every change of the text while `live`. */
function useWords(editor: Editor | null | undefined, live: boolean): number | null {
  const read = () => (editor && !editor.isDestroyed ? totalWords(readReviewDoc(editor.state.doc)) : null);
  const [words, setWords] = useState<number | null>(null);
  useEffect(() => {
    if (!live) return;
    setWords(read);
    if (!editor || editor.isDestroyed) return;
    const update = () => setWords(read);
    editor.on("update", update);
    return () => { editor.off("update", update); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, live]);
  return words;
}

/** The time now, refreshed every 30 seconds while `live` (the prototype's footer interval). */
function useNow(live: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [live]);
  return now;
}

export function WritingSessionHost({ editor, scope, workId, readOnly }: {
  editor: Editor | null | undefined;
  /** The person's journal scope: what is kept on this device is kept under it. */
  scope: string;
  workId: string;
  /** A submitted work, or a signed-out session: no footer. */
  readOnly: boolean;
}) {
  const [session, setSession] = useState<OpenSession | null>(null);
  const [log, setLog] = useState<readonly LoggedSession[]>([]);
  const [asking, setAsking] = useState(false);
  const [goal, setGoal] = useState<{ words: number; minutes: number }>({ ...DEFAULT_GOAL });
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  useEffect(() => {
    const storage = browserStorage();
    setSession(loadSession(storage, scope, workId));
    setLog(loadLog(storage, scope, workId));
  }, [scope, workId]);
  const words = useWords(editor, session !== null);
  const now = useNow(session !== null);
  if (readOnly) return null;

  const begin = () => {
    if (!editor || editor.isDestroyed) return;
    const next = startSession(readReviewDoc(editor.state.doc), goal, Date.now());
    saveSession(browserStorage(), scope, workId, next);
    setSession(next);
    setAsking(false);
  };
  const finish = () => {
    if (!session || !editor || editor.isDestroyed) return;
    const at = Date.now();
    const done = summarize(session, readReviewDoc(editor.state.doc), at);
    const storage = browserStorage();
    setLog(appendLog(storage, scope, workId, { endedAt: at, words: done.words, minutes: done.minutes }));
    saveSession(storage, scope, workId, null);
    setSession(null);
    setSummary(done);
  };

  return (
    <div data-writing-session="" role="group" aria-label={t.footer}
      style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: "100%" }}>
      {session === null ? <>
        <Button tone="quiet" onClick={() => setAsking(true)} disabled={!editor}>{t.start}</Button>
        <span style={{ color: "var(--ink-3)" }}>{t.startHint}</span>
      </> : <>
        <span data-session-progress="" role="status">
          <b style={{ fontWeight: 600, marginRight: 4 }}>{t.label}</b>
          {t.running((words ?? session.startWords) - session.startWords, session.goalWords, minutesOf(session, now), session.goalMinutes)}
        </span>
        <span style={{ flex: 1 }} />
        <Button onClick={finish}>{t.end}</Button>
      </>}
      <Dialog open={asking} title={t.dialogTitle} onClose={() => setAsking(false)}
        actions={<><Button tone="quiet" onClick={() => setAsking(false)}>{t.cancel}</Button><Button tone="primary" onClick={begin}>{t.confirm}</Button></>}>
        <p>{t.dialogIntro}</p>
        <h3>{t.words}</h3>
        <SegmentedControl label={t.words} value={String(goal.words)} onChange={(v) => setGoal((g) => ({ ...g, words: Number(v) }))}
          options={WORD_GOALS.map((n) => ({ value: String(n), label: t.wordGoal(n) }))} />
        <h3>{t.time}</h3>
        <SegmentedControl label={t.time} value={String(goal.minutes)} onChange={(v) => setGoal((g) => ({ ...g, minutes: Number(v) }))}
          options={MINUTE_GOALS.map((n) => ({ value: String(n), label: t.minuteGoal(n) }))} />
      </Dialog>
      <Dialog open={summary !== null} title={t.doneTitle} onClose={() => setSummary(null)}
        actions={<Button tone="primary" onClick={() => setSummary(null)}>{t.close}</Button>}>
        {summary !== null && <>
          <p>
            <b>{t.doneLead(summary.words, summary.minutes)}</b>
            {summary.goalWords > 0 && ` ${summary.words >= summary.goalWords ? t.goalReached(summary.goalWords) : t.goalLeft(summary.goalWords - summary.words)}`}
          </p>
          <h3>{t.byChapter}</h3>
          {summary.chapters.length === 0 ? <p>{t.noChapterChange}</p> : <ul style={{ listStyle: "none", padding: 0 }}>
            {summary.chapters.map((c) => <li key={c.title} style={{ display: "flex", gap: 8 }}>
              <b style={{ flex: 1 }}>{c.title}</b><span style={{ fontVariantNumeric: "tabular-nums" }}>{t.chapterDelta(c.delta)}</span>
            </li>)}
          </ul>}
          <h3>{t.previous}</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {recentSessions(log).map((s, i) => <li key={`${s.endedAt}-${i}`} style={{ display: "flex", gap: 8 }}>
              <span style={{ flex: 1 }}>{momentHr(new Date(s.endedAt).toISOString()) ?? ""}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{t.previousRow(s.words, s.minutes)}</span>
            </li>)}
          </ul>
          <p>{t.private}</p>
        </>}
      </Dialog>
    </div>
  );
}
