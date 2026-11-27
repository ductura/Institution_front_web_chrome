import type { Metadata } from "next";

import ErrorScreen from "../../../src/components/shell/ErrorScreen.ts";
import { messagesHr as t } from "../../../locales/hr.ts";
import { documentTitle } from "../src/host/states/document-title";

// WCAG 2.4.2: a title of its own, not the root layout's bare "Ductura".
export const metadata: Metadata = { title: documentTitle(t.errorPage.notFoundTitle, t.app.name) };

/** A path under /aplikacija/ that is not a page of the app. */
export default function NotFound() {
  return <ErrorScreen title={t.errorPage.notFoundTitle} body={t.errorPage.notFoundBody} />;
}
