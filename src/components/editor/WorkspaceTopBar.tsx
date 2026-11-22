"use client";

import { Button } from "@ductura/ui";

import { useOnline } from "../../client/online-status";
import { messagesHr as t } from "../../lib/i18n/messages.hr";
import type { SheetTheme } from "../../lib/ui/sheet-theme";
import { setSheetTheme, useSheetTheme } from "../shell/useSheetTheme";

import styles from "./WorkspaceTopBar.module.css";

export type WorkspaceTopBarProps = {
  readonly assignmentId: string;
  /** The assignment's title, or null when the read could not give it. */
  readonly title: string | null;
  /** The line under the title ("Kolegij · rok 8. 11. 2026., 23:59"), or null when it is not known. */
  readonly subtitle?: string | null;
  /** A work that is read only has no "Predaja rada" (the prototype hides it). */
  readonly readOnly?: boolean;
  /** The work cannot be opened (greška, učitavanje): "Predaja rada" stays but does nothing. */
  readonly inert?: boolean;
};

const OFFLINE_NOTE = "radni-prostor-bez-mreze";

/**
 * The top bar as it renders for one network state and sheet theme (WEB-23,
 * S: E-7, prototype `.ed-top`): "← Moji zadaci", the title with its course
 * line, one switch that names the sheet it would show ("Bijeli list" on the
 * dark sheet, "Tamni list" on the white one; `aria-pressed` is true while the
 * sheet is white) and "Predaja rada". "Predaja rada" opens the submission
 * screen; it does not submit. Without a network it is a disabled button with
 * the reason beside it, never a link that fails.
 */
export function WorkspaceTopBarView({
  assignmentId,
  title,
  subtitle = null,
  readOnly = false,
  inert = false,
  online,
  theme,
  onTheme,
}: WorkspaceTopBarProps & { online: boolean; theme: SheetTheme; onTheme: (theme: SheetTheme) => void }) {
  const light = theme === "light";
  return (
    <header className={styles.bar} aria-label={t.workspace.barLabel}>
      <a className={styles.back} href="/zadaci">{t.workspace.backToAssignments}</a>
      <div className={styles.heading}>
        <b>{title ?? t.workspace.title}</b>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      <div className={styles.actions} role="group" aria-label={t.workspace.sheetTheme}>
        <Button
          tone="secondary"
          size="small"
          className={styles.theme}
          aria-pressed={light}
          onClick={() => onTheme(light ? "dark" : "light")}
        >
          {light ? t.workspace.sheetThemeDark : t.workspace.sheetThemeLight}
        </Button>
        {readOnly ? null : inert ? (
          <Button size="small" className={styles.primary} aria-disabled="true">{t.workspace.submitWork}</Button>
        ) : online ? (
          <a className={styles.link} href={`/rad/${encodeURIComponent(assignmentId)}/predaja`}>{t.workspace.submitWork}</a>
        ) : (
          <span className={styles.submit}>
            <Button size="small" className={styles.primary} disabled aria-describedby={OFFLINE_NOTE}>{t.workspace.submitWork}</Button>
            <span id={OFFLINE_NOTE} className={styles.note}>{t.workspace.submitOffline}</span>
          </span>
        )}
      </div>
    </header>
  );
}

/** The top bar of /rad/[assignmentId], reading the browser's network and the page's sheet theme. */
export default function WorkspaceTopBar(props: WorkspaceTopBarProps) {
  const online = useOnline();
  const theme = useSheetTheme();
  return <WorkspaceTopBarView {...props} online={online} theme={theme} onTheme={setSheetTheme} />;
}
