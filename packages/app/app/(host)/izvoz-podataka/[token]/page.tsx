import type { Metadata } from "next";

import { messagesHr as t } from "../../../../../../locales/hr.ts";
import StudentDataDownloadPage from "../../../../src/host/public/student-data-download/StudentDataDownloadPage";
import { studentDataDownloadMessages } from "../../../../src/host/public/student-data-download/messages.hr";
import { documentTitle } from "../../../../src/host/states/document-title";

// WCAG 2.4.2: the title the server sends, so the root layout's bare "Ductura" never replaces the host's.
export const metadata: Metadata = { title: documentTitle(studentDataDownloadMessages.labels.title, t.app.name) };

// WEB-1302: the student's one-time download; public, the token in the link is the only key.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <StudentDataDownloadPage key={token} token={token} />;
}
