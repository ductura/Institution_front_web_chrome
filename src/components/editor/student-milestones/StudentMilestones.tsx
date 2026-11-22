"use client";

import { Button, Dialog } from "@ductura/ui";
import { useRef, useState } from "react";

import { maySubmit, nextMilestone, submitMilestone, unavailableSubmit, type StudentMilestone, type SubmitPort } from "@/client/milestone-submit";
import { readWorkMilestones } from "@/client/work-milestones";
import { zagrebParts } from "@/components/summary/zagreb-time";

import { useMentorRead, type MentorAccess } from "../mentor/milestones/useMentorRead";
import { studentMilestonesHr as t } from "./messages.hr";
import styles from "./StudentMilestones.module.css";

const when = (iso: string) => { const p = zagrebParts(iso); return p ? `${p.date} ${p.time}` : iso; };

export function StudentMilestones({ submit = unavailableSubmit, ...access }: MentorAccess & { submit?: SubmitPort }) {
  const { data, setData, status, retry } = useMentorRead(readWorkMilestones, access);
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string>();
  const inFlight = useRef(false);
  const list = (data?.milestones ?? []) as readonly StudentMilestone[];
  const next = nextMilestone(list);

  const send = async () => {
    if (!next || inFlight.current || !access.current()) return;
    inFlight.current = true;
    setSending(true);
    const result = await submitMilestone(submit, access.documentId, next.id);
    inFlight.current = false;
    if (!access.current()) return;
    setSending(false);
    if (result.kind === "saved") {
      const saved = result.milestone;
      setData((d) => d && { milestones: d.milestones.map((m) => (m.id === saved.id ? { ...m, ...saved } : m)) });
      setNote(t.sent);
      setAsking(false);
    } else if (result.kind === "session-expired") {
      access.onSessionEnd();
    } else {
      setNote(result.kind === "promijenjeno" ? t.changed : t.unknown);
      setAsking(false);
      if (result.kind === "promijenjeno") retry();
    }
  };

  if (status === "loading") return <p role="status">{t.loading}</p>;
  if (status !== "ready") {
    return <div className={styles.box}><p role="alert">{t.unavailable}</p>{status === "unavailable" && <Button tone="quiet" onClick={retry}>{t.retry}</Button>}</div>;
  }
  if (list.length === 0) return <p>{t.none}</p>;
  if (!next) return <p>{t.allDone}</p>;

  const line = (next.dueAt === null ? t.nextNoDue : t.next.replace("{due}", when(next.dueAt)))
    .replace("{title}", next.title).replace("{state}", t.state[next.state]);
  const comment = next.state === "returned" ? next.revisionComment : null;

  return <section className={styles.box} aria-label={next.title}>
    <p><strong>{line}</strong></p>
    {next.state === "returned" && <div className={styles.revision}>
      <p><strong>{t.revisionTitle}</strong></p>
      {comment && <p>{comment}</p>}
      {next.revisionDueAt && <p>{t.revisionDue.replace("{due}", when(next.revisionDueAt))}</p>}
    </div>}
    {note && <p role="status">{note}</p>}
    {maySubmit(next) && <Button onClick={() => { setNote(undefined); setAsking(true); }}>{t.send}</Button>}
    <Dialog open={asking} title={t.confirmTitle} dismissible={!sending} onClose={() => setAsking(false)}
      actions={<>
        <Button tone="quiet" disabled={sending} onClick={() => setAsking(false)}>{t.cancel}</Button>
        <Button disabled={sending} onClick={() => void send()}>{sending ? t.sending : t.confirm}</Button>
      </>}>
      <p>{t.confirmText}</p>
    </Dialog>
  </section>;
}
