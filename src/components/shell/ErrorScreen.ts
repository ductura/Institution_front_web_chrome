import { ErrorScreen as UiErrorScreen, type ErrorScreenProps as UiErrorScreenProps } from "@ductura/ui";
import { createElement as h } from "react";

import { messagesHr as t } from "../../../locales/hr.ts";

export type ErrorScreenProps = Omit<UiErrorScreenProps, "retryLabel" | "homeLabel" | "homeHref">;

/** WEB-06: the error and not-found body of @ductura/ui with the web's own words. */
export default function ErrorScreen(props: ErrorScreenProps) {
  return h(UiErrorScreen, { ...props, retryLabel: t.auth.retry, homeLabel: t.auth.home });
}
