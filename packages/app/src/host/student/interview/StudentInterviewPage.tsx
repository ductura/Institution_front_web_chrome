"use client";

// PIL-K-RAZGOVOR: /rad/<assignmentId>/razgovor, the student's side of the teacher's interview preparation.
// The work's document is found as on the other student pages (useWorkDocument): a submitted work names it in
// the signed receipt; a work in progress reads as unavailable. The reads go through studentInterviewPort.
import { notFound } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";

import { appHref } from "../../../../../../src/components/index.ts";
import { assignmentIdOf } from "../../../../../../src/components/editor/EditorPage.read.ts";
import { goToSignIn } from "../../../../../../src/client/api.ts";
import { messagesHr as t } from "../../../../../../src/lib/i18n/messages.hr.ts";

import { hostText } from "../../../text";
import { useHost } from "../../context";
import { useWorkDocument } from "../other";
import { interviewMessages as text } from "./messages.hr";
import { studentInterviewPort, type InterviewPort } from "./port";
import StudentInterview from "./StudentInterview";

export default function StudentInterviewPage({ assignmentId: raw, port = studentInterviewPort }: { assignmentId: string; port?: InterviewPort }) {
  const { base } = useHost();
  const work = useWorkDocument(raw, "razgovor");
  const [missing, setMissing] = useState(false);
  const id = assignmentIdOf(raw);
  const here = id === null ? "" : appHref(base, `/rad/${encodeURIComponent(id)}/razgovor`);
  const signedOut = useCallback(() => goToSignIn(here), [here]);
  const gone = useCallback(() => setMissing(true), []);

  if (work?.kind === "notFound" || missing) notFound();
  const back = id === null ? null : <p><a href={appHref(base, `/rad/${encodeURIComponent(id)}`)}>{t.replay.backToWork}</a></p>;

  let body: ReactNode;
  if (work === null) body = <p role="status">{hostText.loading}</p>;
  else if (work.kind === "invalid") body = <p role="status">{t.replay.invalid}</p>;
  else if (work.kind === "notStarted") body = <p role="status">{text.notStarted}</p>;
  // A work in progress (or one whose receipt could not be read): not an error of the student's.
  else if (work.kind !== "document") body = <p role="status">{text.notSubmitted}</p>;
  else body = <StudentInterview port={port} documentId={work.documentId} onSignedOut={signedOut} onNotFound={gone} />;
  return <div className="page"><h1>{text.pageTitle}</h1>{back}{body}</div>;
}
