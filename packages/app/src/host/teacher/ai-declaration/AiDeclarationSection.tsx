"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Dialog, TeacherAiAttachments, type TeacherAiAttachmentsState } from "@ductura/ui";

import type { DeclarationPort, TeacherDeclarationRead } from "../../../../../../src/client/declaration.ts";
import { teacherAiLabels } from "../work/ai-attachments/messages.hr";
import { aiDeclarationMessages as text } from "./messages.hr";
import { unavailableDeclarationPort } from "./ports";

type Ready = Extract<TeacherDeclarationRead, { kind: "ready" }>;

function toState(read: TeacherDeclarationRead): TeacherAiAttachmentsState {
  if (read.kind === "unavailable") return { kind: "error" };
  // The conversations are listed below and open in the ch-h dialog, not in the page.
  return read.kind === "ready" ? { ...read, conversations: [] } : read;
}

/**
 * N-07 declPanel and dialog ch-h (WEB-2165): the declaration on the submission page, with each
 * attached conversation opened in a dialog „Razgovor n · datum”. Read only; the port hands over
 * attached conversations only (D-41).
 */
export default function AiDeclarationSection({ port = unavailableDeclarationPort, submissionId }: {
  port?: DeclarationPort; submissionId: string;
}) {
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
    <section aria-label={text.heading}>
      <h2>{text.heading}</h2>
      <TeacherAiAttachments labels={teacherAiLabels} state={state} onRetry={retry} />
      {ready && ready.conversations.length > 0 && (
        <div>
          <h3>{`${text.conversationsHeading} (${ready.conversations.length})`}</h3>
          <ul>
            {ready.conversations.map((c, i) => (
              <li key={c.conversationId}>
                <span>{c.title}</span>{" "}
                <Button onClick={(event) => { opener.current = event.currentTarget; setOpenIndex(i); }}>
                  {text.review}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Dialog open={open !== undefined} title={text.dialogTitle((openIndex ?? 0) + 1, ready?.confirmedAt ?? "")}
        onClose={() => setOpenIndex(null)}
        actions={<Button onClick={() => setOpenIndex(null)}>{text.close}</Button>}>
        {open && (
          <>
            <p>{text.dialogNote}</p>
            <ol>
              {open.turns.filter((t) => t.seq <= open.throughSeq).map((turn) => (
                <li key={turn.seq}>
                  <strong>{turn.author === "student" ? text.student : open.assistantName}</strong>{" "}
                  <span>{turn.text}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </Dialog>
    </section>
  );
}
