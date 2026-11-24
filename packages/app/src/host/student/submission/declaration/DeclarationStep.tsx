"use client";

// Step 2 of the submission, E-9 "Izjava", with the PD-2 dialog "Razgovor N" (WEB-2107).
// What Ductura recorded and what the student declares stand in separate blocks (D-40, D-44). The
// declaration is read and confirmed on the server (declaration-v1, PIL-K-IZJAVA) through the
// step's ports; the human help and the printout are edited in StudentStatement on the same read.
import {
  Button, Dialog, Select, StepActions, StepCheck, StepDecl, StepEntry, StepKv, StepLoading, StepNav, StepPanel, StepSub, Tag,
} from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { useSessionTag, writeConfirmed } from "../../../../../../../src/components/predaja/Declaration.tsx";
import { confirmationKey, stepHref } from "../../../../../../../src/components/predaja/flow.ts";
import { routerPath } from "../../../../bases";
import StudentStatement from "../../statement/StudentStatement";
import TeacherQuestion from "../../statement/TeacherQuestion";
import StepLink from "../steps/StepLink";
import { chatDialogText as d, declarationStepText as t } from "./messages.hr";
import {
  canConfirm, canProceed, chatTitle, confirmLine, entryLabel, mismatchTarget, mismatchText, recordedLine, stepView,
  type Chat, type ConfirmState, type DeclarationRead, type FormChoice,
} from "./model";
import type { StepPorts, StepRead } from "./step-ports";

/** PD-2: the exact conversation, closed by its button, Escape or a click on the backdrop. */
export function ChatDialog({ chat, onClose }: { chat: Chat | null; onClose: () => void }) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = body.current?.closest("dialog");
    if (!dialog || chat === null) return;
    const close = (event: MouseEvent) => { if (event.target === dialog) onClose(); };
    dialog.addEventListener("click", close);
    return () => dialog.removeEventListener("click", close);
  }, [chat, onClose]);
  if (chat === null) return null;
  return (
    <Dialog open title={chatTitle(chat)} onClose={onClose} actions={<Button tone="secondary" onClick={onClose}>{d.close}</Button>}>
      <div ref={body} style={{ display: "grid", gap: 12 }}>
        <p className="meta">{d.meta}</p>
        {chat.entries.map((entry, index) => <StepEntry key={index} who={entryLabel(entry)} whoFirst>{entry.text}</StepEntry>)}
      </div>
    </Dialog>
  );
}

export type DeclarationStepProps = {
  readonly assignmentId: string;
  readonly workState: string;
  /** Both halves of the step on one session (createStepPorts). */
  readonly ports: StepPorts;
  readonly hrefOf: (path: string) => string;
  /** Signed out: AAI@EduHr sign-in, back to this step. */
  readonly onSignIn: () => void;
};

const FAILED_READ: StepRead = { kind: "read", view: { kind: "error" }, statement: { kind: "unavailable" }, confirmed: false };

