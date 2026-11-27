// Design alignment 27. 11. 2026. (A2): the one look of "nije dostupno / nije moguće
// učitati" on a page, list or card, the same as the host's states/States.tsx. Every
// text comes from the caller's catalogue, so the alert carries no wording of its own.
// Errors in dialogs, panels and fields stay plain red text and do not use it.
import { createElement as h, type ReactNode } from "react";

import { messagesHr as t } from "../../../locales/hr.ts";

import styles from "./LoadAlert.module.css";

/** "Pokušaj ponovno": a link to the same address, or a callback that reads again. */
export type Retry =
  | { readonly label: string; readonly href: string }
  | { readonly label: string; readonly onRetry: () => void };

export type LoadAlertProps = {
  /** Optional only in the type, so createElement can pass the text as its third argument. */
  readonly children?: ReactNode;
  /** The link under the frame; absent when a button under it already does the same. */
  readonly retry?: Retry;
  readonly className?: string;
};

/**
 * One role=alert frame: 1 px edge and ui text in the error colour, radius 4,
 * padding 10/12, no error-soft fill. "Pokušaj ponovno" is an underlined accent
 * link under the frame, never inside it. Never for 401 (sign-in), 403 or 404.
 */
export default function LoadAlert({ children, retry, className }: LoadAlertProps) {
  const frame = h("p", { role: "alert", className: styles.alert }, children);
  if (retry === undefined) {
    return className === undefined ? frame : h("div", { className }, frame);
  }
  const link = "href" in retry
    ? h("a", { className: styles.link, href: retry.href }, retry.label)
    : h("button", { type: "button", className: styles.link, onClick: retry.onRetry }, retry.label);
  return h("div", { className }, frame, h("p", { className: styles.retry }, link));
}

/**
 * A page read answered 403: access.deniedTitle "Nemate pristup ovom prikazu" and
 * access.backToOwn "Natrag na moj prostor", with no text under the heading.
 * Not a read error, so no error colour.
 */
export function DeniedState({ backHref = "/" }: { readonly backHref?: string }) {
  return h("section", { className: styles.state, "aria-labelledby": "nema-pristupa" },
    h("h1", { id: "nema-pristupa" }, t.access.deniedTitle),
    h("p", null, h("a", { href: backHref }, t.access.backToOwn)));
}

/** A page read answered 404: errorPage.notFoundTitle "Stranica ne postoji", not a read error. */
export function NotFoundState({ backHref = "/" }: { readonly backHref?: string }) {
  return h("section", { className: styles.state, "aria-labelledby": "nema-stranice" },
    h("h1", { id: "nema-stranice" }, t.errorPage.notFoundTitle),
    h("p", null, h("a", { href: backHref }, t.access.backToOwn)));
}
