/**
 * ED-01b (NF2-P1, G-1 and G-2): why a work could not be opened, and the one
 * way out of each cause. The frame of `/rad/<id>` (no editor yet) and the sheet
 * of EditorPageWork (the editor's own open) say the same sentence for the same
 * cause, so a student never sees two different texts for one fault. Pure: the
 * pages render the sentence in `role="alert"` and the exit as their own button
 * or link. All text is in `messages.hr.ts`.
 */

import { signInHref } from "@/client/api";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { appHref } from "../shell/nav";

const t = messagesHr.workspace;

export type OpenFailure =
  /** No answer at all: the network is down. */
  | "offline"
  /** The sign-in has ended, or this sign-in carries no journal scope. */
  | "signedOut"
  /** No such work for this person. */
  | "missing"
  /** An answer this page cannot use: a server fault, a timeout, a refusal it cannot name. */
  | "server"
  /** The page is older than the server's protocol. */
  | "reload"
  /** The notice changed, or the assignment does not take work now. */
  | "closed";

export type OpenFailureExit =
  | { readonly kind: "retry"; readonly label: string }
  | { readonly kind: "reload"; readonly label: string }
  | { readonly kind: "link"; readonly label: string; readonly href: string };

/** The one sentence of a cause, the same in the frame and on the sheet. */
export function openFailureText(failure: OpenFailure): string {
  return t.openFailure[failure];
}

/** The one way out of a cause; links carry the host's base path. */
export function openFailureExit(failure: OpenFailure, at: { readonly assignmentId: string; readonly base?: string }): OpenFailureExit {
  const base = at.base ?? "";
  const id = encodeURIComponent(at.assignmentId);
  switch (failure) {
    case "offline":
    case "server":
      return { kind: "retry", label: t.openRetry };
    case "reload":
      return { kind: "reload", label: t.openReloadButton };
    case "signedOut":
      return { kind: "link", label: t.openSignIn, href: signInHref(appHref(base, `/rad/${id}`)) };
    case "missing":
      return { kind: "link", label: t.openBackToTasks, href: appHref(base, "/zadaci") };
    case "closed":
      return { kind: "link", label: t.openNoticeLink, href: appHref(base, `/zadatak/${id}`) };
  }
}
