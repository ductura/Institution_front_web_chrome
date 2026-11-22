"use client";

// Step 2 of the submission, E-9 "Izjava", with the PD-2 dialog "Razgovor N" (WEB-2107).
// What Ductura recorded and what the student declares stand in separate blocks (D-40, D-44). The
// confirmation stays in this browser for this sign-in, as for step 3 (flow.ts).
import { Button, Card, Checkbox, Dialog, Select, Steps, Tag, TextArea } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { readConfirmed, useSessionTag, writeConfirmed } from "../../../../../../../src/components/predaja/Declaration.tsx";
import { confirmationKey, stepHref } from "../../../../../../../src/components/predaja/flow.ts";
import styles from "./DeclarationStep.module.css";
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
    <Dialog open title={chatTitle(chat)} onClose={onClose} actions={<Button tone="quiet" onClick={onClose}>{d.close}</Button>}>
      <div ref={body}>
        <p className={styles.note}>{d.meta}</p>
        {chat.entries.map((entry, index) => (
          <div key={index} className={styles.entry}>
            <span className={styles.who}>{entryLabel(entry)}</span>
            <span>{entry.text}</span>
          </div>
        ))}
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

  if (view === "notStarted") {
    return (
      <div className="page declaration">
        <h1>{t.notStartedHeading}</h1>
        <p>{t.notStarted}</p>
        <a href={hrefOf(stepHref(assignmentId, "tekst"))}>{t.openWorkspace}</a>
      </div>
    );
  }
  const back = () => router.push(hrefOf(stepHref(assignmentId, "tekst")));
  return (
    <div className="page declaration">
      <Steps currentStep={2} />
      <h1>{t.title}</h1>
      <p className={styles.note}>{t.meta}</p>
      {view === "submitted" && <p role="status">{t.submitted}</p>}
      {view === "loading" && <p role="status">{t.loading}</p>}
      {view === "error" && (
        <>
          <p role="alert">{t.error}</p>
          <Button tone="quiet" onClick={onRetry}>{t.retry}</Button>
        </>
      )}
      {ready && (
        <>
          <Card title={t.recorded}>
            <Tag>{t.recordedTag}</Tag>
            {ready.recorded.length === 0 ? <p>{t.emptyRecorded}</p> : ready.recorded.map((item, index) => {
              const { line, who } = recordedLine(item);
              return <div key={index} className={styles.entry}><span>{line}</span><span className={styles.who}>{who}</span></div>;
            })}
            {ready.recorded.length > 0 && view !== "submitted" && <Button tone="quiet" onClick={() => setTodo(true)}>{t.addNote}</Button>}
          </Card>
          <Card title={t.declared}>
            <Tag>{t.declaredTag}</Tag>
            {ready.declared === null ? <p>{t.emptyDeclared}</p> : (
              <>
                <div className={styles.kv}><span>{t.tools}</span><b>{ready.declared.tools}</b></div>
                <div className={styles.kv}><span>{t.purpose}</span><b>{ready.declared.purpose}</b></div>
                <div className={styles.kv}><span>{t.phase}</span><b>{ready.declared.phase}</b></div>
                <div className={styles.kv}><span>{t.humanHelp}</span><b>{ready.declared.humanHelp.text}</b></div>
              </>
            )}
            {view !== "submitted" && (
              <Button tone="quiet" onClick={() => setTodo(true)}>{ready.declared === null ? t.fillDeclaration : t.editDeclaration}</Button>
            )}
            {todo && <p role="status">{t.notDone}</p>}
          </Card>
          <h3>{t.attachments}</h3>
          {ready.chats.length === 0 ? <p>{t.emptyChats}</p> : (
            <>
              <p className={styles.note}>{t.attachmentsNote}</p>
              <ul className={styles.list}>
                {ready.chats.map((c) => (
                  <li key={c.n} className={styles.item}>
                    <span>{chatTitle(c)}</span>
                    {c.required && <span className={styles.note}>{t.required}</span>}
                    <Button tone="quiet" onClick={() => setChat(c)}>{t.review}</Button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {ready.question !== null && (
            <>
              <h3>{t.question}</h3>
              <p>{ready.question}</p>
              <TextArea label={t.answer} value={answer} maxLength={ANSWER_MAX_LENGTH} readOnly={view === "submitted"}
                onChange={(event) => setAnswer(event.currentTarget.value)} />
            </>
          )}
          {view !== "submitted" && ready.recorded.length + ready.chats.length > 0 && (
            <>
              <Select label={t.form} value={chosen} onChange={(event) => setForm(event.currentTarget.value as FormChoice)}
                options={[{ value: "no_use", label: t.formNone }, { value: "used", label: t.formUsed }]} />
              {target !== null && <p role="status">{mismatchText(target)}</p>}
            </>
          )}
        </>
      )}
      {view !== "submitted" && view !== "loading" && (
        <Checkbox label={t.confirm} checked={confirmed}
          onChange={(event) => { setConfirmed(event.currentTarget.checked); writeConfirmed(key, event.currentTarget.checked); }} />
      )}
      {!proceed && view !== "submitted" && view !== "loading" && <p id={why} className={styles.note}>{t.why}</p>}
      <p>
        {view !== "submitted" && (
          <Button aria-disabled={!proceed || undefined} aria-describedby={proceed ? undefined : why}
            onClick={() => { if (proceed) router.push(hrefOf(stepHref(assignmentId, "pregled", tag ?? undefined))); }}>{t.next}</Button>
        )}
        <Button tone="quiet" onClick={back}>{t.back}</Button>
      </p>
      <ChatDialog chat={chat} onClose={() => setChat(null)} />
    </div>
  );
}
