"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button, Card, RouteLoading, Select, Tag } from "@ductura/ui";

import { createApi, goToSignIn } from "../../../../../../src/client/api";
import {
  canWithdraw, nameText, studentMentorshipCall, WORK_TYPES, type CandidatesRead, type MentorshipRead, type MentorshipWorkType, type StudentMentorshipCall,
} from "../../../../../../src/client/mentorship";
import { appHref } from "../../../../../../src/components/shell/nav";
import { formatDateHr } from "../../../../../../src/lib/i18n/hr";
import { useHost } from "../../context";
import { hostText } from "../../../text";
import KeyDates from "../../teacher/key-dates/KeyDates";
import { keyDatesPort, type KeyDatesCall } from "../../teacher/key-dates/contract";
import { keyDatesMessages } from "../../teacher/key-dates/messages.hr";
import { mentorshipRequestText as t } from "./messages.hr";
import { readOpened, withoutApproved, type OpenedCall, type OpenedMentorship, type OpenedRead } from "./opened";
import { approvedOf, canRetarget, readMentorCandidates, readMyMentorshipRequests, sendRequest, statusText, withdrawRequest, type Note } from "./model";

/** The student's transport: the contract routes of mentorship.* through createApi. */
const defaultCall = () => studentMentorshipCall();
/** MK-13: the same timeline the mentor sees (mentorship.key-dates.get), for each approved mentorship. */
const keyDatesCall = () => createApi() as unknown as KeyDatesCall;
/** F4-MEN-R01: notifications.mentorship-opened.list.get, the mentorships a teacher opened for the student. */
const openedCall = () => createApi() as unknown as OpenedCall;

/**
 * Student: "Zahtjev za mentorstvo" (WEB-1404). The form sends a request, the list
 * shows each as "Čeka odluku", "Odobreno" or "Odbijeno" (never the reason, P-6),
 * and a pending one can be withdrawn. A note follows only the server's answer (B-6).
 * WEB-NF6-ETAPE (MK-7): "Moje mentorstvo" names the mentor of each approved request; a declined one says
 * its reason is not available yet (2148; not in the contract) and can go to another teacher.
 * F4-MEN-R01 (odluka 4): "Moje mentorstvo" also lists each mentorship a teacher opened for the student
 * (notifications.mentorship-opened), read on its own; its failure says so and never hides the requests.
 * `call` is for tests; the page uses the client.
 */
export default function MentorshipRequestPage({ call = defaultCall, keyDates = keyDatesCall, openedBy = openedCall }:
  { call?: () => StudentMentorshipCall; keyDates?: () => KeyDatesCall; openedBy?: () => OpenedCall }) {
  const { base } = useHost();
  const datesPort = useMemo(() => keyDatesPort(keyDates), [keyDates]);
  const here = appHref(base, "/zadaci/mentorstvo");
  const [read, setRead] = useState<MentorshipRead | null>(null);
  const [opened, setOpened] = useState<OpenedRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [candidates, setCandidates] = useState<CandidatesRead | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [workType, setWorkType] = useState<MentorshipWorkType>("bachelor_thesis");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let live = true;
    void readMyMentorshipRequests(call()).then((result) => {
      if (!live) return;
      if (result.kind === "session-expired") goToSignIn(here);
      setRead(result);
    });
    void readOpened(openedBy()).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") goToSignIn(here);
      setOpened(result);
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

  function retarget(type: MentorshipWorkType) {
    setWorkType(type);
    setTeacherId("");
    setNote({ tone: "status", text: t.retargetNote });
    const select = formRef.current?.querySelector("select");
    select?.focus();
    select?.scrollIntoView?.({ block: "center" });
  }

  let list;
  let approved: ReturnType<typeof approvedOf> | null = null;
  if (read === null || read.kind === "session-expired") list = <RouteLoading label={hostText.loading} />;
  else if (read.kind === "nepoznato") {
    list = (
      <Card level={2} title={t.listTitle}>
        <p role="alert">{t.unavailable}</p>
        <p><Button tone="quiet" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button></p>
      </Card>
    );
  } else {
    approved = approvedOf(read.requests);
    list = (
      <Card level={2} title={t.listTitle}>
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
                {canRetarget(request) && (
                  <>
                    <br />
                    <span>{t.declinedReason}</span>{" "}
                    <Button tone="quiet" disabled={busy !== null} aria-label={`${t.retarget}: ${t.workTypes[request.workType]}`}
                      onClick={() => retarget(request.workType)}>{t.retarget}</Button>
                  </>
                )}
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

  // F4-MEN-R01: the mentorships a teacher opened stand first; one that is also an approved request shows once.
  const openedList: OpenedMentorship[] = opened?.kind === "ready"
    ? withoutApproved(opened.opened, (approved ?? []).flatMap((r) => (r.mentorshipId === null ? [] : [r.mentorshipId]))) : [];
  const shown = openedList.length + (approved?.length ?? 0);
  const mine = approved === null && opened?.kind !== "ready" && opened?.kind !== "unavailable" ? null : (
    <Card level={2} title={t.mine.title}>
      {opened?.kind === "unavailable" && <p role="alert">{t.mine.openedUnavailable}</p>}
      {shown === 0 && approved !== null && opened?.kind === "ready" && <p>{t.mine.empty}</p>}
      {shown > 0 && (
        <>
          <ul>
            {openedList.map((o) => (
              <li key={o.id} data-testid="my-mentorship">
                <strong>{t.mine.mentor.replace("{type}", t.workTypes[o.workType]).replace("{name}", nameText(o.mentorName) ?? t.teacherUnnamed)}</strong>
                {o.readAt === null && <>{" "}<Tag tone="accent">{t.mine.openedNew}</Tag></>}
                <br />
                <span>{t.mine.openedOn.replace("{date}", formatDateHr(o.createdAt))}</span>
                {o.topic !== null && <><br /><span>{t.mine.openedTopic.replace("{topic}", o.topic)}</span></>}
              </li>
            ))}
            {(approved ?? []).map((request) => (
              <li key={request.requestId} data-testid="my-mentorship">
                <strong>{t.mine.mentor.replace("{type}", t.workTypes[request.workType]).replace("{name}", nameText(request.teacherName) ?? t.teacherUnnamed)}</strong>
                <br />
                <span>{t.mine.openedOn.replace("{date}", formatDateHr(request.endedAt ?? request.requestedAt))}</span>
              </li>
            ))}
          </ul>
          <p>{t.mine.start} <a href={appHref(base, "/zadaci")}>{t.mine.toTasks}</a></p>
        </>
      )}
    </Card>
  );

  return (
    <div className="page">
      <p><a href={appHref(base, "/zadaci")}><span aria-hidden="true">← </span>{t.back}</a></p>
      <header>
        <h1>{t.title}</h1>
        <p>{t.lead}</p>
      </header>
      {mine}
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      <Card level={2} title={t.formTitle}>
        <form ref={formRef} onSubmit={(event) => void send(event)}>
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
      {read?.kind === "ready" && read.requests.flatMap((r) => (r.mentorshipId === null ? [] : [
        <KeyDates key={r.mentorshipId} mentorshipId={r.mentorshipId} port={datesPort}
          title={keyDatesMessages.forMentor(nameText(r.teacherName) ?? t.teacherUnnamed)} />,
      ]))}
      {openedList.map((o) => (
        <KeyDates key={o.mentorshipId} mentorshipId={o.mentorshipId} port={datesPort}
          title={keyDatesMessages.forMentor(nameText(o.mentorName) ?? t.teacherUnnamed)} />
      ))}
    </div>
  );
}
