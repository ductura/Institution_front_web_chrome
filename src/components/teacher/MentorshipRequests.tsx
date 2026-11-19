"use client";

import { Button, Card, Dialog, TextArea } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Relative paths, like MentoredWorks: packages/app imports src/components without the "@/" alias.
import { goToSignIn } from "../../client/api.ts";
import {
  decideMentorshipRequest, REASON_MAX,
  type Decision, type DecisionOutcome, type MentorshipCall, type MentorshipRequest,
} from "../../client/mentorship-requests.ts";
import { formatDateHr } from "../../lib/i18n/hr.ts";
import { messagesHr } from "../../lib/i18n/messages.hr.ts";

import styles from "./MentoredWorks.module.css";

const t = messagesHr.mentorshipRequests;
const workTypes: Record<string, string> = messagesHr.teacher.assignment.workTypes;

/** The requests as the page read them; anything but a list is "unavailable", never "none". */
export type RequestsRead = { kind: "ready"; requests: readonly MentorshipRequest[] } | { kind: "unavailable" };

/** What the page says after a decision: a success only from the server's answer (B-6). */
export type DecisionNote = { readonly tone: "status" | "alert"; readonly text: string; readonly drop: boolean };

/**
 * The note for an outcome. `drop` takes the request off the list: after a
 * decision the server recorded, and after 409 (already decided or withdrawn).
 * An unknown outcome keeps the request and says that the decision may have
 * been recorded; it never says it was.
 */
export function decisionNote(outcome: DecisionOutcome, decision: Decision): DecisionNote | null {
  switch (outcome.kind) {
    case "odluceno":
      return { tone: "status", text: decision === "approve" ? t.approved : t.declined, drop: true };
    case "vec-odluceno":
      return { tone: "alert", text: t.alreadyDecided, drop: true };
    case "greska":
      return { tone: "alert", text: outcome.code === "not_found" ? t.notFound : t.invalid, drop: false };
    case "nepoznato":
      return { tone: "alert", text: t.unknown, drop: false };
    default:
      return null;
  }
}

