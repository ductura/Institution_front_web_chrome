"use client";

// F4-MEN-R01 (odluka 4: mentorstvo otvara nastavnik): the card "Novo mentorstvo" of N-16 with "Otvori
// mentorstvo" (prototype `om-h`). The teacher picks a student of their own courses, the kind of work and an
// optional topic; mentorship.open.post opens it and the student gets a notification. A note follows only the
// server's answer (B-6); after an opening the page reads again so the new mentorship shows.
import { useEffect, useState } from "react";
import { Button, Card, Select, TextField } from "@ductura/ui";

import { WORK_TYPES, type MentorshipWorkType } from "../../../../../../src/client/mentorship";
import { mentorPlanText as t } from "./messages.hr";
import { openMentorship, readPickable, topicOf, type OpenCall, type OpenOutcome, type PickableRead } from "./open-mentorship";

type Note = { tone: "status" | "alert"; text: string };

const NOTES: Record<Exclude<OpenOutcome["kind"], "signedOut">, Note> = {
  opened: { tone: "status", text: t.open.opened },
  notFound: { tone: "alert", text: t.open.notFound },
  alreadyOpen: { tone: "alert", text: t.open.alreadyOpen },
  invalid: { tone: "alert", text: t.open.invalid },
  noRule: { tone: "alert", text: t.open.noRule },
  unknown: { tone: "alert", text: t.open.unknown },
};

/** `justOpened`: the page read again after an opening (which mounts this card anew), so the note stays. */
export function OpenMentorshipCard({ call, onOpened, onSignedOut, justOpened = false }:
  { call: () => OpenCall; onOpened?: () => void; onSignedOut?: () => void; justOpened?: boolean }) {
  const [students, setStudents] = useState<PickableRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [studentId, setStudentId] = useState("");
  const [workType, setWorkType] = useState<MentorshipWorkType>("bachelor_thesis");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(justOpened ? NOTES.opened : null);

  useEffect(() => {
    let live = true;
    void readPickable(call()).then((read) => {
      if (!live) return;
      if (read.kind === "signedOut") onSignedOut?.();
      setStudents(read);
      // A student who dropped off the list can no longer be picked.
      if (read.kind === "ready") setStudentId((id) => (read.students.some((s) => s.studentId === id) ? id : ""));
    });
    return () => { live = false; };
    // `call` is stable per mount; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const checkedTopic = topicOf(topic);

  async function open() {
    if (busy) return;
    setNote(null);
    if (studentId === "") { setNote({ tone: "alert", text: t.open.studentRequired }); return; }
    if (!checkedTopic.ok) { setNote({ tone: "alert", text: t.open.topicTooLong }); return; }
    setBusy(true);
    const outcome = await openMentorship(call(), { studentId, workType, topic: checkedTopic.topic });
    setBusy(false);
    if (outcome.kind === "signedOut") { onSignedOut?.(); return; }
    setNote(NOTES[outcome.kind]);
    if (outcome.kind === "opened") { setStudentId(""); setTopic(""); onOpened?.(); }
    if (outcome.kind === "notFound") setAttempt((n) => n + 1);
  }

  const options = students?.kind === "ready" ? students.students.map((s) => ({ value: s.studentId, label: s.name })) : [];
  return (
    <Card level={2} title={t.open.title}>
      <p>{t.open.lead}</p>
      {students?.kind === "unavailable" && (
        <>
          <p role="alert">{t.open.studentsUnavailable}</p>
          <p><Button tone="quiet" onClick={() => setAttempt((n) => n + 1)}>{t.open.retry}</Button></p>
        </>
      )}
      {students?.kind === "ready" && students.students.length === 0 && <p>{t.open.noStudents}</p>}
      <div data-testid="open-mentorship">
        <Select label={t.open.student} value={studentId} options={[{ value: "", label: t.open.studentPlaceholder }, ...options]}
          onChange={(event) => setStudentId(event.target.value)} />
        <Select label={t.open.workType} value={workType} options={WORK_TYPES.map((value) => ({ value, label: t.open.workTypes[value] }))}
          onChange={(event) => setWorkType(event.target.value as MentorshipWorkType)} />
        <TextField label={t.open.topic} value={topic} error={checkedTopic.ok ? undefined : t.open.topicTooLong}
          onChange={(event) => setTopic(event.target.value)} />
        <p><Button tone="secondary" busy={busy} disabled={students?.kind !== "ready" || students.students.length === 0}
          onClick={() => void open()}>
          {busy ? t.open.opening : t.open.button}
        </Button></p>
      </div>
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
    </Card>
  );
}
