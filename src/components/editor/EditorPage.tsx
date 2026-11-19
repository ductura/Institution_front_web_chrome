import type { ReactNode } from "react";

import { messagesHr as t } from "../../lib/i18n/messages.hr";

import styles from "./EditorPage.module.css";

/**
 * The editor page (WEB-14, E§1): the course and assignment above, one sheet
 * of paper up to 820 px wide with the work's title, and the status bar below.
 * `children` is what the sheet holds (the editor, or why there is none);
 * `status` is the StatusBar.
 */
export default function EditorPage({
  course,
  title,
  status,
  children,
}: {
  course: string | null;
  title: string | null;
  status: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <p className={styles.context}>{course !== null && title !== null ? `${course} / ${title}` : t.workspace.title}</p>
      <main id="sadrzaj" className={styles.area}>
        <article className={styles.sheet} aria-label={t.workspace.documentLabel}>
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
