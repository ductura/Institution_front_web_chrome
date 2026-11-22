"use client";

import { useEffect, useRef, useState } from "react";

import { createApi } from "../../../../../../../src/client/api.ts";
import { fetchProcessSummary } from "../../../../../../../src/client/process-summary.ts";
import BeforeSubmit, { loadNotes, saveNote, type NotesRead, type SummaryRead } from "../../../../../../../src/components/predaja/BeforeSubmit.tsx";
import type { Stage } from "../../../../../../../src/components/predaja/stage.ts";
import { readWork } from "../../../../../../../src/components/student/Submission.tsx";

import SummaryPanel from "./SummaryPanel";
import { notesCall, readStepSummary, type ClientAnswer, type NotesClient, type SummaryPorts } from "./model";

const PORTS: SummaryPorts = { readWork: (id) => readWork(id), readSummary: (documentId) => fetchProcessSummary(documentId) };

const client: NotesClient = {
  list: (assignmentId) => createApi()("student.submission-notes.get", { params: { assignmentId }, query: undefined, body: undefined }) as Promise<ClientAnswer>,
  add: (assignmentId, text) => createApi()("student.submission-notes.post", { params: undefined, query: undefined, body: { assignmentId, text } }) as Promise<ClientAnswer>,
};
// One transport for the page's life: BeforeSubmit reads the notes again whenever it changes.
const NOTES = notesCall(client);

export type BeforeSubmitStepProps = {
  readonly assignmentId: string;
  readonly stage: Stage;
  readonly declaredFor?: string;
  readonly hrefOf: (path: string) => string;
  /** The work's page, where the summary's links to places in the text lead. */
  readonly workHref: string;
  readonly onSignIn: () => void;
};

/**
 * Step 3 with the summary and the notes from the server (WEB-2108): the
 * summary panel holds all eleven PD-1 sections and the notes with the inline
 * PD-4 form; "Pokušaj ponovno" reads the summary again.
 */
export default function BeforeSubmitStep({ assignmentId, stage, declaredFor, hrefOf, workHref, onSignIn }: BeforeSubmitStepProps) {
  const [summary, setSummary] = useState<SummaryRead>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [notes, setNotes] = useState<NotesRead>({ kind: "loading" });
  // The latest sign-in callback, so a new one from the page does not read the summary again.
  const signIn = useRef(onSignIn);
  useEffect(() => { signIn.current = onSignIn; });
  useEffect(() => {
    let live = true;
    setSummary({ kind: "loading" });
    void readStepSummary(assignmentId, PORTS).then((read) => {
      if (!live) return;
      if (read.kind === "signIn") signIn.current();
      else setSummary(read);
    });
    return () => { live = false; };
  }, [assignmentId, attempt]);
  useEffect(() => {
    let live = true;
    void loadNotes(NOTES, assignmentId).then((read) => { if (live) setNotes(read); });
    return () => { live = false; };
  }, [assignmentId]);
  return (
    <BeforeSubmit assignmentId={assignmentId} summary={summary} stage={stage} declaredFor={declaredFor}
      hrefOf={hrefOf} onRetry={() => setAttempt((n) => n + 1)}
      aside={({ confirmed, online }) => (
        <SummaryPanel summary={summary} notes={notes} submitted={stage.kind === "submitted"} confirmed={confirmed}
          online={online} workHref={workHref} onRetry={() => setAttempt((n) => n + 1)}
          onAddNote={(text) => saveNote(NOTES, assignmentId, text)}
          onNoteAdded={(note) => setNotes((now) => now.kind === "ready" ? { kind: "ready", notes: [...now.notes, note] } : now)} />
      )} />
  );
}
