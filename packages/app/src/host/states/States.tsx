// WEB-DIZ-S-ZAJEDNICKO (Ductus#2059 c.7214951129, dio A): the shared states the student screens
// (WEB-DIZ-S02-S05, S06-S42, S08) take over. Only the foundation: no page uses them yet.
// Every text comes from the caller's catalogue, so the states carry no wording of their own.
import { createElement as h, type ReactNode } from "react";

import styles from "./States.module.css";

/** "Pokušaj ponovno": a link to the same address, or a callback that reads again. */
export type Retry =
  | { readonly label: string; readonly href: string }
  | { readonly label: string; readonly onRetry: () => void };

export type LoadAlertProps = {
  /** The first line in the frame (e.g. "Prikaz trenutačno nije dostupan."); absent when the body says it all. */
  readonly title?: string;
  readonly body: ReactNode;
  /** The link under the frame; absent when the screen has its own button (e.g. "Učitaj ponovno"). */
  readonly retry?: Retry;
};

/**
 * A2: "nije dostupno / nije moguće učitati". One role=alert frame, 1 px edge and text in the error
 * colour, radius 4, padding 10/12, no fill; "Pokušaj ponovno" is an underlined link under it.
 * Never for 401 (sign-in), 403 or 404: those are not read errors (A3).
 */
export function LoadAlert({ title, body, retry }: LoadAlertProps) {
  const frame = h(
    "div",
    { role: "alert", className: styles.alert },
    title === undefined ? null : h("p", { className: styles.title }, title),
    h("p", null, body),
  );
  if (retry === undefined) return frame;
  const link = "href" in retry
    ? h("a", { className: styles.link, href: retry.href }, retry.label)
    : h("button", { type: "button", className: styles.link, onClick: retry.onRetry }, retry.label);
  return h("div", null, frame, h("p", { className: styles.retry }, link));
}

export type DeniedStateProps = {
  /** shell.deniedTitle: "Nemate pristup ovom prikazu". */
  readonly title: string;
  /** shell.backToOwn: "Natrag na moj prostor". */
  readonly backLabel: string;
  /** The role's own space. */
  readonly backHref: string;
};

/** A3, 403: the heading and the way back to one's own space, with no further text. */
export function DeniedState({ title, backLabel, backHref }: DeniedStateProps) {
  return h("section", { className: styles.state }, h("h1", null, title), h("p", null, h("a", { href: backHref }, backLabel)));
}

export type NotFoundStateProps = {
  /** errorPage.notFoundTitle: "Stranica ne postoji". */
  readonly title: string;
  /** The way back, the same as on 403; absent shows the heading only. */
  readonly back?: { readonly label: string; readonly href: string };
};

/** A3, 404: "Stranica ne postoji", not a read error. */
export function NotFoundState({ title, back }: NotFoundStateProps) {
  return h(
    "section",
    { className: styles.state },
    h("h1", null, title),
    back === undefined ? null : h("p", null, h("a", { href: back.href }, back.label)),
  );
}
