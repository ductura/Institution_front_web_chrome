"use client";

// NF-3 PR-11 (E-11d, R-40, PD-8): step 5 of a work with a signed receipt. Besides the receipt it reads
// what the receipt stands for, "Što je predano", and the process summary of the submitted work, so
// "Otvori sažetak procesa" shows PD-1 rather than "unavailable". Every read is the server's; a read
// that fails says so on its own line and never changes the receipt (B-6).
import { useEffect, useRef, useState } from "react";

import { createApi } from "../../../../../../../src/client/api.ts";
import { createEventDisputes } from "../../../../../../../src/client/event-disputes.ts";
import { useOnline } from "../../../../../../../src/client/online-status.ts";
import { fetchProcessSummary } from "../../../../../../../src/client/process-summary.ts";
import { loadNotes, type NotesRead } from "../../../../../../../src/components/predaja/BeforeSubmit.tsx";
import { readWork } from "../../../../../../../src/components/student/Submission.tsx";

import { notesCall, readStepChecks, type ClientAnswer, type StepSummary, type StepWork } from "../summary/model";
import SummaryPanel from "../summary/SummaryPanel";
import { useDeclarationGate, opensSending, serverGate, type GateRead } from "../summary/declaration-gate";
import { wordCount } from "../submit/model";
import { givenLines } from "./given";
import ReceiptScreen, { type ReceiptScreenProps } from "./ReceiptScreen";
import SheetSummary from "../sheet/SheetSummary";

/** What the page reads for a submitted work; the server's routes by default, recorded ones in tests. */
export type SubmittedPorts = {
  readonly readWork: typeof readWork;
  readonly readSummary: typeof fetchProcessSummary;
  readonly listNotes: (assignmentId: string) => Promise<ClientAnswer>;
  readonly gate: GateRead;
};

const SERVER: SubmittedPorts = {
  readWork: (id) => readWork(id),
  readSummary: (documentId) => fetchProcessSummary(documentId),
  listNotes: (assignmentId) => createApi()("student.submission-notes.get", { params: { assignmentId }, query: undefined, body: undefined }) as Promise<ClientAnswer>,
  gate: serverGate,
};

const DISPUTES = createEventDisputes(createApi());

type Read = { readonly summary: StepSummary | { readonly kind: "loading" }; readonly words: number | null | "loading" };

export type SubmittedReceiptProps = Omit<ReceiptScreenProps, "summary" | "given"> & {
  readonly read: Extract<ReceiptScreenProps["read"], { kind: "potvrdeno" }>;
  readonly ports?: SubmittedPorts;
  readonly onSignIn: () => void;
};

export default function SubmittedReceipt({ ports = SERVER, onSignIn, ...screen }: SubmittedReceiptProps) {
  const { assignmentId, revision } = screen.read.receipt.payload;
  const online = useOnline();
  const { gate } = useDeclarationGate(assignmentId, ports.gate);
  const [notes, setNotes] = useState<NotesRead>({ kind: "loading" });
  const [work, setWork] = useState<Read>({ summary: { kind: "loading" }, words: "loading" });
  const [attempt, setAttempt] = useState(0);
  // The page gives a new onSignIn on every render; the read must not run again for it.
  const signIn = useRef(onSignIn);
  signIn.current = onSignIn;

  useEffect(() => {
    let live = true;
    setWork({ summary: { kind: "loading" }, words: "loading" });
    // One read of the work for both the words and the summary: evidence.open.post is not asked twice.
    const opened = ports.readWork(assignmentId).catch(() => ({ kind: "unavailable" as const }));
    const checks = readStepChecks(assignmentId, { readWork: () => opened as Promise<StepWork>, readSummary: ports.readSummary });
    void Promise.all([opened, checks]).then(([text, { summary }]) => {
      if (!live) return;
      if (summary.kind === "signIn") return signIn.current();
      // Words only of the text the receipt names: another revision is not what was submitted.
      const words = text.kind === "ready" && text.revision === revision ? wordCount(text.nodes) : null;
      setWork({ summary, words });
    });
    return () => { live = false; };
  }, [assignmentId, revision, ports, attempt]);

  useEffect(() => {
    let live = true;
    void loadNotes(notesCall({ list: ports.listNotes, add: async () => ({ ok: false, status: 0 }) }), assignmentId)
      .then((read) => { if (live) setNotes(read); });
    return () => { live = false; };
  }, [assignmentId, ports]);

  const given = givenLines({ revision, words: work.words, declaration: gate, notes });
  const summary = work.summary.kind === "signIn" ? { kind: "error" as const } : work.summary;
  const documentId = summary.kind === "ready" ? summary.documentId : null;
  return (
    <ReceiptScreen {...screen} given={given} summary={<>
      {/* WEB-V14-SHEET-SUBMIT: the kind and counts of a spreadsheet work; nothing for any other kind. */}
      <SheetSummary assignmentId={assignmentId} revision={revision} onSignIn={() => signIn.current()} />
      <SummaryPanel summary={summary} notes={notes} submitted confirmed={opensSending(gate)} kind={screen.kind}
        online={online} workHref={screen.workHref} onRetry={() => setAttempt((n) => n + 1)}
        assignmentId={assignmentId} disputes={documentId === null ? undefined : { port: DISPUTES, documentId }}
        onAddNote={async () => ({ kind: "nepoznato" })} onNoteAdded={() => undefined} />
    </>} />
  );
}
