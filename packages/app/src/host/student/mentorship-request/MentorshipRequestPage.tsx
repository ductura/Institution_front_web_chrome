"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Card, RouteLoading, Select, Tag } from "@ductura/ui";

import { goToSignIn } from "../../../../../../src/client/api";
import {
  canWithdraw, nameText, studentMentorshipCall, WORK_TYPES, type CandidatesRead, type MentorshipRead, type MentorshipWorkType, type StudentMentorshipCall,
} from "../../../../../../src/client/mentorship";
import { appHref } from "../../../../../../src/components/shell/nav";
import { formatDateHr } from "../../../../../../src/lib/i18n/hr";
import { useHost } from "../../context";
import { hostText } from "../../../text";
import { mentorshipRequestText as t } from "./messages.hr";
import { readMentorCandidates, readMyMentorshipRequests, sendRequest, statusText, withdrawRequest, type Note } from "./model";

/** The student's transport: the contract routes of mentorship.* through createApi. */
const defaultCall = () => studentMentorshipCall();

/**
 * Student: "Zahtjev za mentorstvo" (WEB-1404). The form sends a request, the list
 * shows each as "Čeka odluku", "Odobreno" or "Odbijeno" (never the reason, P-6),
 * and a pending one can be withdrawn. A note follows only the server's answer (B-6).
 * `call` is for tests; the page uses the client.
 */
export default function MentorshipRequestPage({ call = defaultCall }: { call?: () => StudentMentorshipCall }) {
  const { base } = useHost();
  const here = appHref(base, "/zadaci/mentorstvo");
  const [read, setRead] = useState<MentorshipRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [candidates, setCandidates] = useState<CandidatesRead | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [workType, setWorkType] = useState<MentorshipWorkType>("bachelor_thesis");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  useEffect(() => {
    let live = true;
    void readMyMentorshipRequests(call()).then((result) => {
      if (!live) return;
      if (result.kind === "session-expired") goToSignIn(here);
      setRead(result);
    });
    void readMentorCandidates(call()).then((result) => {
      if (!live) return;
      if (result.kind === "session-expired") goToSignIn(here);
      setCandidates(result);
      // A teacher who dropped off the list can no longer be chosen.
      if (result.kind === "ready") setTeacherId((id) => (result.candidates.some((c) => c.teacherId === id) ? id : ""));
    });
    return () => { live = false; };
    // `call` and `here` are stable per mount; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const finish = useCallback((followup: { note: Note; refresh: boolean } | null) => {
    setBusy(null);
    if (followup === null) { goToSignIn(here); return; }
    setNote(followup.note);
    if (followup.refresh) setAttempt((n) => n + 1);
  }, [here]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy !== null) return;
    setNote(null);
    if (teacherId === "") { setNote({ tone: "alert", text: t.fieldTeacherRequired }); return; }
    setBusy("send");
    const followup = await sendRequest(call(), { workType, teacherId });
    finish(followup);
  }

  async function withdraw(requestId: string) {
    if (busy !== null) return;
    setNote(null);
    setBusy(requestId);
    finish(await withdrawRequest(call(), requestId));
  }

  let list;
  if (read === null || read.kind === "session-expired") list = <RouteLoading label={hostText.loading} />;
  else if (read.kind === "nepoznato") {
    list = (
      <Card title={t.listTitle}>
        <p role="alert">{t.unavailable}</p>
        <p><Button tone="quiet" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button></p>
      </Card>
    );
  } else {
    list = (
      <Card title={t.listTitle}>
        {read.requests.length === 0 ? <p>{t.empty}</p> : (
          <ul>
            {read.requests.map((request) => (
              <li key={request.requestId} data-testid="mentorship-request">
                <strong>{t.workTypes[request.workType]}</strong>{" "}
                <Tag tone={request.state === "approved" ? "accent" : request.state === "requested" ? "neutral" : "warn"}>
                  {statusText(request)}
                </Tag>
                <br />
                <span>
                  {t.teacherLabel.replace("{name}", nameText(request.teacherName) ?? t.teacherUnnamed)} · {t.sentOn.replace("{date}", formatDateHr(request.requestedAt))}
                  {request.endedAt === null ? "" : ` · ${t.decidedOn.replace("{date}", formatDateHr(request.endedAt))}`}
                </span>
                {canWithdraw(request) && (
                  <>
                    {" "}
                    <Button tone="quiet" busy={busy === request.requestId} disabled={busy !== null && busy !== request.requestId}
                      aria-label={`${t.withdraw}: ${t.workTypes[request.workType]}`} onClick={() => void withdraw(request.requestId)}>
                      {busy === request.requestId ? t.withdrawing : t.withdraw}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  return (
    <div className="page">
      <p><a href={appHref(base, "/zadaci")}><span aria-hidden="true">← </span>{t.back}</a></p>
      <header>
        <h1>{t.title}</h1>
        <p>{t.lead}</p>
      </header>
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      <Card title={t.formTitle}>
        <form onSubmit={(event) => void send(event)}>
          {candidates !== null && candidates.kind === "nepoznato" && <p role="alert">{t.candidatesUnavailable}</p>}
          {candidates !== null && candidates.kind === "ready" && candidates.candidates.length === 0 && <p>{t.noCandidates}</p>}
          <Select label={t.fieldTeacher} value={teacherId}
            options={[{ value: "", label: t.fieldTeacherPlaceholder }, ...(candidates?.kind === "ready" ? candidates.candidates.map((c) => ({ value: c.teacherId, label: [nameText(c.name) ?? t.teacherUnnamed, c.department].filter((x) => x !== null).join(" · ") })) : [])]}
            onChange={(event) => setTeacherId(event.target.value)} />
          <Select label={t.fieldType} value={workType} options={WORK_TYPES.map((value) => ({ value, label: t.workTypes[value] }))}
            onChange={(event) => setWorkType(event.target.value as MentorshipWorkType)} />
          <p><Button type="submit" busy={busy === "send"} disabled={(busy !== null && busy !== "send") || candidates?.kind !== "ready"}>
            {busy === "send" ? t.sending : t.send}
          </Button></p>
        </form>
      </Card>
      {list}
    </div>
  );
}
