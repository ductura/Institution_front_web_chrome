"use client";

import { useState, type KeyboardEvent } from "react";

import { Icon, type IconName } from "../../icons/icons";
import { editorToolbarHr } from "./messages.hr";
import { toolbarIndex } from "./editor-toolbar-logic";
import styles from "./EditorToolbar.module.css";

export type EditorToolbarAction = {
  id: string;
  /** The accessible name; also the visible text above 640 px. */
  label: string;
  icon: IconName;
  onSelect: () => void;
  /** A toggle: shown with aria-pressed. */
  pressed?: boolean;
  disabled?: boolean;
  /** Announced as aria-keyshortcuts, e.g. "Control+B". */
  shortcut?: string;
};

export type EditorToolbarGroup = {
  id: string;
  label: string;
  actions: readonly EditorToolbarAction[];
  /** Hidden at narrow widths (still reachable through the keyboard shortcuts and the command palette). */
  secondary?: boolean;
};

export type EditorToolbarProps = {
  groups: readonly EditorToolbarGroup[];
  label?: string;
};

/**
 * The editor toolbar (M5.2, DAN-211): one Tab stop for the whole bar, arrows,
 * Home and End move between the buttons of all groups. Below 640 px the words
 * go and only the icons stay; a secondary group is hidden.
 */
export function EditorToolbar({ groups, label = editorToolbarHr.toolbar }: EditorToolbarProps) {
  const [active, setActive] = useState(0);
  const flat = groups.flatMap((g) => g.actions.map((a) => ({ group: g, action: a })));
  // The one tab stop sits on an enabled button: the active one, else the next enabled, else the first.
  const enabled = flat.map((f, i) => (f.action.disabled ? -1 : i)).filter((i) => i >= 0);
  const tabStop = enabled.includes(active) ? active : (enabled.find((i) => i > active) ?? enabled[0] ?? 0);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")].filter((b) => !b.disabled && (b.offsetParent !== null || !b.closest("[data-secondary]")));
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = toolbarIndex(current < 0 ? 0 : current, buttons.length, event.key);
    if (next === null) return;
    event.preventDefault();
    buttons[next]?.focus();
  };

  let index = -1;
  return (
    <div role="toolbar" aria-label={label} aria-orientation="horizontal" className={styles.toolbar} onKeyDown={onKeyDown}>
      {groups.map((group) => (
        <div key={group.id} role="group" aria-label={group.label} data-secondary={group.secondary ? "" : undefined}
          className={group.secondary ? `${styles.group} ${styles.secondary}` : styles.group}>
          {group.actions.map((a) => {
            index += 1;
            const i = index;
            return (
              <button key={a.id} type="button" className={styles.button} aria-label={a.label} title={a.label}
                aria-pressed={a.pressed} aria-keyshortcuts={a.shortcut} disabled={a.disabled}
                tabIndex={i === tabStop ? 0 : -1} onFocus={() => setActive(i)} onClick={a.onSelect}>
                <Icon name={a.icon} />
                <span className={styles.text} aria-hidden="true">{a.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
