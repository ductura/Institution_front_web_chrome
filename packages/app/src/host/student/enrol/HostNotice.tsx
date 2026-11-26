"use client";

// E-6 for the app host: the notice of the shared screen with what the prototype
// adds (who set the rule, the faculty rule, three columns) and an editor link
// that goes to /rad/<assignmentId>. The acknowledgment is the shared one.
import { useEffect, useReducer, useRef, useSyncExternalStore, type FormEvent } from "react";

import { AI_PURPOSES } from "../../../../../../src/components/teacher/assignment-create.ts";
import type { StudentNoticeRead } from "../../../../../../src/client/student-notice.ts";
import { acknowledgeNotice, initialNotice, noticeStep, type NoticeEvent, type NoticeState } from "../../../../../../src/components/student/notice-gate.ts";
import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr.ts";
import { wordRangeHr } from "../../../../../../src/lib/i18n/length-line.ts";
import { studentHostHr as t } from "../i18n/messages.hr.ts";

import { noticeText } from "./messages.hr";

import { NoticeMeta } from "../notice/NoticeMeta";
import styles from "../notice/Notice.module.css";
import { assistantState } from "../notice/summary";
import type { NoticeWindow } from "../notice/window";
import own from "./HostNotice.module.css";

/** The notice as student.notice reads it (the shape of src/client, no copy). */
type NoticeView = Extract<StudentNoticeRead, { kind: "available" }>["view"];

const s = t.student;
const tools = t.teacher.tools;
const workTypes: Record<string, string> = t.teacher.assignment.workTypes;
const never = () => () => {};

function reduce(state: NoticeState, event: NoticeEvent): NoticeState {
  return noticeStep(state, event).state;
}

function Marks({ items, mark }: { items: string[]; mark: "yes" | "no" }) {
  return (
    <ul className={styles.marks}>
      {items.map((text) => (
        <li key={text}><span aria-hidden="true" className={mark === "yes" ? styles.yes : styles.no}>{mark === "yes" ? "✓" : "×"}</span>{text}</li>
      ))}
    </ul>
  );
}

function ToolsCard({ view }: { view: NoticeView }) {
  const allowed = AI_PURPOSES.filter((p) => view.aiPurposes.includes(p));
  const banned = [...AI_PURPOSES.filter((p) => !allowed.includes(p)).map((p) => tools.purposes[p]), ...Object.values(tools.alwaysBanned)];
  const always = Object.values(tools.alwaysBanned);
  return (
    <section className={styles.card} aria-labelledby="alati">
      <p className={styles.brief}>{view.instructions}</p>
      <div className={styles.rule}>
        <h2 id="alati">{s.toolsHeading}</h2>
        <p className={styles.source}>{noticeText.ruleBy}</p>
        {allowed.length ? (
          <>
            <p className={styles.listHead}>{tools.allowed}</p>
            <Marks mark="yes" items={allowed.map((p) => tools.purposes[p])} />
            {Object.values(tools.conditions).map((text) => <p key={text}>{text}</p>)}
          </>
        ) : (
          <p>{s.noTools}</p>
        )}
        <p className={styles.listHead}>{tools.banned}</p>
        <Marks mark="no" items={banned} />
        <details className={own.faculty}>
          <summary>{noticeText.facultyRule}</summary>
          <h3>{noticeText.facultyAllowed}</h3>
          <Marks mark="yes" items={AI_PURPOSES.map((p) => tools.purposes[p])} />
          <p>{tools.conditions.own}</p>
          <h3>{noticeText.facultyBanned}</h3>
          <Marks mark="no" items={always} />
        </details>
        <p className={styles.source}>{tools.source}</p>
      </div>
    </section>
  );
}

function RecordCard({ extended, assistant }: { extended: boolean; assistant: boolean }) {
  return (
    <section className={styles.card} aria-labelledby="biljezi">
      <div className={own.cols}>
        <section>
          <h2 id="biljezi">{s.recordedHeading}</h2>
          <ul>
            {Object.values(s.recorded).map((text) => <li key={text}>{text}</li>)}
            {assistant ? <li>{s.recordedAssistant}</li> : null}
          </ul>
        </section>
        <section>
          <h2>{s.notRecordedHeading}</h2>
          <ul>{Object.values(s.notRecorded).map((text) => <li key={text}>{text}</li>)}</ul>
        </section>
        <section>
          <h2>{s.teacherHeading}</h2>
          <ul>
            {Object.values(s.teacher).map((text) => <li key={text}>{text}</li>)}
            {extended ? <li>{s.teacherExtended}</li> : null}
          </ul>
        </section>
      </div>
      <div className={styles.rule}>
        <p>{s.retention}</p>
        <p>{s.note}</p>
      </div>
    </section>
  );
}

type HostNoticeProps = {
  view: NoticeView;
  timing: NoticeWindow;
  editorHref: string;
  /** Where a 403 leads back to (E-6 `bezprava`). */
  backHref: string;
  /** Reads the notice again (E-6 `promijenjeno`, R-21). */
  onReload: () => void;
  /** Goes to the work after a fresh confirmation (R-19, E-7); the link is the way for a returning student. */
  onOpenWork: () => void;
};

