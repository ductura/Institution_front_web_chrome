"use client";

// ED-37 (P2-6, dio 4): what the chapter row shows after the title, as in the
// prototype (rail.js `rst` and `small.fix`): the state dot the student set in
// the chapter sheet and how many of the chapter's own tasks are still open
// ("za popraviti"). Both stay on this device and follow the sheet at once.
import { useState } from "react";

import { loadNotes, notesKey, openTodos, type NoteStorage } from "../assist/work-notes";
import { defaultState, parseStates, type ChapterState } from "./left-model";
import { leftHr as t } from "./messages.hr";
import { useDeviceChange, useDeviceValue } from "./use-left";
import styles from "./Left.module.css";

function noteStorage(): NoteStorage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

/** The row's marks as data: the state the student set (or the default from the words) and the open tasks. */
export function chapterMarks(set: ChapterState | undefined, words: number, open: number): { state: ChapterState; fix: number } {
  return { state: set ?? defaultState(words), fix: Math.max(0, open) };
}

export function ChapterMarks({ workId, headingId, words }: { workId: string; headingId: string; words: number }) {
  const [states] = useDeviceValue("states", workId, parseStates, {});
  const [notes, setNotes] = useState(() => loadNotes(noteStorage(), workId));
  useDeviceChange(notesKey(workId), () => setNotes(loadNotes(noteStorage(), workId)));
  const marks = chapterMarks(states[headingId], words, openTodos(notes, headingId).length);
  return (
    <span className={styles.marks} data-chapter-marks="">
      {marks.fix > 0 && <small className={styles.fix}>{t.chapter.toFix(marks.fix)}</small>}
      <span className={styles.dot} data-state={marks.state} role="img" aria-label={t.chapter.stateOf(t.chapter.states[marks.state])} title={t.chapter.stateOf(t.chapter.states[marks.state])} />
    </span>
  );
}
