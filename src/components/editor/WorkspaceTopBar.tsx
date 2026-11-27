"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Button } from "@ductura/ui";

import { useOnline } from "../../client/online-status";
import { messagesHr as t } from "../../lib/i18n/messages.hr";
import { appHref } from "../shell/nav";
import type { SheetTheme } from "../../lib/ui/sheet-theme";
import { setSheetTheme, useSheetTheme } from "../shell/useSheetTheme";
import { beforeCountText } from "./submission-rehearsal/declaration-gate";
import { rehearsalMessagesHr as rehearsal } from "./submission-rehearsal/messages.hr";

import styles from "./WorkspaceTopBar.module.css";

export type WorkspaceTopBarProps = {
  readonly assignmentId: string;
  /** EDI-R02: the prefix the app is served under (/aplikacija or /aplikacija); "" when it is served at the root. */
  readonly base?: string;
  /** The assignment's title, or null when the read could not give it. */
  readonly title: string | null;
  /** The line under the title ("Kolegij · rok 8. 11. 2026., 23:59"), or null when it is not known. */
  readonly subtitle?: string | null;
  /** A work that is read only has no "Predaja rada" (the prototype hides it). */
  readonly readOnly?: boolean;
  /** The work cannot be opened (greška, učitavanje): "Predaja rada" stays but does nothing. */
  readonly inert?: boolean;
  /**
   * WEB-NUZ-PREDAJA-1 (P-17): a hook of the host that counts what is left before the submission
   * (the rehearsal's "Što još fali"); null while it cannot say. Constant for the bar's life.
   */
  readonly useBeforeCount?: () => number | null;
};

/**
 * What the shell puts between the title and the actions (the view switch
 * "Pisanje / Kako vidi nastavnik" and the layout menu, prototype `.seg`). The
 * host provides it; without a provider the bar has nothing there.
 */
export const TopBarSlot = createContext<ReactNode>(null);

const OFFLINE_NOTE = "radni-prostor-bez-mreze";

/**
 * The top bar as it renders for one network state and sheet theme (VIZ-E1,
 * prototype `.top`, INVENTAR-editor §1.2): the mark "Ductura" (it leads to
 * "Moji zadaci"), the title with its course line as a pill, the shell's view
 * switch, one switch that names the sheet it would show ("Bijeli list" on the
 * dark sheet, "Tamni list" on the white one; `aria-pressed` is true while the
 * sheet is white) and "Predaja rada". "Predaja rada" opens the submission
 * screen; it does not submit. Without a network it is a disabled button with
 * the reason beside it, never a link that fails.
 */
export function WorkspaceTopBarView({
  assignmentId,
  base = "",
  title,
  subtitle = null,
  readOnly = false,
  inert = false,
  online,
  theme,
  onTheme,
  before = null,
}: Omit<WorkspaceTopBarProps, "useBeforeCount"> & { online: boolean; theme: SheetTheme; onTheme: (theme: SheetTheme) => void; before?: number | null }) {
  const light = theme === "light";
  const count = before !== null && before > 0 ? before : null;
  const things = count === null ? null : beforeCountText(count);
  // PR-1 (G-1): the whole name on wide screens, "Predaja" up to 640 px; the name read aloud is always the whole one.
  const label = <><span className={styles.wide}>{t.workspace.submitWork}</span><span className={styles.narrow} aria-hidden="true">{rehearsal.submitShort}</span></>;
  const slot = useContext(TopBarSlot);
  return (
    <header className={styles.bar} aria-label={t.workspace.barLabel}>
      <a className={styles.mark} href={appHref(base, "/zadaci")} title={t.workspace.backToAssignments} aria-label={`Ductura: ${t.workspace.backToAssignments.replace("← ", "")}`}>
        Ductu<b>ra</b>
      </a>
      <span className={styles.crumb}>
        <b>{title ?? t.workspace.title}</b>
        {subtitle ? <i>{subtitle}</i> : null}
      </span>
      <span className={styles.grow} />
      {/* PR-1 (G-1): the shell's switches give way (they scroll) before "Predaja rada" is cut. */}
      {slot === null ? null : <span className={styles.slot}>{slot}</span>}
      <div className={styles.actions} role="group" aria-label={t.workspace.sheetTheme}>
        <button type="button" className={styles.theme} aria-pressed={light} onClick={() => onTheme(light ? "dark" : "light")}>
          {light ? t.workspace.sheetThemeDark : t.workspace.sheetThemeLight}
        </button>
        {readOnly ? null : inert ? (
          <Button size="small" className={styles.primary} aria-disabled="true" aria-label={t.workspace.submitWork}>{label}</Button>
        ) : online ? (
          <span className={styles.submit}>
            <a className={styles.link} href={`/rad/${encodeURIComponent(assignmentId)}/predaja`}
              aria-label={things === null ? t.workspace.submitWork : `${t.workspace.submitWork}: ${things}`}>
              {label}
              {count === null ? null : <b className={styles.count} aria-hidden="true">{count}</b>}
            </a>
            {things === null ? null : <span className={styles.note} aria-hidden="true">{things}</span>}
          </span>
        ) : (
          <span className={styles.submit}>
            <Button size="small" className={styles.primary} disabled aria-label={t.workspace.submitWork} aria-describedby={OFFLINE_NOTE}>{label}</Button>
            <span id={OFFLINE_NOTE} className={styles.note}>{t.workspace.submitOffline}</span>
          </span>
        )}
      </div>
    </header>
  );
}

/** The top bar of /rad/[assignmentId], reading the browser's network and the page's sheet theme. */
export default function WorkspaceTopBar({ useBeforeCount = noCount, ...props }: WorkspaceTopBarProps) {
  const online = useOnline();
  const theme = useSheetTheme();
  const before = useBeforeCount();
  return <WorkspaceTopBarView {...props} online={online} theme={theme} onTheme={setSheetTheme} before={before} />;
}

const noCount = (): number | null => null;
