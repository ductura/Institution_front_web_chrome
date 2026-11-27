import type { Metadata } from "next";

import { messagesHr as t } from "../../../../../locales/hr.ts";
import AboutPage from "../../../src/host/public/about/AboutPage";
import { documentTitle } from "../../../src/host/states/document-title";

// WCAG 2.4.2: the title the server sends, so the root layout's bare "Ductura" never replaces the host's.
export const metadata: Metadata = { title: documentTitle(t.landing.demo.pageTitle, t.app.name) };

/** DEMO-1: the public page about the app, with the way to the demo. */
export default function Page() {
  return <AboutPage />;
}
