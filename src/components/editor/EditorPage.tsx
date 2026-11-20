"use client";

import type { ReactNode } from "react";

import { messagesHr as t } from "../../lib/i18n/messages.hr";
import { useSheetTheme } from "../shell/useSheetTheme";

import styles from "./EditorPage.module.css";

/**
 * The editor page (WEB-14, E§1): the course and assignment above, one sheet
 * of paper up to 820 px wide with the work's title, and the status bar below.
 * `children` is what the sheet holds (the editor, or why there is none);
 * `status` is the StatusBar; `toolbar`, when the editor is mounted, sits
 * above the sheet (WEB-15), outside it, so it never scrolls away with the text.
 * `topBar` (WEB-23, S: E-7) takes the place of the course line; the sheet
 * carries the page's sheet theme, which the top bar switches.
 */
export default function EditorPage({
  course,
  title,
  status,
  toolbar = null,
  topBar = null,
  children,
}: {
  course: string | null;
  title: string | null;
  status: ReactNode;
  toolbar?: ReactNode;
  topBar?: ReactNode;
  children: ReactNode;
}) {
  const theme = useSheetTheme();
  return (
    <div className={styles.page}>
      {topBar ?? (
        <p className={styles.context}>{course !== null && title !== null ? `${course} / ${title}` : t.workspace.title}</p>
      )}
      {/* Always rendered, so the grid keeps its rows with or without a toolbar. */}
      <div className={styles.toolbar}>{toolbar}</div>
      <main id="sadrzaj" className={styles.area}>
        <article className={`sheet ${styles.sheet}`} data-sheet-theme={theme} aria-label={t.workspace.documentLabel}>
          <h1 className={styles.title}>{title ?? t.workspace.documentUntitled}</h1>
          {children}
        </article>
      </main>
      {status}
    </div>
  );
}

/** A line on the sheet in place of the editor: why there is nothing to write into. */
export function SheetNote({ children }: { children: ReactNode }) {
  return <p className={styles.note} role="note">{children}</p>;
}
