"use client";

// WEB-V13-UREDNIK: the work page of a slides work, mounted by host/student/work.tsx
// (one branch on the kind). WEB-V13-DNEVNIK-SINKRONIZACIJA: the document now comes
// from the slides session (journal and evidence, sync/use-slides-session.ts): the
// journal's own document, saved on the device and sent to the server, with the
// status bar claiming only the state the session reached. A second tab, an
// unreadable kind, a missing sign-in and a sticky state each have their own card;
// none of them is shown as "no data". F4-V13-R03: under the editor, "Preuzmi .pptx" and "Preuzmi PDF" (the
// WEB-V13-IZVOZ buttons), on only while the session holds a verified receipt for the state shown.
import { useState, type ReactNode } from "react";
import { Button, Card } from "@ductura/ui";
import EditorPage from "../../../../../../src/components/editor/EditorPage.tsx";
import StatusBar, { type StatusSave } from "../../../../../../src/components/editor/StatusBar.tsx";
import { SlideEditor, type SlideEditorSource } from "./SlideEditor.tsx";
import { useSlidesSession, type SlidesSession } from "../sync/use-slides-session.ts";
import SlidesExport from "../export/SlidesExport.tsx";
import { slidesSyncText as sync } from "../sync/messages.hr.ts";

/** What the status bar is told: nothing while there is no state to claim, the block for a second tab. */
export function slidesStatusOf(session: SlidesSession): StatusSave | null {
  if (session.phase === "blocked") return { state: "LOCAL_DURABLE", receiptSigned: false, blocked: true };
  if (session.phase === "recovery") return { state: session.state === "CONFLICT" ? "CONFLICT" : "RECOVERY_REQUIRED", receiptSigned: false, blocked: false };
  if (session.phase !== "ready") return null;
  const { state, receiptVerified } = session.snapshot;
  return { state, receiptSigned: receiptVerified, blocked: false };
}

type Frame = {
  assignmentId: string;
  course: string | null;
  title: string | null;
  topBar: ReactNode;
  length: React.ComponentProps<typeof StatusBar>["length"];
  onRetry: () => void;
};

export function SlidesWork({ unreadable, ...frame }: Frame & { unreadable: boolean }) {
  // An unreadable kind opens no session: nothing is read or written for a work that is not known to be slides.
  if (unreadable) {
    return (
      <EditorPage course={frame.course} title={frame.title} topBar={frame.topBar} status={<StatusBar save={null} readOnly={false} length={frame.length} />}>
        <SlideEditor source={{ kind: "error", onRetry: frame.onRetry }} />
      </EditorPage>
    );
  }
  return <SessionWork {...frame} />;
}

function SessionWork({ assignmentId, course, title, topBar, length, onRetry }: Frame) {
  const [attempt, setAttempt] = useState(0);
  const session = useSlidesSession(assignmentId, attempt);
  const retry = () => { setAttempt((n) => n + 1); onRetry(); };
  const submitted = session.phase === "ready" && session.readOnly;
  return (
    <EditorPage course={course} title={title} topBar={topBar} status={<StatusBar save={slidesStatusOf(session)} readOnly={submitted} length={length} />}>
      <Body session={session} retry={retry} title={title} here={`/rad/${assignmentId}`} />
    </EditorPage>
  );
}

function Body({ session, retry, title, here }: { session: SlidesSession; retry: () => void; title: string | null; here: string }) {
  switch (session.phase) {
    case "loading": return <SlideEditor source={{ kind: "loading" }} />;
    case "blocked": return <Card title={sync.blockedTitle}><p role="status">{sync.blockedBody}</p></Card>;
    case "signed-out": return <Card title={sync.signedOutTitle}><p role="status">{sync.signedOutBody}</p></Card>;
    case "unavailable": return (
      <Card title={sync.unavailableTitle}>
        <p role="alert">{sync.unavailableBody}</p>
        <Button tone="secondary" onClick={retry}>{sync.retry}</Button>
      </Card>
    );
    case "recovery": return <Recovery session={session} />;
    case "ready": {
      const source: SlideEditorSource = { kind: "ready", doc: session.document, readOnly: session.readOnly };
      return (
        <>
          {session.snapshot.stopped && <p role="alert">{sync.stoppedNote}</p>}
          {session.snapshot.refused && <p role="alert">{sync.refusedNote}</p>}
          <SlideEditor source={source} onSteps={session.onSteps} unsavedNote={false} />
          <SlidesExport documentId={session.documentId} title={title} confirmed={session.snapshot.receiptVerified} here={here} />
        </>
      );
    }
  }
}

function Recovery({ session }: { session: Extract<SlidesSession, { phase: "recovery" }> }) {
  const [step, setStep] = useState<"idle" | "confirm" | "done" | "failed">("idle");
  const take = async () => {
    const result = await session.adopt(true).catch(() => ({ kind: "unavailable" as const }));
    setStep(result.kind === "adopted" ? "done" : "failed");
  };
  return (
    <Card title={sync.recoveryTitle}>
      <p role="alert">{sync.recoveryBody}</p>
      {step === "done" ? <p role="status">{sync.adoptDone}</p> : (
        <>
          <p>{sync.adoptNote}</p>
          {step === "failed" && <p role="alert">{sync.adoptFailed}</p>}
          {step === "confirm"
            ? <Button tone="secondary" onClick={() => void take()}>{sync.adoptConfirm}</Button>
            : <Button tone="secondary" onClick={() => setStep("confirm")}>{sync.adopt}</Button>}
        </>
      )}
      {session.document !== null && <SlideEditor source={{ kind: "ready", doc: session.document, readOnly: true }} unsavedNote={false} />}
    </Card>
  );
}
