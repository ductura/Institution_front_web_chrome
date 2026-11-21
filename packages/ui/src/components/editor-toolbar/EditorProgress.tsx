"use client";

import { editorToolbarHr } from "./messages.hr";
import { groupWords, progressOf, rangeText, type ProgressStatus, type WordRange } from "./editor-toolbar-logic";
import styles from "./EditorToolbar.module.css";

export type EditorProgressProps = {
  /** Words of the body, footnotes left out (bodyWordCount). */
  words: number;
  range: WordRange | null;
  label?: string;
};

const STATUS_TEXT: Record<ProgressStatus, string> = {
  noRange: editorToolbarHr.progressNoRange,
  below: editorToolbarHr.progressBelow,
  within: editorToolbarHr.progressWithin,
  above: editorToolbarHr.progressAbove,
};

/**
 * Progress against the assignment's range (M5.2, DAN-214): "210 / 2 000–2 500
 * riječi". The words are the body's, footnotes left out. Never blocks anything;
 * the bar is a reading aid and says so in words, not by colour alone.
 */
export function EditorProgress({ words, range, label = editorToolbarHr.progress }: EditorProgressProps) {
  const p = progressOf(words, range);
  const text = p.status === "noRange" ? `${groupWords(p.words)} ${editorToolbarHr.progressWords}` : `${groupWords(p.words)} / ${rangeText(range)} ${editorToolbarHr.progressWords}`;
  return (
    <div className={styles.progress} data-status={p.status}>
      <div className={styles.line}>
        <span>{label}: <b>{text}</b></span>
        <span className={styles.note}>{STATUS_TEXT[p.status]} · {editorToolbarHr.progressNote}</span>
      </div>
      {p.target !== null && (
        <div className={styles.bar} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={p.target}
          aria-valuenow={Math.min(p.words, p.target)} aria-valuetext={`${text}. ${STATUS_TEXT[p.status]}`}>
          <div className={styles.fill} style={{ width: `${Math.round(p.fraction * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
