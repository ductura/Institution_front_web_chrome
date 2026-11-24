"use client";

// Step 3, E-8 "Prije predaje" (WEB-25, WEB-2108, VIZ-S4): the checks panel on the left and the process
// summary (PD-1) on the right, as in the student prototype (`pregled`). The checks inform; only an
// unconfirmed declaration sends the student back to step 2 (C-3); pastes, gaps in the record and the form
// check never hold the submission (PRODUCT §5 rule 11). Whether the declaration is confirmed is read from the
// server (PIL-K-IZJAVA-VRATA), never from this browser; a failed read does not open the next step.
import { Button, StepActions, StepNav, StepPanel, StepSection } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { createApi } from "../../../../../../../src/client/api.ts";
import { createEventDisputes } from "../../../../../../../src/client/event-disputes.ts";
import { useOnline } from "../../../../../../../src/client/online-status.ts";
import { fetchProcessSummary } from "../../../../../../../src/client/process-summary.ts";
import { loadNotes, pastedText, saveNote, type NotesRead, type SummaryRead } from "../../../../../../../src/components/predaja/BeforeSubmit.tsx";
import { stepHref } from "../../../../../../../src/components/predaja/flow.ts";
import type { Stage } from "../../../../../../../src/components/predaja/stage.ts";
import { readWork } from "../../../../../../../src/components/student/Submission.tsx";

import StepLink from "../steps/StepLink";
import { stepsText } from "../steps/messages.hr";
import { atOf } from "../steps/time";
import { checksText as c } from "./messages.hr";
import SummaryPanel from "./SummaryPanel";
import { opensSending, serverGate, useDeclarationGate, type GateRead } from "./declaration-gate";
import { beforeSubmission, declarationText as declarationWords } from "./declaration-gate";
import { notesCall, readStepSummary, type ClientAnswer, type NotesClient, type SummaryPorts } from "./model";
import { routerPath } from "../../../../bases";

const PORTS: SummaryPorts = { readWork: (id) => readWork(id), readSummary: (documentId) => fetchProcessSummary(documentId) };

const client: NotesClient = {
  list: (assignmentId) => createApi()("student.submission-notes.get", { params: { assignmentId }, query: undefined, body: undefined }) as Promise<ClientAnswer>,
  add: (assignmentId, text) => createApi()("student.submission-notes.post", { params: undefined, query: undefined, body: { assignmentId, text } }) as Promise<ClientAnswer>,
};
// One transport for the page's life: the step reads the notes again whenever it changes.
const NOTES = notesCall(client);
// The supplements and disputes of the summary's events (WEB-1305): one read per work.
const DISPUTES = createEventDisputes(createApi());

export type BeforeSubmitStepProps = {
  readonly assignmentId: string;
  readonly stage: Stage;
  /** The kind of work ("Seminarski rad"), the tag beside both titles, when the server names it. */
  readonly kind?: string;
  /** Ignored (PIL-K-IZJAVA-VRATA): step 2's hand-off in the address no longer opens anything; the server decides. */
  readonly declaredFor?: string;
  readonly hrefOf: (path: string) => string;
  /** The work's page, where the summary's links to places in the text lead. */
  readonly workHref: string;
  readonly onSignIn: () => void;
  /** The declaration's gate; the server's by default, a recorded one in tests. */
  readonly declarationGate?: GateRead;
};

