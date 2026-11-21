"use client";

import { editorToolbarHr } from "./messages.hr";
import styles from "./EditorToolbar.module.css";

export type OutlineEntry = { id: string; number: string; title: string; level: 1 | 2 | 3 };

export type EditorOutlineProps = {
  entries: readonly OutlineEntry[];
  /** The id of the heading that holds the cursor. */
  currentId?: string | null;
  onSelect: (id: string) => void;
  label?: string;
};

/** The list of headings (M5.2, DAN-211): indented by level, the current one marked, a click goes to it. */
export function EditorOutline({ entries, currentId = null, onSelect, label = editorToolbarHr.outline }: EditorOutlineProps) {
  if (entries.length === 0) return <p className={styles.empty}>{editorToolbarHr.outlineEmpty}</p>;
  return (
    <nav aria-label={label}>
      <ol className={styles.outline}>
        {entries.map((entry) => (
          <li key={entry.id} className={styles.item} data-level={entry.level}>
            <button type="button" className={styles.link} aria-current={entry.id === currentId ? "location" : undefined}
              onClick={() => onSelect(entry.id)}>
              <span className={styles.number}>{entry.number}.</span> {entry.title === "" ? editorToolbarHr.outlineUntitled : entry.title}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
