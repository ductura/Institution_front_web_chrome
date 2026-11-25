"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Card, RouteLoading, Select, Tag, TextArea, TextField } from "@ductura/ui";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { formatDateHr, formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";
import { useHost } from "../../context";
import { hostText } from "../../../text";
import { practiceJournalText as t } from "./messages.hr";
import {
  checkDraft, correctedIds, countText, groupByDate, isSigned, lastEntryDate, placementState, signedThroughOf, signoffsNewestFirst,
  activePlacements, HOUR_STEPS, MAX_TEXT, todayOf, type Draft, type FieldError,
} from "./model";
import { addEntry, readEntries, readPlacements, type AddOutcome, type EntriesRead, type Entry, type Placement, type PlacementsRead } from "./read";

type Api = ReturnType<typeof createApi>;
const defaultCall = (): Api => createApi();

const OUTCOME_TEXT: Readonly<Record<Exclude<AddOutcome["kind"], "saved" | "signedOut">, string>> = {
  notFound: t.notFound, closed: t.closed, conflict: t.conflict, invalid: t.invalid, unknown: t.unknown,
};
const EMPTY_DRAFT = (date: string): Draft => ({ date, hours: "1", text: "" });

/**
 * Student: "Dnevnik prakse" (WEB-V19-DNEVNIK-STUDENT, S-nn). The practices of the student, the entries of one
 * by date, a form for a new entry, a correction as a new entry, and "Potpisano do …" with the mentor's comment.
 * Loading, error, empty and "no active practice" are four different states. A note of success follows only
 * the server's answer (B-6). `call` and `now` are for tests.
 */
