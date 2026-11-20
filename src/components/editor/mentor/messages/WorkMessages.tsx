"use client";

import { Button, Details, TextArea } from "@ductura/ui";
import { useRef, useState, type FormEvent } from "react";

import { readWorkMessages, sendWorkMessage, type WorkMessage } from "@/client/work-messages";
import { zagrebParts } from "@/components/summary/zagreb-time";

import { useMentorRead, type MentorAccess } from "../milestones/useMentorRead";
import { workMessagesHr as t } from "./messages.hr";
import styles from "./WorkMessages.module.css";

const VISIBLE = 6;

export function WorkMessages({ role, ...access }: MentorAccess & { role: WorkMessage["senderRole"] }) {
  const { data, setData, status, retry } = useMentorRead(readWorkMessages, access);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const messages = data?.messages ?? [];

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || !access.current()) return;
    const text = draft.trim();
    if (!text) { setError(t.blank); return; }
    if ([...text].length > 2000) { setError(t.tooLong); return; }
    inFlight.current = true;
    setSending(true);
    setError(undefined);
    const result = await sendWorkMessage(access.documentId, text).catch(() => null);
    inFlight.current = false;
    if (!access.current()) return;
    setSending(false);
    if (result?.ok) {
      const saved = result.body;
      setData((list) => list && { messages: list.messages.some(({ id }) => id === saved.id) ? list.messages : [...list.messages, saved] });
      setDraft("");
    } else if (result?.status === 401) {
      access.onSessionEnd();
    } else {
      setError(result?.status === 422 || result?.status === 413 ? t.rejected : t.failed);
    }
  };

  return <Details summary={data ? t.count.replace("{total}", String(messages.length)) : t.heading}>
    {status === "loading" && <p role="status">{t.loading}</p>}
    {(status === "unavailable" || status === "notFound") && <p role="alert">{t.unavailable}</p>}
    {status === "unavailable" && <Button tone="quiet" onClick={retry}>{t.retry}</Button>}
    {status === "ready" && <>
      {messages.length === 0 ? <p>{t.empty}</p> : <ol className={styles.list}>
        {messages.slice(-VISIBLE).map((message) => {
          const parts = zagrebParts(message.createdAt);
          return <li key={message.id}>
            <strong>{t.sender[message.senderRole]}</strong>
            {parts && <> · <time dateTime={message.createdAt}>{parts.date} {parts.time}</time></>}
            <p>{message.text}</p>
          </li>;
        })}
      </ol>}
      {messages.length > VISIBLE && <p>{t.shown.replace("{shown}", String(VISIBLE)).replace("{total}", String(messages.length))}</p>}
      <form onSubmit={(event) => void send(event)} className={styles.form}>
        <TextArea rows={2} label={t.label[role]} value={draft} error={error} busy={sending}
          onChange={(event) => { setDraft(event.target.value); setError(undefined); }} />
        <Button type="submit" disabled={sending}>{sending ? t.sending : t.send}</Button>
      </form>
    </>}
  </Details>;
}