/** The reason as sent: trimmed, and none when blank. */
export function reasonToSend(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** What one decision needs besides the request: the transport, and what follows a recorded or ended one. */
export type DecisionDeps = {
  readonly call: MentorshipCall | null;
  /** Reads the page again after a decision the server recorded (or 409). */
  readonly refresh: () => void;
  /** An ended session goes to the AAI@EduHr sign-in. */
  readonly signIn: () => void;
};

/**
 * One decision, start to end: the reason as typed (sent trimmed, none when
 * blank), the server's answer, then a refresh when the request leaves the
 * list. Without a transport (TODO(ugovor)) nothing is sent and the outcome is
 * unknown. Returns the note to show, or null after a sign-in redirect.
 */
export async function submitDecision(
  deps: DecisionDeps, request: MentorshipRequest, decision: Decision, reasonText = "",
): Promise<DecisionNote | null> {
  const reason = decision === "decline" ? reasonToSend(reasonText) : undefined;
  const input = { requestId: request.requestId, decision, ...(reason === undefined ? {} : { reason }) };
  const outcome: DecisionOutcome = deps.call === null ? { kind: "nepoznato" } : await decideMentorshipRequest(deps.call, input);
  if (outcome.kind === "session-expired") {
    deps.signIn();
    return null;
  }
  const note = decisionNote(outcome, decision);
  if (note?.drop) deps.refresh();
  return note;
}

function requestMeta(request: MentorshipRequest): string {
  const type = workTypes[request.workType] ?? "";
  const sent = t.sentOn.replace("{date}", formatDateHr(request.requestedAt));
  return type === "" ? sent : `${type} · ${sent}`;
}

/**
 * TODO(ugovor): teacher.mentorship-request-decision.post comes with
 * @ductura/contracts 3.2.0 (SRV-27, SRV-32) and its handler with SRV-31. Until
 * then there is no transport and nothing is sent; the page reads no requests.
 */
const MENTORSHIP_CALL: MentorshipCall | null = null;

/**
 * WEB-32 (N-16): the card "Zahtjevi za mentorstvo" with "Odobri" and "Odbij".
 * "Odbij" opens the do-h dialog with an optional reason (f-ro, up to 600
 * characters) that the student does not see (P-6). A note follows only the
 * server's answer (B-6); after a recorded decision the page is read again, so
 * an approved work appears in the list of mentored works.
 */
export default function MentorshipRequests({ read, here }: { read: RequestsRead; here: string }) {
  return <MentorshipRequestsView read={read} here={here} call={MENTORSHIP_CALL} />;
}

export function MentorshipRequestsView({ read, here, call }: { read: RequestsRead; here: string; call: MentorshipCall | null }) {
  const router = useRouter();
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState<{ id: string; decision: Decision } | null>(null);
  const [note, setNote] = useState<DecisionNote | null>(null);
  const [declining, setDeclining] = useState<MentorshipRequest | null>(null);
  const [reason, setReason] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  async function decide(request: MentorshipRequest, decision: Decision, text = "") {
    if (busy !== null) return;
    setNote(null);
    setDialogError(null);
    setBusy({ id: request.requestId, decision });
    const next = await submitDecision({ call, refresh: () => router.refresh(), signIn: () => goToSignIn(here) }, request, decision, text);
    setBusy(null);
    if (next === null) return;
    if (next.drop) {
      setGone((now) => new Set(now).add(request.requestId));
      setDeclining(null);
      setNote(next);
    } else if (declining !== null) {
      setDialogError(next.text);
    } else {
      setNote(next);
    }
  }

  function openDecline(request: MentorshipRequest) {
    setDeclining(request);
    setReason("");
    setDialogError(null);
  }

  function closeDecline() {
    if (busy === null) setDeclining(null);
  }

  const noteLine = note === null ? null : note.tone === "alert"
    ? <p role="alert" className={styles.note}>{note.text}</p>
    : <p role="status" className={styles.note}>{note.text}</p>;

  if (read.kind === "unavailable") {
    return (
      <Card title={t.title}>
        <p role="alert">{t.unavailable}</p>
        <p><a href={here}>{t.retry}</a></p>
      </Card>
    );
  }
  const open = read.requests.filter((request) => !gone.has(request.requestId));
  return (
    <Card title={t.title}>
      {noteLine}
      {open.length === 0 ? <p>{t.empty}</p> : (
        <ul className={styles.works}>
          {open.map((request) => {
            const name = request.studentName ?? t.unnamed;
            const mine = busy?.id === request.requestId;
            return (
              <li key={request.requestId} className={styles.work}>
                <span className={styles.name}>{name}</span>
                <span className={styles.title}>{request.title}</span>
                <span className={styles.meta}>{requestMeta(request)}</span>
                <span className={styles.open}>
                  <Button busy={mine && busy?.decision === "approve"} disabled={busy !== null && !mine}
                    aria-label={`${t.approve}: ${name}`} onClick={() => void decide(request, "approve")}>
                    {mine && busy?.decision === "approve" ? t.approving : t.approve}
                  </Button>{" "}
                  <Button tone="quiet" disabled={busy !== null}
                    aria-label={`${t.decline}: ${name}`} onClick={() => openDecline(request)}>
                    {t.decline}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Dialog
        open={declining !== null}
        title={t.dialogTitle}
        onClose={closeDecline}
        dismissible={busy === null}
        error={dialogError ?? undefined}
        actions={
          <>
            <Button tone="quiet" disabled={busy !== null} onClick={closeDecline}>{t.cancel}</Button>
            <Button busy={busy !== null}
              onClick={() => declining && void decide(declining, "decline", reason)}>
              {busy !== null ? t.declining : t.confirmDecline}
            </Button>
          </>
        }
      >
        <p>{declining ? t.dialogLead.replace("{name}", declining.studentName ?? t.unnamed) : ""}</p>
        <TextArea
          label={t.reason}
          hint={t.reasonHint.replace("{max}", String(REASON_MAX))}
          maxLength={REASON_MAX}
          value={reason}
          busy={busy !== null}
          onChange={(event) => setReason(event.target.value)}
        />
      </Dialog>
    </Card>
  );
}
