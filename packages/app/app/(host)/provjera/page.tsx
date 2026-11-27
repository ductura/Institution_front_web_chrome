import type { Metadata } from "next";

import { messagesHr as t } from "../../../../../locales/hr.ts";
import { publicVerificationHr } from "../../../../../src/components/public-verification/messages.hr";
import VerifyPage from "../../../src/host/public/verify/VerifyPage";
import { documentTitle } from "../../../src/host/states/document-title";

// WCAG 2.4.2: the page's own title; no referrer leaves this page (as Ductus /provjera).
export const metadata: Metadata = { title: documentTitle(publicVerificationHr.title, t.app.name), referrer: "no-referrer" };

// WEB-2111 (R-41, V-5, C-6): the public check of a receipt, without signing in.
export default function Page() {
  return <VerifyPage />;
}
