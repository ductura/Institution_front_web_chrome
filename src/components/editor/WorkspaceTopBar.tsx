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
};

const THEMES: readonly { key: SheetTheme; label: string }[] = [
  { key: "light", label: t.workspace.sheetThemeLight },
  { key: "dark", label: t.workspace.sheetThemeDark },
];

const OFFLINE_NOTE = "radni-prostor-bez-mreze";

/**
 * The top bar as it renders for one network state and sheet theme (WEB-23,
 * S: E-7): "← Moji zadaci", the title, the sheet switch and "Predaja rada".
 * "Predaja rada" opens the submission screen; it does not submit. Without a
 * network it is a disabled button with the reason beside it, never a link
 * that fails. The pressed theme is announced by `aria-pressed`.
 */
export function WorkspaceTopBarView({
  assignmentId,
  title,
  online,
  theme,
  onTheme,
}: WorkspaceTopBarProps & { online: boolean; theme: SheetTheme; onTheme: (theme: SheetTheme) => void }) {
  return (
    <header className={styles.bar} aria-label={t.workspace.barLabel}>
      <a className={styles.back} href="/zadaci">{t.workspace.backToAssignments}</a>
      <p className={styles.title}>{title ?? t.workspace.title}</p>
      <div className={styles.themes} role="group" aria-label={t.workspace.sheetTheme}>
        {THEMES.map(({ key, label }) => (
          <Button key={key} tone="quiet" aria-pressed={theme === key} onClick={() => onTheme(key)}>
            {label}
          </Button>
        ))}
      </div>
      {online ? (
        <a className="btn" href={`/rad/${encodeURIComponent(assignmentId)}/predaja`}>{t.workspace.submitWork}</a>
      ) : (
        <span className={styles.submit}>
          <Button disabled aria-describedby={OFFLINE_NOTE}>{t.workspace.submitWork}</Button>
          <span id={OFFLINE_NOTE} className={styles.note}>{t.workspace.submitOffline}</span>
        </span>
      )}
    </header>
  );
}

/** The top bar of /rad/[assignmentId], reading the browser's network and the page's sheet theme. */
export default function WorkspaceTopBar(props: WorkspaceTopBarProps) {
  const online = useOnline();
  const theme = useSheetTheme();
  return <WorkspaceTopBarView {...props} online={online} theme={theme} onTheme={setSheetTheme} />;
}
