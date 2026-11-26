"use client";

// Step 3, E-8 "Prije predaje" (WEB-25, WEB-2108, VIZ-S4): the checks panel on the left and the process
// summary (PD-1) on the right, as in the student prototype (`pregled`). The checks inform; only an
// unconfirmed declaration sends the student back to step 2 (C-3); pastes, gaps in the record and the form
// check never hold the submission (PRODUCT §5 rule 11). Whether the declaration is confirmed is read from the
// server (PIL-K-IZJAVA-VRATA), never from this browser; a failed read does not open the next step.
import { Button, OptionGroup, StepActions, StepNav, StepPanel, StepPlaces, StepSection } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { createApi } from "../../../../../../../src/client/api.ts";
import { createEventDisputes } from "../../../../../../../src/client/event-disputes.ts";
import { useOnline } from "../../../../../../../src/client/online-status.ts";
import { fetchProcessSummary } from "../../../../../../../src/client/process-summary.ts";
import { loadNotes, saveNote, type NotesRead, type SummaryRead } from "../../../../../../../src/components/predaja/BeforeSubmit.tsx";
import { stepHref } from "../../../../../../../src/components/predaja/flow.ts";
import type { Stage } from "../../../../../../../src/components/predaja/stage.ts";
import { readWork } from "../../../../../../../src/components/student/Submission.tsx";

import FormatCheck from "../../../editor/format-check/FormatCheck";
import SheetSummary from "../sheet/SheetSummary";
import StepLink from "../steps/StepLink";
import { stepsText } from "../steps/messages.hr";
import { checksText as c } from "./messages.hr";
import SummaryPanel from "./SummaryPanel";
import { opensSending, serverGate, useDeclarationGate, type GateRead } from "./declaration-gate";
import { beforeSubmission, declarationText as declarationWords } from "./declaration-gate";
import { readStepChecks, type SummaryPorts } from "./model";
import { NOTES } from "./notes-port";
import { pastesOf, type Place } from "./places";
import { pasteWhen } from "./panel-model";
import { lateLine, timingTag, type Timing } from "../submit/timing";
import { routerPath } from "../../../../bases";
import DeclarationDialog from "../declaration/DeclarationDialog";
import { useFocusAfterDialog, useOpener } from "../declaration/dialog-model";
import { deviceHasNewer } from "../submit/local-hold";
import { rememberChoice } from "../submit/newer-choice";
import type { Confirmed, NewerChoice } from "../submit/newer-local";
import { submitText } from "../submit/messages.hr";

const PORTS: SummaryPorts = { readWork: (id) => readWork(id), readSummary: (documentId) => fetchProcessSummary(documentId) };

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
  /** Where the deadline stands, with the teacher's exception (NF-3 PR-17); from `stage` when not given. */
  readonly timing?: Timing;
  /** NF-3 PR-10 (INT-16): whether this device holds text the server has not confirmed; the journal by default. */
  readonly hasNewer?: (documentId: string) => Promise<boolean>;
};

