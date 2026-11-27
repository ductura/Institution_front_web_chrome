"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, Card, RouteLoading, Tag, TextArea, TextField } from "@ductura/ui";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { readMentoredWorks, type MentoredWork, type MentoredWorksCall } from "../../../../../../src/components/teacher/mentored-works-read";
import { formatDateHr, formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";
import { useHost } from "../../context";
import { useTeacherRead } from "../../pages";
import { countText, groupByDate, correctedIds, placementState, signoffsNewestFirst, signedThroughOf, todayOf } from "../../student/practice-journal/model";
import { DeniedState, LoadAlert } from "../../states/States";
import { TeacherPage } from "../shell/TeacherPage";
import { mentorJournalText as t } from "./messages.hr";
import { checkSign, placementRows, studentIndex, suggestedThrough, waitingFor, type SignError } from "./model";
import { OpenPlacementForm } from "./OpenPlacementForm";
import {
  openPlacement, readEntries, readPlacements, signEntries,
  type EntriesRead, type Placement, type PlacementsRead, type SignOutcome,
} from "./read";

type Api = ReturnType<typeof createApi>;
const defaultCall = (): Api => createApi();
const worksCall = (): MentoredWorksCall => createApi();
const HREF = "/nastavnik/mentorstva/dnevnik-prakse";

const SIGN_TEXT: Readonly<Record<Exclude<SignOutcome["kind"], "signed" | "signedOut">, string>> = {
  notFound: t.signNotFound, nothingToSign: t.nothingToSign, invalid: t.signInvalid, unknown: t.signUnknown,
};

/**
 * Mentor: "Dnevnik prakse" (WEB-V19-DNEVNIK-MENTOR). The practices of the mentorships the mentor leads, a
 * form to open one, the student's entries of the chosen practice, "Potpiši do datuma" with an optional
 * comment and the history of signatures. It is entered from "Radovi uz mentora" by a link. The list of
 * mentorships and the list of practices are read on their own: a failed read says so and offers a retry, and
 * is never an empty list. `works`, `call` and `now` are for tests.
 */
export default function MentorJournalPage({ works = worksCall, call = defaultCall, now = () => new Date() }:
  { works?: () => MentoredWorksCall; call?: () => Api; now?: () => Date }) {
  const { base } = useHost();
  const [read, retry] = useTeacherRead<readonly MentoredWork[]>(base, async () => {
    const result = await readMentoredWorks(works());
    return result.kind === "ready" ? { kind: "ready", value: result.works } : result;
  });
  if (read?.kind === "notTeacher") {
    return <DeniedState title={t.deniedTitle} backLabel={t.backToOwn} backHref={appHref(base, "/nastavnik")} />;
  }
  return (
    <>
    <p><a href={appHref(base, "/nastavnik/mentorstva")}><span aria-hidden="true">← </span>{t.backToMentorships}</a></p>
    <TeacherPage title={t.title} lead={t.lead} loading={t.loading} read={read} retry={retry}
      unavailable={t.unavailable} retryLabel={t.retry}
      ready={(list) => (
        <Journals works={list} call={call} now={now} base={base} />
      )} />
    </>
  );
}

function Journals({ works, call, now, base }: { works: readonly MentoredWork[]; call: () => Api; now: () => Date; base: string }) {
  const here = appHref(base, HREF);
  const today = todayOf(now());
  const students = useMemo(() => studentIndex(works), [works]);
  const mentorships = useMemo(() => [...students].map(([mentorshipId, s]) => ({ mentorshipId, name: s.name })), [students]);
  const [placements, setPlacements] = useState<PlacementsRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void readPlacements(call()).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") goToSignIn(here);
      setPlacements(result);
      if (result.kind === "ok") {
        setSelected((id) => (id !== null && result.placements.some((p) => p.placementId === id) ? id : null));
      }
    });
    return () => { live = false; };
    // `call` and `here` are stable per visit; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const openForm = mentorships.length === 0 ? null : (
    <OpenPlacementForm mentorships={mentorships} onChanged={reload}
      open={async (body) => {
        const outcome = await openPlacement(call(), body);
        if (outcome.kind === "signedOut") goToSignIn(here);
        return outcome;
      }} />
  );

  let list;
  if (placements === null || placements.kind === "signedOut") list = <RouteLoading label={t.loading} />;
  else if (placements.kind === "unavailable") {
    list = (
      <Card level={2} title={t.placementsTitle}>
        <LoadAlert body={t.placementsUnavailable} retry={{ label: t.retry, onRetry: reload }} />
      </Card>
    );
  } else if (mentorships.length === 0 && placements.placements.length === 0) {
    list = <Card level={2} title={t.noMentorships.title}><p>{t.noMentorships.body}</p></Card>;
  } else {
    const rows = placementRows(placements.placements, students);
    list = (
      <Card level={2} title={t.placementsTitle}>
        {rows.length === 0 ? <p>{t.noPlacements}</p> : (
          <ul>
            {rows.map(({ placement: p, student }) => (
              <li key={p.placementId} data-testid="placement">
                <strong>{student ?? t.unnamedStudent}</strong>, {p.organisationName}{" "}
                <Tag tone={placementState(p, today) === "active" ? "accent" : "neutral"}>{t.state[placementState(p, today)]}</Tag>{" "}
                <Tag>{countText(p.entryCount, t.entryCount)}</Tag>{" "}
                <Tag tone={p.signedThrough === null ? "neutral" : "accent"}>
                  {p.signedThrough === null ? t.notSigned : t.signedThrough.replace("{date}", formatDateHr(p.signedThrough))}
                </Tag>
                <br />
                <span>{t.period.replace("{from}", formatDateHr(p.startsOn)).replace("{to}", formatDateHr(p.endsOn))}</span>{" "}
                {p.placementId === selected ? <span>{t.current}</span> : (
                  <Button tone="quiet" aria-label={t.openAria.replace("{student}", student ?? t.unnamedStudent).replace("{organisation}", p.organisationName)}
                    onClick={() => setSelected(p.placementId)}>{t.open}</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  const chosen = placements?.kind === "ok" ? placements.placements.find((p) => p.placementId === selected) : undefined;
  return (
    <>
      {list}
      {openForm}
      {chosen !== undefined && <PlacementJournal key={chosen.placementId} placement={chosen} call={call} here={here} onChanged={reload} />}
    </>
  );
}

function PlacementJournal({ placement, call, here, onChanged }: { placement: Placement; call: () => Api; here: string; onChanged: () => void }) {
  const [read, setRead] = useState<EntriesRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [through, setThrough] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<{ field: string; error: SignError } | null>(null);
  const [note, setNote] = useState<{ tone: "status" | "alert"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void readEntries(call(), placement.placementId).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") goToSignIn(here);
      setRead(result);
    });
    return () => { live = false; };
    // `call` and `here` are stable per visit; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, placement.placementId]);

  if (read === null || read.kind === "signedOut") return <RouteLoading label={t.loadingEntries} />;
  if (read.kind === "notFound") return <Card level={2} title={t.entriesTitle}><LoadAlert body={t.placementGone} /></Card>;
  if (read.kind === "unavailable") {
    return (
      <Card level={2} title={t.entriesTitle}>
        <LoadAlert body={t.entriesUnavailable} retry={{ label: t.retry, onRetry: () => setAttempt((n) => n + 1) }} />
      </Card>
    );
  }

  const { entries, signoffs } = read;
  const waiting = waitingFor(entries, signoffs);
  const waitingIds = new Set(waiting.map((e) => e.entryId));
  const corrected = correctedIds(entries);
  const history = signoffsNewestFirst(signoffs);
  const throughValue = through ?? suggestedThrough(entries, signoffs);
  const fieldError = (field: string) => (error?.field === field ? t.signErrors[error.error] : undefined);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setNote(null);
    const checked = checkSign({ throughDate: throughValue, comment }, entries, signoffs);
    if (!checked.ok) { setError({ field: checked.field, error: checked.error }); return; }
    setError(null);
    setBusy(true);
    const outcome = await signEntries(call(), placement.placementId, checked.value);
    setBusy(false);
    if (outcome.kind === "signedOut") { goToSignIn(here); return; }
    if (outcome.kind === "signed") {
      setNote({ tone: "status", text: t.signed.replace("{n}", String(outcome.entryCount)) });
      setThrough(null);
      setComment("");
    } else {
      setNote({ tone: "alert", text: SIGN_TEXT[outcome.kind] });
    }
    // The server may know something the page did not (a new entry, a lost answer): read again either way.
    setAttempt((n) => n + 1);
    onChanged();
  }

  return (
    <>
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      <Card level={2} title={t.entriesTitle}>
        {entries.length === 0 ? <p>{t.noEntries}</p> : (
          <>
            <p>{t.pendingSummary.replace("{n}", String(waiting.length))}</p>
            {groupByDate(entries).map((day) => (
              <section key={day.date} aria-label={formatDateHr(day.date)}>
                <h3>{formatDateHr(day.date)}</h3>
                <ul>
                  {day.entries.map((entry) => (
                    <li key={entry.entryId} data-testid="entry">
                      <strong>{t.hours.replace("{h}", String(entry.hours).replace(".", ","))}</strong>{" "}
                      <Tag tone={waitingIds.has(entry.entryId) ? "neutral" : "accent"}>{waitingIds.has(entry.entryId) ? t.unsignedMark : t.signedMark}</Tag>{" "}
                      {corrected.has(entry.entryId) && <Tag tone="warn">{t.corrected}</Tag>}
                      {entry.correctsEntryId !== null && (
                        <><br /><em>{t.correction.replace("{date}", formatDateHr(entries.find((e) => e.entryId === entry.correctsEntryId)?.date ?? entry.date))}</em></>
                      )}
                      <p>{entry.text}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {signedThroughOf(signoffs) !== null && <p>{t.signedThrough.replace("{date}", formatDateHr(signedThroughOf(signoffs)!))}</p>}
          </>
        )}
      </Card>
      <Card level={2} title={t.signoffTitle}>
        <p>{t.signoffLead}</p>
        <form onSubmit={(event) => void send(event)} noValidate>
          {error?.field === "form" && <p role="alert">{t.signErrors[error.error]}</p>}
          <TextField label={t.fieldThrough} type="date" busy={busy} value={throughValue} error={fieldError("throughDate")}
            onChange={(e) => setThrough(e.target.value)} />
          <TextArea label={t.fieldComment} hint={t.fieldCommentHint} busy={busy} value={comment} error={fieldError("comment")}
            onChange={(e) => setComment(e.target.value)} />
          <p><Button type="submit" busy={busy}>{busy ? t.signing : t.signSubmit}</Button></p>
        </form>
      </Card>
      <Card level={2} title={t.signoffsTitle}>
        {history.length === 0 ? <p>{t.noSignoffs}</p> : (
          <ul>
            {history.map((s) => (
              <li key={s.signoffId} data-testid="signoff">
                {t.signoffLine
                  .replace("{mentor}", `${s.mentor.givenName} ${s.mentor.familyName}`.trim() || t.mentorUnnamed)
                  .replace("{date}", formatDateHr(s.throughDate)).replace("{signedAt}", formatDateTimeHr(s.signedAt))}
                {s.comment !== null && <><br /><span>{t.signoffComment.replace("{comment}", s.comment)}</span></>}
                <br /><span>{t.signoffCount.replace("{n}", String(s.entryCount))}</span>
              </li>
            ))}
          </ul>
        )}
        <p>{t.privateNote}</p>
      </Card>
    </>
  );
}
