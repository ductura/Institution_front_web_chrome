"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Card, RouteLoading, Select, Tag, TextField } from "@ductura/ui";

import { createApi, goToSignIn } from "../../../../../../src/client/api";
import {
  canWithdraw, TITLE_MAX, WORK_TYPES, type MentorshipRead, type MentorshipWorkType, type StudentMentorshipCall,
} from "../../../../../../src/client/mentorship";
import { appHref } from "../../../../../../src/components/shell/nav";
import { formatDateHr } from "../../../../../../src/lib/i18n/hr";
import { useHost } from "../../context";
import { hostText } from "../../../text";
import { mentorshipRequestText as t } from "./messages.hr";
import { readMyMentorshipRequests, sendRequest, statusText, withdrawRequest, type Note } from "./model";

/** The student's transport: the client of src/client; the routes are not in the contract yet (TODO(ugovor)). */
const defaultCall = () => createApi() as unknown as StudentMentorshipCall;

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
  const [title, setTitle] = useState("");
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
    setBusy("send");
    const followup = await sendRequest(call(), { title, workType });
    if (followup?.note.tone === "status") setTitle("");
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
                <strong>{request.title}</strong>{" "}
                <Tag tone={request.status === "approved" ? "accent" : request.status === "pending" ? "neutral" : "warn"}>
                  {statusText(request)}
                </Tag>
                <br />
                <span>
                  {t.workTypes[request.workType]} · {t.sentOn.replace("{date}", formatDateHr(request.requestedAt))}
                  {request.decidedAt === null ? "" : ` · ${t.decidedOn.replace("{date}", formatDateHr(request.decidedAt))}`}
                </span>
                {canWithdraw(request) && (
                  <>
                    {" "}
                    <Button tone="quiet" busy={busy === request.requestId} disabled={busy !== null && busy !== request.requestId}
                      aria-label={`${t.withdraw}: ${request.title}`} onClick={() => void withdraw(request.requestId)}>
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
          <TextField label={t.fieldTitle} hint={t.fieldTitleHint} value={title} maxLength={TITLE_MAX} required
            onChange={(event) => setTitle(event.target.value)} />
          <Select label={t.fieldType} value={workType} options={WORK_TYPES.map((value) => ({ value, label: t.workTypes[value] }))}
            onChange={(event) => setWorkType(event.target.value as MentorshipWorkType)} />
          <p><Button type="submit" busy={busy === "send"} disabled={busy !== null && busy !== "send"}>
            {busy === "send" ? t.sending : t.send}
          </Button></p>
        </form>
      </Card>
      {list}
    </div>
  );
}
