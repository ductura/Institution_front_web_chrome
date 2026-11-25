import type { Metadata } from "next";

import { messagesHr as t } from "../../../../../../locales/hr.ts";
import { pageLabelsHr } from "../../../../src/i18n/messages.hr";
import StudomatEntryRoute from "../../../../src/host/public/studomat-entry/StudomatEntryRoute";

// WCAG 2.4.2: the title the server sends, so the root layout's bare "Ductura" never replaces the host's.
export const metadata: Metadata = { title: `${pageLabelsHr.studomatEntry} · ${t.app.name}` };

/** WEB-V22-RUTE: the public entry from Studomat; it takes nothing from Studomat. */
export default function Page() {
  return <StudomatEntryRoute />;
}
