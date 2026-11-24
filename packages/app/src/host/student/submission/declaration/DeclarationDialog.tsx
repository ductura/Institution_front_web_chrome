"use client";

// NF-3 PR-5 (PD-10, R-56, odluka 2165, odgovor 7): the declaration as a dialog from steps 3 and 4, so
// the student does not lose their place in the submission. Step 2 stays the declaration's page; this
// dialog reads and confirms the same declaration-v1 through the same step ports (one session for both
// halves), and closing it (Zatvori, Escape) leaves the student on the step that opened it, with the
// focus back on what opened it (the shared Dialog). Only the server's answer checks the box, and only a
// confirmation the server holds for the current revision of the text counts as held: that is the gate's
// word (student.declaration.get read per revision), not the step's, which also counts a stale one.
import { Button, Dialog, StepCheck, StepKv, StepLoading } from "@ductura/ui";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import StudentStatement from "../../statement/StudentStatement";
import { serverGate, useDeclarationGate, type GateRead } from "../summary/declaration-gate";
import { isStale } from "./dialog-model";
import { declarationStepText as t } from "./messages.hr";
import { canConfirm, confirmLine, stepView, type ConfirmState, type DeclarationRead } from "./model";
import { createStepPorts, type StepPorts, type StepRead } from "./step-ports";

const FAILED_READ: StepRead = { kind: "read", view: { kind: "error" }, statement: { kind: "unavailable" }, confirmed: false };

export type DeclarationDialogProps = {
  readonly assignmentId: string;
  readonly open: boolean;
  /** The declaration's gate, read again after every confirmation; the server's by default. */
  readonly declarationGate?: GateRead;
  /** Called on every close; the step reads its gate again, since the dialog may have confirmed. */
  readonly onClose: () => void;
  readonly onSignIn: () => void;
  /** The step's ports; one createStepPorts for the dialog's life by default. */
  readonly ports?: StepPorts;
};

export default function DeclarationDialog({ open, ...props }: DeclarationDialogProps) {
  // Each opening reads the declaration afresh: the step's gate may be older than the server.
  return open ? <Opened {...props} /> : null;
}

function Opened({ assignmentId, declarationGate = serverGate, onClose, onSignIn, ports: given }: Omit<DeclarationDialogProps, "open">) {
  const ports = useMemo(() => given ?? createStepPorts(), [given]);
  const [step, setStep] = useState<StepRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmState>("none");
  const closeButton = useRef<HTMLButtonElement>(null);
  const why = useId();
  const signIn = useRef(onSignIn);
  signIn.current = onSignIn;
  const { gate, reload: readGate } = useDeclarationGate(assignmentId, declarationGate);
  const reload = () => { setAttempt((n) => n + 1); readGate(); };
  useEffect(() => {
    let live = true;
    void ports.read(assignmentId).then((next) => {
      if (!live) return;
      if (next.kind === "signedOut") return signIn.current();
      setStep(next);
    }, () => { if (live) setStep(FAILED_READ); });
    return () => { live = false; };
  }, [ports, assignmentId, attempt]);
  // Held only as the gate says, for this revision; a held confirmation the server dropped is said so.
  useEffect(() => {
    if (gate.kind === "loading") return;
    setConfirm((current) => (gate.kind === "confirmed" ? "saved" : current === "saved" ? "reopened" : current));
  }, [gate]);

  const read: DeclarationRead = step?.kind === "read" ? step.view : { kind: "loading" };
  const view = stepView("in_progress", read);
  const ready = read.kind === "ready" ? read : null;
  const confirmable = canConfirm(view, read, confirm);
  const line = confirmLine(confirm);
  // Stale only until this dialog's confirmation is held by the server.
  const again = isStale(gate) && confirm !== "saved";

  const send = async (next: boolean) => {
    if (!next || !confirmable) return;
    setConfirm("sending");
    const outcome = await ports.confirm(assignmentId);
    if (outcome === "signedOut") return signIn.current();
    setConfirm(outcome);
    if (outcome === "saved" || outcome === "conflict" || outcome === "stale") reload();
  };

  return (
    <Dialog open title={t.title} onClose={onClose} dismissible={confirm !== "sending"}
      initialFocus={ready === null ? closeButton : undefined}
      actions={<Button ref={closeButton} tone="secondary" aria-disabled={confirm === "sending" || undefined}
        onClick={() => { if (confirm !== "sending") onClose(); }}>{t.dialogClose}</Button>}>
      <p className="meta">{t.dialogMeta}</p>
      {again && <p className="note" role="status">{t.staleNotice}</p>}
      {view === "loading" && <StepLoading message={t.dialogLoading} />}
      {view === "error" && (
        <>
          <p className="note" role="alert">{t.error}</p>
          <Button tone="secondary" onClick={reload}>{t.retry}</Button>
        </>
      )}
      {ready !== null && (
        <>
          {ready.declared === null ? <p className="note">{t.emptyDeclared}</p> : (
            <>
              <StepKv label={t.tools}>{ready.declared.tools}</StepKv>
              <StepKv label={t.purpose}>{ready.declared.purpose}</StepKv>
              <StepKv label={t.phase}>{ready.declared.phase}</StepKv>
              <StepKv label={t.humanHelp}>{ready.declared.humanHelp.text}</StepKv>
            </>
          )}
          {step?.kind === "read" && (
            <StudentStatement port={ports.statement} assignmentId={assignmentId} read={step.statement} onReload={reload} onSignIn={() => signIn.current()} />
          )}
          <StepCheck id="sb-dialog-confirm" checked={confirm === "saved"} disabled={!confirmable}
            describedBy={ready.declared === null ? why : undefined} onChange={(next) => void send(next)}>{again ? t.confirmAgain : t.confirm}</StepCheck>
          {ready.declared === null && <p className="meta" id={why}>{t.fillFirst}</p>}
          {line !== null && <p className="note" role={line.role}>{line.text}</p>}
        </>
      )}
    </Dialog>
  );
}
