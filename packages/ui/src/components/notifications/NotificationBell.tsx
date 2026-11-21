"use client";

import { useEffect, useRef, useState } from "react";

import { Popover } from "../popover";
import { announcement, badgeText } from "./notification-logic";
import styles from "./NotificationBell.module.css";

export type NotificationEntry = {
  id: string;
  /** The line of text, already in the interface language. */
  text: string;
  /** When it came, already formatted. */
  when: string;
  read: boolean;
  /** Where it leads (the work); a plain link, so it works without script too. */
  href: string;
};

export type NotificationBellLabels = {
  /** Name of the button; the count is added by `buttonWithCount`. */
  button: string;
  buttonWithCount: (unread: number) => string;
  panel: string;
  empty: string;
  unavailable: string;
  unreadMark: string;
  /** Read out when the count changes without a reload. */
  changed: (unread: number) => string;
};

export type NotificationBellProps = {
  entries: readonly NotificationEntry[];
  unread: number;
  status: "ready" | "unavailable";
  labels: NotificationBellLabels;
  /** A click on an entry: the host marks it read and leads to the work. */
  onOpenEntry: (entry: NotificationEntry) => void;
  /** Whether the list starts open (the catalogue and tests). */
  defaultOpen?: boolean;
};

/**
 * The bell of the shell (WEB-1702): a button with the count of unread
 * notifications and a list that opens under it. The count is in the button's
 * name and a polite live region says when it changes, so a screen reader
 * learns of a new notification without a reload; an unread entry carries a
 * word, not only a colour. The live region has no status role: the bell sits
 * in the shell of every page, and the page's own status stays the only one.
 */
export function NotificationBell({ entries, unread, status, labels, onOpenEntry, defaultOpen = false }: NotificationBellProps) {
  const [open, setOpen] = useState(defaultOpen);
  const anchor = useRef<HTMLButtonElement>(null);
  const previous = useRef<number | null>(null);
  const [said, setSaid] = useState("");

  useEffect(() => {
    if (status === "ready") {
      setSaid(announcement(previous.current, unread, labels.changed));
      previous.current = unread;
    }
  }, [unread, status, labels]);

  const badge = badgeText(unread);
  return (
    <span className={styles.root}>
      <button ref={anchor} type="button" className={styles.button} aria-haspopup="dialog" aria-expanded={open}
        aria-label={unread > 0 ? labels.buttonWithCount(unread) : labels.button} onClick={() => setOpen((o) => !o)}>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 11.5h9l-1.2-1.6V6.5a3.3 3.3 0 0 0-6.6 0v3.4zM6.5 13.5a1.5 1.5 0 0 0 3 0" />
        </svg>
        {badge !== "" && <span className={styles.badge} aria-hidden="true">{badge}</span>}
      </button>
      <span aria-live="polite" aria-atomic="true" className={styles.live}>{said}</span>
      <Popover open={open} anchor={anchor} label={labels.panel} onClose={() => setOpen(false)}>
        {status === "unavailable" ? (
          <p className={styles.note}>{labels.unavailable}</p>
        ) : entries.length === 0 ? (
          <p className={styles.note}>{labels.empty}</p>
        ) : (
          <ul className={styles.list}>
            {entries.map((entry) => (
              <li key={entry.id}>
                <a className={styles.entry} data-read={entry.read} href={entry.href}
                  onClick={() => { setOpen(false); onOpenEntry(entry); }}>
                  <span className={styles.text}>{entry.text}</span>
                  <span className={styles.meta}>
                    {!entry.read && <strong className={styles.unread}>{labels.unreadMark}</strong>}
                    <time>{entry.when}</time>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Popover>
    </span>
  );
}
