"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionRow, Button, Dialog, EntryList, TeacherAiAttachments, type TeacherAiAttachmentsState } from "@ductura/ui";

import type { DeclarationPort, TeacherDeclarationRead } from "../../../../../../src/client/declaration.ts";
import { teacherAiLabels } from "../work/ai-attachments/messages.hr";
import { aiDeclarationMessages as text } from "./messages.hr";
import { createTeacherDeclarationPort } from "./ports";
import QuestionAnswer from "./QuestionAnswer";

type Ready = Extract<TeacherDeclarationRead, { kind: "ready" }>;

function toState(read: TeacherDeclarationRead): TeacherAiAttachmentsState {
  if (read.kind === "unavailable" || read.kind === "signedOut") return { kind: "error" };
  // The conversations are listed below and open in the ch-h dialog, not in the page.
  return read.kind === "ready" ? { ...read, conversations: [] } : read;
}

/**
 * N-07 declPanel and dialog ch-h (WEB-2165): the declaration on the submission page, with each
 * attached conversation opened in a dialog „Razgovor n, datum”. Read only; the port hands over
 * attached conversations only (D-41). Without a given port it reads the server's declaration
 * (teacher.declaration-second.get, PIL-K-AI-PRILOZI); a route that fails is said, never an empty list.
 */
export default function AiDeclarationSection({ port: given, submissionId }: {
  port?: DeclarationPort; submissionId: string;
}) {
  const port = useMemo(() => given ?? createTeacherDeclarationPort(), [given]);
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<TeacherDeclarationRead | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    void port.readTeacher(submissionId).then((next) => { if (active) setRead(next); });
    return () => { active = false; };
  }, [port, submissionId, attempt]);

  const retry = () => { setRead(null); setAttempt((n) => n + 1); };
  const state: TeacherAiAttachmentsState = read === null ? { kind: "loading" } : toState(read);
  const ready: Ready | null = read?.kind === "ready" ? read : null;
  const open = ready !== null && openIndex !== null ? ready.conversations[openIndex] : undefined;

  return (
    <section className="card" aria-label={text.heading}>
      <h2>{text.heading}</h2>
      <TeacherAiAttachments labels={teacherAiLabels} state={state} onRetry={retry} />
      <QuestionAnswer read={read} />
      {ready && ready.conversations.length > 0 && (
        <>
          <h3 className="sb-sub">{`${text.conversationsHeading} (${ready.conversations.length})`}</h3>
          <ul className="list">
            {ready.conversations.map((c, i) => (
              <li key={c.conversationId} className="item">
                <span className="title">{c.title}</span>
                <ActionRow>
                  <Button tone="secondary" size="small" onClick={(event) => { opener.current = event.currentTarget; setOpenIndex(i); }}>
                    {text.review}
                  </Button>
                </ActionRow>
              </li>
            ))}
          </ul>
        </>
      )}
      <Dialog open={open !== undefined} title={text.dialogTitle((openIndex ?? 0) + 1, ready?.confirmedAt ?? "")}
        onClose={() => setOpenIndex(null)}
        actions={<Button tone="secondary" onClick={() => setOpenIndex(null)}>{text.close}</Button>}>
        {open && (
          <>
            <p className="meta">{text.dialogNote}</p>
            <EntryList entries={open.turns.filter((t) => t.seq <= open.throughSeq).map((turn) => ({
              id: String(turn.seq), who: turn.author === "student" ? text.student : text.assistant, text: turn.text,
            }))} />
          </>
        )}
      </Dialog>
    </section>
  );
}