export default function HostNotice({ view, timing, editorHref, backHref, onReload, onOpenWork }: HostNoticeProps) {
  const [state, dispatch] = useReducer(reduce, view.acknowledgedAt, initialNotice);
  const sending = useRef(false);
  const fresh = useRef(false);
  const inBrowser = useSyncExternalStore(never, () => true, () => false);
  const time = (iso: string) => (inBrowser ? formatDateTimeHr(iso) : "…");

  const confirmedNow = state.phase === "acknowledged" && fresh.current;
  useEffect(() => {
    if (confirmedNow) onOpenWork();
  }, [confirmedNow, onOpenWork]);

  async function confirm(event: FormEvent) {
    event.preventDefault();
    // aria-disabled keeps the button in the tab order, so the guard is here and not in `disabled`.
    if (sending.current || !noticeStep(state, { type: "confirm" }).send) return;
    sending.current = true;
    dispatch({ type: "confirm" });
    const result = await acknowledgeNotice(view);
    sending.current = false;
    if (result.kind === "acknowledged") fresh.current = true;
    dispatch({ type: "settled", result });
  }

  const kindLine = [workTypes[view.workType], wordRangeHr({ min: view.wordMin, max: view.wordMax })].filter(Boolean).join(" · ");
  const lead = (
    <section className={own.lead} aria-label={view.title}>
      <h2>{view.title}</h2>
      <NoticeMeta kind={kindLine} due={s.dueAt.replace("{time}", time(view.dueAt))} />
    </section>
  );

  // E-6 `nijeotvoren`: only the card; the notice and the confirmation come when the assignment opens.
  if (timing === "notOpen") {
    return (
      <article className={`${styles.notice} ${own.narrow}`} aria-labelledby="zadatak">
        <header className={own.hero}>
          <p className={own.eyebrow}>{noticeText.eyebrow}</p>
          <h1 id="zadatak">{noticeText.heroBefore} <em>{noticeText.heroAccent}</em></h1>
        </header>
        {lead}
        <p className={styles.window} role="status">{s.notOpen.replace("{time}", time(view.opensAt))}</p>
      </article>
    );
  }

  const note = timing === "pastDue" ? s.pastDue.replace("{time}", time(view.dueAt)) : null;
  const body = (
    <>
      <ToolsCard view={view} />
      <RecordCard extended={view.evidenceProfile === "extended"} assistant={assistantState(view) !== "unavailable"} />
    </>
  );

  // E-6 `potvrdeno`: "Pročitana obavijest", the card with the title and the confirmation, the full notice behind a details.
  if (state.phase === "acknowledged") {
    return (
      <article className={`${styles.notice} ${own.narrow}`} aria-labelledby="zadatak">
        <header className={own.hero}>
          <p className={own.eyebrow}>{s.confirmedEyebrow}</p>
          <h1 id="zadatak">{s.confirmedHeadingBefore} <em>{s.confirmedHeadingAccent}</em></h1>
        </header>
        <section className={styles.card} aria-label={view.title}>
          <h2>{view.title}</h2>
          <div className={styles.done}>
            <p role="status">{s.confirmed.replace("{time}", time(state.at))}</p>
            <p><a className="btn" href={editorHref}>{s.openEditor}</a></p>
          </div>
        </section>
        {note ? <p className={styles.window} role="status">{note}</p> : null}
        <details className={own.faculty}>
          <summary>{s.showNotice}</summary>
          {body}
        </details>
      </article>
    );
  }

  const error = state.phase === "reading" ? state.error : undefined;
  const ready = state.phase === "reading" && state.checked;
  return (
    <article className={`${styles.notice} ${own.narrow}`} aria-labelledby="zadatak">
      <header className={own.hero}>
        <p className={own.eyebrow}>{noticeText.eyebrow}</p>
        <h1 id="zadatak">{noticeText.heroBefore} <em>{noticeText.heroAccent}</em></h1>
      </header>
      {lead}
      {note ? <p className={styles.window} role="status">{note}</p> : null}
      {error === "stale" ? <p className={styles.window} role="status">{s.staleTag.replace("{version}", String(view.versionNo))}</p> : null}
      {body}
      <form className={styles.ack} onSubmit={confirm}>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={ready}
            disabled={state.phase === "sending"}
            onChange={() => dispatch({ type: "toggle" })}
          />
          {s.checkbox}
        </label>
        <button className="btn" type="submit" aria-disabled={!ready}>
          {state.phase === "sending" ? s.confirming : s.confirm}
        </button>
        <p className={styles.hint}>{s.notConsent}</p>
        {error ? <p className={styles.error} role="alert">{s.errors[error]}</p> : null}
        {error === "stale" ? <button className="btn" type="button" onClick={onReload}>{s.reload}</button> : null}
        {error === "forbidden" ? <p><a href={backHref}>{s.backFromForbidden}</a></p> : null}
      </form>
    </article>
  );
}
