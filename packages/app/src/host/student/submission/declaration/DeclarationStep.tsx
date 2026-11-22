"use client";

// Step 2 of the submission, E-9 "Izjava", with the PD-2 dialog "Razgovor N" (WEB-2107).
// What Ductura recorded and what the student declares stand in separate blocks (D-40, D-44). The
// confirmation stays in this browser for this sign-in, as for step 3 (flow.ts).
import {
  Button, Dialog, Select, StepActions, StepCheck, StepDecl, StepEntry, StepKv, StepLoading, StepNav, StepPanel, StepSub, Tag, TextArea,
} from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { readConfirmed, useSessionTag, writeConfirmed } from "../../../../../../../src/components/predaja/Declaration.tsx";
import { confirmationKey, stepHref } from "../../../../../../../src/components/predaja/flow.ts";
import { routerPath } from "../../../../bases";
import StepLink from "../steps/StepLink";
import { chatDialogText as d, declarationStepText as t } from "./messages.hr";
import {
  ANSWER_MAX_LENGTH, canProceed, chatTitle, entryLabel, mismatchTarget, mismatchText, recordedLine, stepView,
  type Chat, type DeclarationRead, type FormChoice,
} from "./model";

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
  readonly read: DeclarationRead;
  readonly onRetry: () => void;
  readonly hrefOf: (path: string) => string;
};

export default function DeclarationStep({ assignmentId, workState, read, onRetry, hrefOf }: DeclarationStepProps) {
  const router = useRouter();
  const tag = useSessionTag();
  const key = tag === null ? null : confirmationKey(tag, assignmentId);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => setConfirmed(readConfirmed(key)), [key]);
  const [form, setForm] = useState<FormChoice | null>(null);
  const [answer, setAnswer] = useState("");
  const [chat, setChat] = useState<Chat | null>(null);
  const [todo, setTodo] = useState(false);
  const why = useId();
  const view = stepView(workState, read);
  const ready = read.kind === "ready" ? read : null;
  const chosen = form ?? ready?.declared?.form ?? "used";
  const target = ready ? mismatchTarget(ready.recorded, chosen) : null;
  const proceed = canProceed(view, confirmed);
  const back = () => router.push(routerPath(hrefOf(stepHref(assignmentId, "tekst"))));
  const later = () => setTodo(true);

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
            <StepActions><Button tone="secondary" onClick={onRetry}>{t.retry}</Button></StepActions>
          </>
        )}
        {ready && (
          <>
            <StepDecl title={t.recorded} tag={<Tag>{t.recordedTag}</Tag>}>
              {ready.recorded.length === 0 ? <p className="note">{t.emptyRecorded}</p> : ready.recorded.map((item, index) => {
                const { line, who } = recordedLine(item);
                return <StepEntry key={index} who={who}>{line}</StepEntry>;
              })}
              {ready.recorded.length > 0 && !closed && <StepLink href="#izjava" onClick={later}>{t.addNote}</StepLink>}
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
              {!closed && <StepLink href="#izjava" onClick={later}>{ready.declared === null ? t.fillDeclaration : t.editDeclaration}</StepLink>}
              {todo && <p className="note" role="status">{t.notDone}</p>}
            </StepDecl>
            {ready.chats.length === 0 ? <p className="note">{t.emptyChats}</p> : (
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
            {ready.question !== null && (
              <>
                <StepSub>{t.question}</StepSub>
                <p className="note">{ready.question}</p>
                <TextArea label={t.answer} value={answer} maxLength={ANSWER_MAX_LENGTH} readOnly={closed} rows={undefined}
                  onChange={(event) => setAnswer(event.currentTarget.value)} />
              </>
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
            <StepCheck id="sb-confirm" checked={confirmed} describedBy={proceed ? undefined : why}
              onChange={(next) => { setConfirmed(next); writeConfirmed(key, next); }}>{t.confirm}</StepCheck>
            {!confirmed && <p className="meta" id={why}>{t.why}</p>}
          </>
        )}
        {closed && <p className="note" role="status">{t.submitted}</p>}
        <StepActions>
          {!closed && (
            <Button aria-disabled={!proceed || undefined} aria-describedby={proceed ? undefined : why}
              onClick={() => { if (proceed) router.push(routerPath(hrefOf(stepHref(assignmentId, "pregled", tag ?? undefined)))); }}>{t.next}</Button>
          )}
          <Button tone="secondary" onClick={back}>{t.back}</Button>
        </StepActions>
      </StepPanel>
      <ChatDialog chat={chat} onClose={() => setChat(null)} />
    </>
  );
}