export default function PracticeJournalPage({ call = defaultCall, now = () => new Date() }: { call?: () => Api; now?: () => Date }) {
  const { base } = useHost();
  const here = appHref(base, "/zadaci/dnevnik-prakse");
  const today = todayOf(now());
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
        setSelected((id) => (id !== null && result.placements.some((p) => p.placementId === id) ? id
          : (activePlacements(result.placements, today)[0] ?? result.placements[0])?.placementId ?? null));
      }
    });
    return () => { live = false; };
    // `call`, `here` and `today` are stable per visit; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const back = <p><a href={appHref(base, "/zadaci")}><span aria-hidden="true">← </span>{t.back}</a></p>;
  const head = <header><h1>{t.title}</h1><p>{t.lead}</p></header>;

  if (placements === null || placements.kind === "signedOut") {
    return <div className="page">{back}{head}<RouteLoading label={t.loading} /></div>;
  }
  if (placements.kind === "unavailable") {
    return (
      <div className="page">{back}{head}
        <Card level={2} title={t.title}>
          <p role="alert">{t.unavailable}</p>
          <p><Button tone="quiet" onClick={reload}>{t.retry}</Button></p>
        </Card>
      </div>
    );
  }
  if (placements.placements.length === 0) {
    return <div className="page">{back}{head}<Card level={2} title={t.noPlacements.title}><p>{t.noPlacements.body}</p></Card></div>;
  }
  const list = placements.placements;
  const current = list.find((p) => p.placementId === selected) ?? list[0]!;
  const hasActive = activePlacements(list, today).length > 0;
  return (
    <div className="page">
      {back}{head}
      {!hasActive && <p role="status" data-testid="no-active-placement">{t.noActive}</p>}
      <Card level={2} title={t.placementsTitle}>
        <ul>
          {list.map((p) => (
            <li key={p.placementId} data-testid="placement">
              <strong>{p.organisationName}</strong>{" "}
              <Tag tone={placementState(p, today) === "active" ? "accent" : "neutral"}>{t.state[placementState(p, today)]}</Tag>{" "}
              <Tag>{countText(p.entryCount, t.entryCount)}</Tag>{" "}
              <Tag tone={p.signedThrough === null ? "neutral" : "accent"}>
                {p.signedThrough === null ? t.notSigned : t.signedThrough.replace("{date}", formatDateHr(p.signedThrough))}
              </Tag>
              <br />
              <span>{t.period.replace("{from}", formatDateHr(p.startsOn)).replace("{to}", formatDateHr(p.endsOn))}</span>{" "}
              {p.placementId === current.placementId ? <span>{t.currentPlacement}</span> : (
                <Button tone="quiet" aria-label={`${t.openPlacement}: ${p.organisationName}`} onClick={() => setSelected(p.placementId)}>{t.openPlacement}</Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Journal key={current.placementId} placement={current} today={today} call={call} here={here} onChanged={reload} />
    </div>
  );
}

function Journal({ placement, today, call, here, onChanged }: { placement: Placement; today: string; call: () => Api; here: string; onChanged: () => void }) {
  const [read, setRead] = useState<EntriesRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT(lastEntryDate(placement, today)));
  const [correcting, setCorrecting] = useState<Entry | null>(null);
  const [error, setError] = useState<{ field: string; error: FieldError } | null>(null);
  const [note, setNote] = useState<{ tone: "status" | "alert"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const open = placementState(placement, today) === "active" || placementState(placement, today) === "ended";

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

  const fieldError = (field: string) => (error?.field === field ? t.errors[error.error] : undefined);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setNote(null);
    const checked = checkDraft(draft, placement, today);
    if (!checked.ok) { setError({ field: checked.field, error: checked.error }); return; }
    setError(null);
    setBusy(true);
    const outcome = await addEntry(call(), placement.placementId, { ...checked.value, ...(correcting === null ? {} : { correctsEntryId: correcting.entryId }) });
    setBusy(false);
    if (outcome.kind === "signedOut") { goToSignIn(here); return; }
    if (outcome.kind === "saved") {
      setNote({ tone: "status", text: correcting === null ? t.saved : t.savedCorrection });
      setDraft(EMPTY_DRAFT(lastEntryDate(placement, today)));
      setCorrecting(null);
    } else {
      setNote({ tone: "alert", text: OUTCOME_TEXT[outcome.kind] });
    }
    // The server may know something the page did not (a conflict, a lost answer): read again either way.
    setAttempt((n) => n + 1);
    onChanged();
  }

  function startCorrection(entry: Entry) {
    setCorrecting(entry);
    setError(null);
    setNote(null);
    setDraft({ date: entry.date, hours: String(entry.hours).replace(".", ","), text: entry.text });
    formRef.current?.scrollIntoView?.({ block: "center" });
    formRef.current?.querySelector("textarea")?.focus();
  }

  let body;
  if (read === null || read.kind === "signedOut") body = <RouteLoading label={t.loadingEntries} />;
  else if (read.kind === "notFound") body = <Card level={2} title={t.entriesTitle}><p role="alert">{t.placementGone}</p></Card>;
  else if (read.kind === "unavailable") {
    body = (
      <Card level={2} title={t.entriesTitle}>
        <p role="alert">{t.entriesUnavailable}</p>
        <p><Button tone="quiet" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button></p>
      </Card>
    );
  } else {
    const corrected = correctedIds(read.entries);
    const signoffs = signoffsNewestFirst(read.signoffs);
    const through = signedThroughOf(read.signoffs);
    body = (
      <>
        <Card level={2} title={t.entriesTitle}>
          {read.entries.length === 0 ? <p>{t.noEntries}</p> : groupByDate(read.entries).map((day) => (
            <section key={day.date} aria-label={formatDateHr(day.date)}>
              <h3>{formatDateHr(day.date)}</h3>
              <ul>
                {day.entries.map((entry) => (
                  <li key={entry.entryId} data-testid="entry">
                    <strong>{t.hours.replace("{h}", String(entry.hours).replace(".", ","))}</strong>{" "}
                    {isSigned(entry, read.signoffs) && <Tag tone="accent">{t.signedMark}</Tag>}{" "}
                    {corrected.has(entry.entryId) && <Tag tone="warn">{t.corrected}</Tag>}
                    {entry.correctsEntryId !== null && (
                      <><br /><em>{t.correction.replace("{date}", formatDateHr(read.entries.find((e) => e.entryId === entry.correctsEntryId)?.date ?? entry.date))}</em></>
                    )}
                    <p>{entry.text}</p>
                    {open && (
                      <Button tone="quiet" disabled={busy} aria-label={t.correctAria.replace("{date}", formatDateHr(entry.date))} onClick={() => startCorrection(entry)}>{t.correct}</Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {through !== null && <p>{t.signedThrough.replace("{date}", formatDateHr(through))}</p>}
        </Card>
        <Card level={2} title={t.signoffsTitle}>
          {signoffs.length === 0 ? <p>{t.noSignoffs}</p> : (
            <ul>
              {signoffs.map((s) => (
                <li key={s.signoffId} data-testid="signoff">
                  {t.signoffLine
                    .replace("{mentor}", `${s.mentor.givenName} ${s.mentor.familyName}`.trim() || t.mentorUnnamed)
                    .replace("{date}", formatDateHr(s.throughDate)).replace("{n}", String(s.entryCount)).replace("{signedAt}", formatDateTimeHr(s.signedAt))}
                  {s.comment !== null && <><br /><span>{t.signoffComment.replace("{comment}", s.comment)}</span></>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
      {open && (
        <Card level={2} title={correcting === null ? t.formTitle : t.formTitleCorrection.replace("{date}", formatDateHr(correcting.date))}>
          <form ref={formRef} onSubmit={(event) => void send(event)} noValidate>
            {error?.field === "form" && <p role="alert">{t.errors[error.error]}</p>}
            <TextField label={t.fieldDate} type="date" value={draft.date} min={placement.startsOn} max={lastEntryDate(placement, today)}
              error={fieldError("date")} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            <Select label={t.fieldHours} value={draft.hours.replace(",", ".")} options={HOUR_STEPS.map((h) => ({ value: String(h), label: String(h).replace(".", ",") }))}
              onChange={(e) => setDraft({ ...draft, hours: e.target.value })} />
            <TextArea label={t.fieldText} hint={t.fieldTextHint} value={draft.text} maxLength={MAX_TEXT + 200} error={fieldError("text")}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
            <p>
              <Button type="submit" busy={busy}>{busy ? t.saving : t.save}</Button>{" "}
              {correcting !== null && <Button tone="quiet" disabled={busy} onClick={() => { setCorrecting(null); setDraft(EMPTY_DRAFT(lastEntryDate(placement, today))); }}>{t.cancelCorrection}</Button>}
            </p>
          </form>
        </Card>
      )}
      {body}
    </>
  );
}
