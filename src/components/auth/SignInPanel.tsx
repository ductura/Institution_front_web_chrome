import { createElement as h, type MouseEvent } from "react";

import { messagesHr as t } from "../../../locales/hr.ts";

import styles from "./SignInPanel.module.css";

export type SignInState = "default" | "redirecting" | "failed" | "unavailable";

export type SignInPanelProps = {
  state: SignInState;
  /** Where AAI@EduHr sign-in starts. The caller builds it; the card passes it through unchanged. */
  href: string;
  /**
   * The polite announcement while the browser is being sent to AAI@EduHr.
   * locales/hr.ts has no such text yet (DAN-1081), so the caller supplies it.
   */
  redirectingText?: string;
  /** Called when the link is followed; the browser itself navigates. */
  onActivate?: () => void;
  /**
   * The h1 id. "prijava-kartica" keeps the page on the dark tokens
   * (globals.css); the catalogue passes its own ids, one per state.
   */
  headingId?: string;
};

export const SIGN_IN_HEADING_ID = "prijava-kartica";

/**
 * DAN-1081 (1081-W2): the sign-in card. AAI@EduHr is the only way in (D-09):
 * no field, no password, one link. Pure props: it reads no URL, cookie or
 * storage and never navigates by script. A failure keeps the same link for a
 * new attempt and never sends the reader back on its own.
 */
export default function SignInPanel({ state, href, redirectingText, onActivate, headingId = SIGN_IN_HEADING_ID }: SignInPanelProps) {
  const redirecting = state === "redirecting";
  const problem = state === "failed" ? t.auth.failedBody : state === "unavailable" ? t.auth.unavailableBody : null;
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    // While redirecting, a second click must not start a second sign-in.
    if (redirecting) {
      event.preventDefault();
      return;
    }
    onActivate?.();
  };

  return h(
    "section",
    { className: styles.card, "aria-labelledby": headingId, "data-state": state },
    h("p", { className: styles.eyebrow }, t.app.name, " · ", t.signIn.cardEyebrow),
    problem
      ? h("h1", { id: headingId, className: styles.title }, t.auth.failedTitle)
      : h(
          "h1",
          { id: headingId, className: styles.title },
          t.signIn.cardTitle,
          " ",
          h("br"),
          h("em", { className: styles.accent }, t.signIn.cardTitleAccent),
        ),
    problem
      ? h("p", { role: "alert", className: styles.body }, problem)
      : h("p", { className: styles.body }, t.signIn.cardBody),
    h(
      "a",
      {
        className: styles.button,
        href,
        onClick: follow,
        "aria-disabled": redirecting ? "true" : undefined,
        "aria-busy": redirecting ? "true" : undefined,
      },
      h("span", { className: styles.aai, "aria-hidden": "true" }, "aai"),
      " ",
      h("span", { className: styles.label }, t.signIn.button),
      " ",
      h("span", { "aria-hidden": "true" }, "→"),
    ),
    // Always in the page, so the text is announced when it arrives.
    h("p", { role: "status", className: styles.status }, redirecting ? (redirectingText ?? "") : ""),
    h("p", { className: styles.note }, t.signIn.passwordNote),
  );
}
