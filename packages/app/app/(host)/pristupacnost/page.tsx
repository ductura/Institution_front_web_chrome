import type { Metadata } from "next";

import { messagesHr as t } from "../../../../../locales/hr.ts";

import AccessibilityStatement from "./AccessibilityStatement";
import { documentTitle } from "../../../src/host/states/document-title";

// WCAG 2.4.2: the title the server sends, so the root layout's bare "Ductura" never replaces the host's.
export const metadata: Metadata = { title: documentTitle(t.shell.accessibilityStatement, t.app.name) };

// WEB-1805 (M11.6, F-03): the accessibility statement. Public, as the law asks: it reads no session.
export default function Page() {
  return <AccessibilityStatement />;
}
