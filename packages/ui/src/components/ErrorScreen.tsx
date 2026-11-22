import { createElement as h } from "react";

import styles from "./ErrorScreen.module.css";

export type ErrorScreenProps = {
  title: string;
  body: string;
  /** "Pokušaj ponovno" for a render error; absent on a missing page. */
  onRetry?: () => void;
  /** The retry button's text (e.g. "Pokušaj ponovno"). */
  retryLabel: string;
  /** The link home: its text and address. */
  homeLabel: string;
  homeHref?: string;
};

/**
 * #732 item 3: the body of the error and not-found pages, under the plain
 * AppHeader. One h1 and no session or database read, so it still renders when
 * those fail. Written with createElement, like the other screens tested by
 * static render. Moved from the web's shell (WEB-06); the texts come from the
 * caller's catalogue (src/components/shell/ErrorScreen.ts in the web).
 */
export function ErrorScreen({ title, body, onRetry, retryLabel, homeLabel, homeHref = "/" }: ErrorScreenProps) {
  // VIZ-0: the prototype's error card (E-2 "greška"): a centred page column, a
  // card with the title, the note and the actions; the second action outlined.
  return h(
    "main",
    { id: "sadrzaj", tabIndex: -1, className: `page ${styles.screen}` },
    h(
      "div",
      { className: styles.card },
      h("h1", null, title),
      h("p", { role: onRetry ? "alert" : undefined, className: styles.body }, body),
      h(
        "p",
        { className: styles.actions },
        onRetry ? h("button", { type: "button", className: "btn", onClick: onRetry }, retryLabel) : null,
        h("a", { className: onRetry ? "btn secondary" : "btn", href: homeHref }, homeLabel),
      ),
    ),
  );
}