export default function BeforeSubmitStep({
  assignmentId, stage, kind, hrefOf, workHref, onSignIn, declarationGate = serverGate, timing: given, hasNewer = deviceHasNewer,
}: BeforeSubmitStepProps) {
  const router = useRouter();
  const online = useOnline();
  const hint = useId();
  const [summary, setSummary] = useState<SummaryRead>({ kind: "loading" });
  const [documentId, setDocumentId] = useState<string | null>(null);
  // NF-3 PR-3: the places left for a source in the server's text; null while unread or unreadable.
  const [places, setPlaces] = useState<readonly Place[] | null | "loading">("loading");
  const [attempt, setAttempt] = useState(0);
  const [notes, setNotes] = useState<NotesRead>({ kind: "loading" });
  const [noteOpen, setNoteOpen] = useState(false);
  // NF-3 PR-5 (PD-10): the declaration as a dialog, without leaving this step.
  const [declaring, setDeclaring] = useState(false);
  const nextButton = useRef<HTMLButtonElement>(null);
  // NF-3 PR-10 (E-8c): the revision the server confirmed, a newer one on this device, and the student's choice.
  const [confirmedWork, setConfirmedWork] = useState<Confirmed | null>(null);
  const [newer, setNewer] = useState(false);
  const [version, setVersion] = useState<NewerChoice | null>(null);
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
    setPlaces("loading");
    void readStepChecks(assignmentId, PORTS).then(({ summary: read, places: found, confirmed: work }) => {
      if (!live) return;
      setPlaces(found);
      setConfirmedWork(work ?? null);
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

  // Looked at once the confirmed revision is known, and again when the connection comes back.
  useEffect(() => {
    if (confirmedWork === null) return undefined;
    let live = true;
    const look = () => { void hasNewer(confirmedWork.documentId).then((found) => found === true, () => false).then((found) => { if (live) setNewer(found); }); };
    look();
    window.addEventListener("online", look);
    return () => { live = false; window.removeEventListener("online", look); };
  }, [confirmedWork, hasNewer]);

  const retry = () => setAttempt((n) => n + 1);
  const submitted = stage.kind === "submitted";
  // WEB-NUZ-PREDAJA-1 (PR-2): the same words and the same "Što još fali" as the rehearsal in the editor.
  const declarationText = declarationWords(gate);
  const missing = beforeSubmission(gate, null);
  // G-8, PR-3: "Dalje" is always there; closed, it names its one reason (offline, or the declaration).
  const choosing = newer && confirmedWork !== null;
  const nextHint = !confirmed ? (gate.kind === "missing" ? c.nextWhy : declarationText) : choosing && version === null ? c.newerWhy : undefined;
  const declarationId = `${hint}-izjava`;
  const nextClosed = !online || nextHint !== undefined;
  const describedBy = !online ? "sb-off" : nextHint === undefined ? undefined : hint;
  const timing: Timing = given ?? (stage.kind === "closed" ? { kind: "late", dueAt: stage.dueAt } : stage);
  const late = lateLine(timing);
  const pastes = summary.kind === "ready" ? pastesOf(summary.summary) : null;
  const go = (step: "izjava" | "slanje" | "potvrda") => router.push(routerPath(hrefOf(stepHref(assignmentId, step))));
  const onward = () => {
    if (nextClosed) return;
    if (choosing && version !== null) rememberChoice(assignmentId, confirmedWork, version);
    go("slanje");
  };
  const declareLabel = useOpener(gate);
  useFocusAfterDialog(declaring, declareLabel, nextButton);
  const openNote = () => {
    if (!online || notes.kind !== "ready") return;
    setNoteOpen(true);
    requestAnimationFrame(() => document.getElementById("sb-notes")?.scrollIntoView({ block: "center" }));
  };

  return (
    <>
      <StepPanel title={c.title} tag={online ? timingTag(timing) ?? kind : c.offlineTag} sticky>
        <StepNav current={3} />
        <p className="note">{stepsText.intro}</p>
        {late !== null && <p className="note" id="sb-late">{late}</p>}
        {stage.kind === "unavailable" && <p className="note" role="alert">{c.unavailable}</p>}
        {!online && <p className="note" role="status" id="sb-off">{c.offline}</p>}
        <StepSection label={c.missingTitle}>
          <span>{gate.kind === "loading" ? c.declarationChecking : missing.count === 0 ? c.missingNothing : missing.items.map((item) => item.text).join(" ")}</span>
          <span className="meta">{c.missingMeta}</span>
        </StepSection>
        <StepSection label={c.declaration}>
          <span id={declarationId}>{declarationText}</span>
          {declareLabel !== null && <Button tone="secondary" size="small" onClick={() => setDeclaring(true)}>{declareLabel}</Button>}
          {gate.kind === "unavailable" && <Button tone="secondary" onClick={readGate}>{c.declarationRetry}</Button>}
        </StepSection>
        {choosing && (
          <StepSection label={submitText.newer.title}>
            <span>{submitText.newer.text}</span>
            <OptionGroup legend={c.newerLegend} name="sb-ver" value={version ?? ""}
              onChange={(value) => setVersion(value as NewerChoice)}
              options={[
                { value: "latest", label: submitText.newer.latest },
                { value: "confirmed", label: submitText.newer.confirmed.replace("{n}", String(confirmedWork.revision)) },
              ]} />
            <span className="meta">{c.newerMeta}</span>
          </StepSection>
        )}
        <StepSection label={c.conversations}><span>{c.conversationsUnavailable}</span></StepSection>
        <StepSection label={c.placeholders}>
          {places === "loading" ? <span>{c.placesLoading}</span>
            : places === null ? <span>{c.placeholdersUnknown}</span>
            : places.length === 0 ? <span>{c.placeholdersNone}</span>
            : <>
              <StepPlaces>{places.map((place, i) => <li key={`${place.where}-${i}`}><a href={workHref}>{`${place.where} (${place.mark})`}</a></li>)}</StepPlaces>
              <span className="meta">{c.placeMeta}</span>
            </>}
        </StepSection>
        <StepSection label={c.pasted}>
          {summary.kind === "loading" ? <span>{c.pastedLoading}</span>
            : pastes === null ? <span>{c.pastedUnknown}</span>
            : <>
              {pastes.listed.length === 0 ? <span>{c.pastedNone}</span>
                : <StepPlaces>{pastes.listed.map((paste, i) => <li key={`${paste.at.from}-${i}`}><a href={workHref}>{pasteWhen(paste.at)}</a></li>)}</StepPlaces>}
              <span className="meta">{c.pastedMeta.replace("{n}", String(pastes.threshold)).replace("{smaller}", String(pastes.smaller))}</span>
            </>}
        </StepSection>
        <FormatCheck assignmentId={assignmentId} readWork={PORTS.readWork} />
        {/* WEB-V14-SHEET-SUBMIT: a spreadsheet work shows its kind and counts; any other work shows nothing here. */}
        <SheetSummary assignmentId={assignmentId} onSignIn={() => signIn.current()} />
        <StepLink href="#sb-notes" onClick={openNote}>{c.addNote}</StepLink>
        {online && nextHint !== undefined && <p className="meta" id={hint}>{nextHint}</p>}
        <StepActions>
          <Button ref={nextButton} aria-disabled={nextClosed || undefined} aria-describedby={describedBy}
            onClick={onward}>{c.next}</Button>
          <Button tone="secondary" onClick={() => go("izjava")}>{c.back}</Button>
        </StepActions>
      </StepPanel>
      <DeclarationDialog assignmentId={assignmentId} open={declaring} declarationGate={declarationGate} onSignIn={() => signIn.current()}
        onClose={() => { setDeclaring(false); readGate(); }} />
      <SummaryPanel summary={summary} notes={notes} submitted={submitted} confirmed={confirmed} kind={kind}
        online={online} workHref={workHref} onRetry={retry}
        assignmentId={assignmentId} declarationKey={gate} disputes={documentId === null ? undefined : { port: DISPUTES, documentId }} noteOpen={noteOpen} onNoteOpen={setNoteOpen}
        onAddNote={(text) => saveNote(NOTES, assignmentId, text)}
        onNoteAdded={(note) => setNotes((now) => now.kind === "ready" ? { kind: "ready", notes: [...now.notes, note] } : now)} />
    </>
  );
}