export default function DeclarationStep({ assignmentId, workState, ports, hrefOf, onSignIn }: DeclarationStepProps) {
  const router = useRouter();
  const tag = useSessionTag();
  const key = tag === null ? null : confirmationKey(tag, assignmentId);
  const [step, setStep] = useState<StepRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmState>("none");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormChoice | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const why = useId();
  const statementId = useId();
  const statementRef = useRef<HTMLDivElement>(null);
  // index.tsx gives a new onSignIn on every render; the read must not run again for it.
  const signIn = useRef(onSignIn);
  signIn.current = onSignIn;
  // Both halves are read together: one answer of the server, one version to write on.
  const reload = () => setAttempt((n) => n + 1);
  useEffect(() => {
    let live = true;
    void ports.read(assignmentId).then((next) => {
      if (!live) return;
      if (next.kind === "signedOut") return signIn.current();
      setStep(next);
      // What the server holds decides. A held confirmation the server dropped (the declaration
      // changed) is said so; an alert about a failed write stays until the next try.
      setConfirm((current) => (next.confirmed ? "saved" : current === "saved" ? "reopened" : current));
    }, () => { if (live) setStep(FAILED_READ); });
    return () => { live = false; };
  }, [ports, assignmentId, attempt]);
  // Step 3 still reads the confirmation for this sign-in from the browser: mirror only what the server holds.
  const held = step?.kind === "read" && step.confirmed;
  useEffect(() => { if (step !== null) writeConfirmed(key, held); }, [key, step, held]);

  const read: DeclarationRead = step?.kind === "read" ? step.view : { kind: "loading" };
  const view = stepView(workState, read);
  const ready = read.kind === "ready" ? read : null;
  const chosen = form ?? ready?.declared?.form ?? "used";
  const target = ready ? mismatchTarget(ready.recorded, chosen) : null;
  const proceed = canProceed(view, confirm);
  const confirmable = canConfirm(view, read, confirm);
  const line = confirmLine(confirm);
  useEffect(() => { if (editing) statementRef.current?.focus(); }, [editing]);
  const back = () => router.push(routerPath(hrefOf(stepHref(assignmentId, "tekst"))));

  const send = async (next: boolean) => {
    // Only what the student filled in is confirmed; a held confirmation is withdrawn by changing the declaration.
    if (!next || !confirmable) return;
    setConfirm("sending");
    const outcome = await ports.confirm(assignmentId);
    if (outcome === "signedOut") return signIn.current();
    setConfirm(outcome);
    // Saved, conflict and stale read both halves again: the step shows what the server now holds.
    if (outcome === "saved" || outcome === "conflict" || outcome === "stale") reload();
  };

  // The prototype's loading and error panels are titled "Izjava"; the full one carries the whole title.
  if (view === "loading") return <><div><StepNav current={2} /></div><StepPanel title={t.shortTitle} busy><StepLoading message={t.loading} /></StepPanel></>;
  const closed = view === "submitted";
  return (
    <>
      <div><StepNav current={2} /></div>
      <StepPanel title={view === "error" ? t.shortTitle : t.title}>
        {view !== "error" && <p className="meta">{t.meta}</p>}
        {view === "error" && (
          <>
            <p className="note" role="alert">{t.error}</p>
            <StepActions><Button tone="secondary" onClick={reload}>{t.retry}</Button></StepActions>
          </>
        )}
        {ready && (
          <>
            <StepDecl title={t.recorded} tag={<Tag>{t.recordedTag}</Tag>}>
              {ready.recorded.length === 0 ? <p className="note">{t.emptyRecorded}</p> : ready.recorded.map((item, index) => {
                const { line: entry, who } = recordedLine(item);
                return <StepEntry key={index} who={who}>{entry}</StepEntry>;
              })}
              {/* NF-3 PR-4 (E-9a): the block says what it holds; without conversations, that none can be attached. */}
              <p className="meta">{t.recordedExplained}</p>
              {ready.chats.length === 0 && <p className="meta">{t.emptyChats}</p>}
            </StepDecl>
            <StepDecl title={t.declared} tag={<Tag tone="open">{t.declaredTag}</Tag>} own>
              {ready.declared === null ? <p className="note">{t.emptyDeclared}</p> : (
                <>
                  <StepKv label={t.tools}>{ready.declared.tools}</StepKv>
                  <StepKv label={t.purpose}>{ready.declared.purpose}</StepKv>
                  <StepKv label={t.phase}>{ready.declared.phase}</StepKv>
                  <StepKv label={t.humanHelp}>{ready.declared.humanHelp.text}</StepKv>
                </>
              )}
              {!closed && (
                <StepLink href={`#${statementId}`} aria-expanded={editing} aria-controls={statementId} onClick={() => setEditing((open) => !open)}>
                  {editing ? t.closeEdit : ready.declared === null ? t.fillDeclaration : t.editDeclaration}
                </StepLink>
              )}
              <div id={statementId} ref={statementRef} tabIndex={-1}>
                {(editing || closed) && step?.kind === "read" && (
                  <StudentStatement port={ports.statement} assignmentId={assignmentId} read={step.statement} onReload={reload} onSignIn={() => signIn.current()} />
                )}
              </div>
            </StepDecl>
            {ready.chats.length > 0 && (
              <>
                <StepSub>{t.attachments}</StepSub>
                <p className="note">{t.attachmentsNote}</p>
                <ul className="list">
                  {ready.chats.map((c) => (
                    <li key={c.n} className="item">
                      <span className="title">{chatTitle(c)}</span>
                      {c.required && <span className="meta">{t.required}</span>}
                      <StepActions><Button tone="secondary" size="small" onClick={() => setChat(c)}>{t.review}</Button></StepActions>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {/* NF-3 PR-20: the teacher's question and the answer, written on the step's read. */}
            {step?.kind === "read" && (
              <TeacherQuestion port={ports.statement} assignmentId={assignmentId} read={step.statement} onReload={reload} onSignIn={() => signIn.current()} />
            )}
            {!closed && ready.recorded.length + ready.chats.length > 0 && (
              <>
                <Select label={t.form} value={chosen} onChange={(event) => setForm(event.currentTarget.value as FormChoice)}
                  options={[{ value: "no_use", label: t.formNone }, { value: "used", label: t.formUsed }]} />
                {target !== null && <p className="note" role="status">{mismatchText(target)}</p>}
              </>
            )}
          </>
        )}
        {!closed && (
          <>
            {/* Checked only once the server holds it, never ahead of its answer. */}
            <StepCheck id="sb-confirm" checked={confirm === "saved"} disabled={!confirmable}
              describedBy={proceed ? undefined : why} onChange={(next) => void send(next)}>{t.confirm}</StepCheck>
            {line !== null && <p className="note" role={line.role}>{line.text}</p>}
            {!proceed && <p className="meta" id={why}>{ready?.declared === null ? t.fillFirst : t.why}</p>}
          </>
        )}
        {closed && <p className="note" role="status">{t.submitted}</p>}
        <StepActions>
          {!closed && (
            <Button aria-disabled={!proceed || undefined} aria-describedby={proceed ? undefined : why}
              onClick={() => { if (proceed) router.push(routerPath(hrefOf(stepHref(assignmentId, "pregled", held ? tag ?? undefined : undefined)))); }}>{t.next}</Button>
          )}
          <Button tone="secondary" onClick={back}>{t.back}</Button>
        </StepActions>
      </StepPanel>
      <ChatDialog chat={chat} onClose={() => setChat(null)} />
    </>
  );
}
