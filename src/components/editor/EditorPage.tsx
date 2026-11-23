"use client";

import type { ReactNode } from "react";

import { messagesHr as t } from "../../lib/i18n/messages.hr";
import { useSheetTheme } from "../shell/useSheetTheme";

import { EditorShellFrame } from "./layout/EditorShell";

import styles from "./EditorPage.module.css";

/**
 * The editor page (WEB-14, VIZ-E1, E§1): the prototype's frame (48 px top bar, tools,
 * stage, 30 px status bar), one sheet
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
  aside,
  banner = null,
  heading = true,
  stand = null,
  children,
}: {
  course: string | null;
  title: string | null;
  status: ReactNode;
  toolbar?: ReactNode;
  topBar?: ReactNode;
  aside?: ReactNode;
  /** A note above the sheet, in the canvas (prototype `.ed-banner`: offline, submitted). */
  banner?: ReactNode;
  /** False: no title on the sheet (a new work shows only its placeholder). */
  heading?: boolean;
  /** When given, shown in the canvas in place of the sheet (the work could not be opened, or is loading). */
  stand?: ReactNode;
  children: ReactNode;
}) {
  const theme = useSheetTheme();
  return (
    <EditorShellFrame
      header={topBar ?? <p className={styles.context}>{course !== null && title !== null ? `${course} / ${title}` : t.workspace.title}</p>}
      tools={toolbar}
      status={status}
    >
      {banner}
      {stand ?? (
        <article className={`sheet ${styles.sheet}`} data-sheet-theme={theme} aria-label={t.workspace.documentLabel}>
          {heading ? <h1 className={styles.title}>{title ?? t.workspace.documentUntitled}</h1> : null}
          {children}
        </article>
      )}
      {aside}
    </EditorShellFrame>
  );
}

/** A line on the sheet in place of the editor: why there is nothing to write into. */
export function SheetNote({ children }: { children: ReactNode }) {
  return <p className={styles.note} role="note">{children}</p>;
}