export default function BeforeSubmitStep({ assignmentId, stage, kind, hrefOf, workHref, onSignIn, declarationGate = serverGate }: BeforeSubmitStepProps) {
  const router = useRouter();
  const online = useOnline();
  const hint = useId();
  const [summary, setSummary] = useState<SummaryRead>({ kind: "loading" });
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [notes, setNotes] = useState<NotesRead>({ kind: "loading" });
  const [noteOpen, setNoteOpen] = useState(false);
  // The declaration as the server holds it for the current revision (PIL-K-IZJAVA-VRATA).
  const { gate, reload: readGate } = useDeclarationGate(assignmentId, declarationGate);
  const confirmed = opensSending(gate);
  // The latest sign-in callback, so a new one from the page does not read the summary again.
  const signIn = useRef(onSignIn);
  useEffect(() => { signIn.current = onSignIn; });
  useEffect(() => { if (gate.kind === "signedOut") signIn.current(); }, [gate.kind]);
  useEffect(() => {
    let live = true;
    setSummary({ kind: "loading" });
    void readStepSummary(assignmentId, PORTS).then((read) => {
      if (!live) return;
      if (read.kind === "signIn") signIn.current();
      else {
        setSummary(read);
        // The same document keeps the same marks: a repeated read of the summary does not read them again.
        if (read.kind === "ready") setDocumentId(read.documentId);
      }
    });
    return () => { live = false; };
  }, [assignmentId, attempt]);
  useEffect(() => {
    let live = true;
    void loadNotes(NOTES, assignmentId).then((read) => { if (live) setNotes(read); });
    return () => { live = false; };
  }, [assignmentId]);

  const retry = () => setAttempt((n) => n + 1);
  const submitted = stage.kind === "submitted";
  // WEB-NUZ-PREDAJA-1 (PR-2): the same words and the same "Što još fali" as the rehearsal in the editor.
  const declarationText = declarationWords(gate);
  const missing = beforeSubmission(gate, null);
  // G-8: the reason of a closed "Dalje" is the declaration row itself, said once; offline it is its own line.
  const nextHint = !online ? c.offline : confirmed ? undefined : declarationText;
  const declarationId = `${hint}-izjava`;
  const describedBy = !online ? hint : confirmed ? undefined : declarationId;
  const go = (step: "izjava" | "slanje" | "potvrda") => router.push(routerPath(hrefOf(stepHref(assignmentId, step))));
  const openNote = () => {
    if (!online || notes.kind !== "ready") return;
    setNoteOpen(true);
    requestAnimationFrame(() => document.getElementById("sb-notes")?.scrollIntoView({ block: "center" }));
  };

  return (
    <>
      <StepPanel title={c.title} tag={online ? kind : c.offlineTag} sticky>
        <StepNav current={3} />
        <p className="note">{stepsText.intro}</p>
        {stage.kind === "closed" && <p className="note" role="note">{`${c.closed}: ${atOf(stage.dueAt)}.`}</p>}
        {stage.kind === "unavailable" && <p className="note" role="alert">{c.unavailable}</p>}
        {!online && !submitted && <p className="note" role="status" id="sb-off">{c.offline}</p>}
        <StepSection label={c.missingTitle}>
          <span>{gate.kind === "loading" ? c.declarationChecking : missing.count === 0 ? c.missingNothing : missing.items.map((item) => item.text).join(" ")}</span>
          <span className="meta">{c.missingMeta}</span>
        </StepSection>
        <StepSection label={c.declaration}>
          <span id={declarationId}>{declarationText}</span>
          {gate.kind === "missing" && <StepLink href={hrefOf(stepHref(assignmentId, "izjava"))}>{c.openDeclaration}</StepLink>}
          {gate.kind === "unavailable" && <Button tone="secondary" onClick={readGate}>{c.declarationRetry}</Button>}
        </StepSection>
        <StepSection label={c.conversations}><span>{c.conversationsUnavailable}</span></StepSection>
        <StepSection label={c.placeholders}><span>{c.placeholdersInfo}</span></StepSection>
        <StepSection label={c.pasted}><span>{pastedText(summary)}</span></StepSection>
        <StepSection label={c.form}><span>{c.formNotRun}</span></StepSection>
        <StepLink href="#sb-notes" onClick={openNote}>{c.addNote}</StepLink>
        <StepActions>
          {confirmed
            ? <Button aria-disabled={!online || undefined} aria-describedby={describedBy} onClick={() => { if (online) go("slanje"); }}>{c.next}</Button>
            : <Button aria-describedby={describedBy} onClick={() => go("izjava")}>{c.toDeclaration}</Button>}
          <Button tone="secondary" onClick={() => go("izjava")}>{c.back}</Button>
        </StepActions>
        {!online && nextHint && <p className="meta" id={hint}>{nextHint}</p>}
      </StepPanel>
      <SummaryPanel summary={summary} notes={notes} submitted={submitted} confirmed={confirmed} kind={kind}
        online={online} workHref={workHref} onRetry={retry}
        disputes={documentId === null ? undefined : { port: DISPUTES, documentId }} noteOpen={noteOpen} onNoteOpen={setNoteOpen}
        onAddNote={(text) => saveNote(NOTES, assignmentId, text)}
        onNoteAdded={(note) => setNotes((now) => now.kind === "ready" ? { kind: "ready", notes: [...now.notes, note] } : now)} />
    </>
  );
}
