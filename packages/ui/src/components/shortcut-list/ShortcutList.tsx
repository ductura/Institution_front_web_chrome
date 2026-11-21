"use client";

import { useEffect } from "react";

import { Button } from "../Button";
import { Dialog } from "../Dialog";
import styles from "./ShortcutList.module.css";
import { opensShortcutList, spokenKeys, visibleGroups, type ShortcutListGroup } from "./shortcut-list-model";

export type ShortcutListProps = {
  groups: readonly ShortcutListGroup[];
  /** Level of the group headings; the host sets it under its own heading. Default 3. */
  headingLevel?: 2 | 3 | 4;
};

/**
 * The shortcut list (WEB-1908, WCAG 2.2 AA): groups with headings, one row per shortcut.
 * The visible key text is hidden from assistive technology and replaced by a spoken form,
 * so "Ctrl+Z" is read as "Control plus Z" instead of letter by letter.
 */
export function ShortcutList({ groups, headingLevel = 3 }: ShortcutListProps) {
  const shown = visibleGroups(groups);
  const Heading = `h${headingLevel}` as "h3";
  if (shown.length === 0) return <p className={styles.empty}>Nema prečaca za ovaj prikaz.</p>;
  return (
    <div>
      {shown.map((group) => (
        <section key={group.id} className={styles.group} aria-labelledby={`shortcut-group-${group.id}`}>
          <Heading id={`shortcut-group-${group.id}`} className={styles.title}>{group.title}</Heading>
          <ul className={styles.list}>
            {group.items.map((item) => (
              <li key={item.id} className={styles.row}>
                <span>{item.label}</span>
                <span>
                  <kbd className={styles.kbd} aria-hidden="true">{item.keys}</kbd>
                  <span className={styles.hidden}>{spokenKeys(item.keys)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export type ShortcutListDialogProps = ShortcutListProps & { open: boolean; onClose: () => void };

/** The list on the shared Dialog: Esc or "Zatvori" close it and the focus returns to what opened it. */
export function ShortcutListDialog({ open, onClose, groups, headingLevel }: ShortcutListDialogProps) {
  return (
    <Dialog open={open} title="Prečaci" onClose={onClose}
      actions={<Button tone="quiet" onClick={onClose}>Zatvori</Button>}>
      <p className={styles.note}>Na Macu umjesto Ctrl vrijedi Cmd.</p>
      <div className={styles.scroll} tabIndex={0} role="region" aria-label="Popis prečaca">
        <ShortcutList groups={groups} headingLevel={headingLevel} />
      </div>
    </Dialog>
  );
}

/** Toggles on "?" or Ctrl/Cmd+/; a hook so the host decides where to listen. */
export function useShortcutListKey(toggle: () => void): void {
  useEffect(() => {
    const on = (event: KeyboardEvent) => {
      if (!opensShortcutList(event)) return;
      event.preventDefault();
      toggle();
    };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [toggle]);
}
