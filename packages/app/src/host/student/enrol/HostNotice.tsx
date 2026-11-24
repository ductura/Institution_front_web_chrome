"use client";

// E-6 for the app host: the notice of the shared screen with what the prototype
// adds (who set the rule, the faculty rule, three columns) and an editor link
// that goes to /rad/<assignmentId>. The acknowledgment is the shared one.
import { useReducer, useRef, useSyncExternalStore, type FormEvent } from "react";

import { AI_PURPOSES } from "../../../../../../src/components/teacher/assignment-create.ts";
import type { NoticeView } from "../../../../../../src/components/student/assignment-notice-read.ts";
import { NoticeMeta } from "../../../../../../src/components/student/AssignmentNotice.tsx";
import { acknowledgeNotice, initialNotice, noticeStep, type NoticeEvent, type NoticeState } from "../../../../../../src/components/student/notice-gate.ts";
import type { NoticeWindow } from "../../../../../../src/components/student/notice-window.ts";
import styles from "../../../../../../src/components/student/AssignmentNotice.module.css";
import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr.ts";
import { wordRangeHr } from "../../../../../../src/lib/i18n/length-line.ts";
import { studentHostHr as t } from "../i18n/messages.hr.ts";

import { noticeText } from "./messages.hr";
import { editorPath } from "./model";

import own from "./HostNotice.module.css";

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

function RecordCard({ extended }: { extended: boolean }) {
  return (
    <section className={styles.card} aria-labelledby="biljezi">
      <div className={own.cols}>
        <section>
          <h2 id="biljezi">{s.recordedHeading}</h2>
          <ul>{Object.values(s.recorded).map((text) => <li key={text}>{text}</li>)}</ul>
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

export default function HostNotice({ view, timing, editorHref }: { view: NoticeView; timing: NoticeWindow; editorHref: string }) {
  const [state, dispatch] = useReducer(reduce, view.acknowledgedAt, initialNotice);
  const sending = useRef(false);
  const inBrowser = useSyncExternalStore(never, () => true, () => false);
  const time = (iso: string) => (inBrowser ? formatDateTimeHr(iso) : "…");

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (sending.current || !noticeStep(state, { type: "confirm" }).send) return;
    sending.current = true;
    dispatch({ type: "confirm" });
    const result = await acknowledgeNotice(view);
    sending.current = false;
    dispatch({ type: "settled", result });
  }

  const returning = view.acknowledgedAt !== null;
  const done = state.phase === "acknowledged" ? (
    <div className={styles.done}>
      <p role="status">{s.confirmed.replace("{time}", time(state.at))}</p>
      {timing !== "notOpen" ? <p><a className="btn" href={editorHref}>{s.openEditor}</a></p> : null}
    </div>
  ) : null;
  const note = timing === "notOpen" ? s.notOpen.replace("{time}", time(view.opensAt))
    : timing === "pastDue" ? s.pastDue.replace("{time}", time(view.dueAt)) : null;
  const kindLine = [workTypes[view.workType], wordRangeHr({ min: view.wordMin, max: view.wordMax })].filter(Boolean).join(" · ");

  return (
    <article className={`${styles.notice} ${own.narrow}`} aria-labelledby="zadatak">
      <header className={own.hero}>
        <p className={own.eyebrow}>{noticeText.eyebrow}</p>
        <h1 id="zadatak">{noticeText.heroBefore} <em>{noticeText.heroAccent}</em></h1>
      </header>
      <section className={own.lead} aria-label={view.title}>
        <h2>{view.title}</h2>
        <NoticeMeta kind={kindLine} due={s.dueAt.replace("{time}", time(view.dueAt))} />
      </section>
      {note ? <p className={styles.window} role="status">{note}</p> : null}
      {returning ? done : null}
      <ToolsCard view={view} />
      <RecordCard extended={view.evidenceProfile === "extended"} />
      {returning ? null : done}
      {state.phase === "acknowledged" || timing === "notOpen" ? null : (
        <form className={styles.ack} onSubmit={confirm}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={state.phase === "reading" && state.checked}
              disabled={state.phase === "sending"}
              onChange={() => dispatch({ type: "toggle" })}
            />
            {s.checkbox}
          </label>
          <button className="btn" type="submit" disabled={!(state.phase === "reading" && state.checked)}>
            {state.phase === "sending" ? s.confirming : s.confirm}
          </button>
          <p className={styles.hint}>{s.notConsent}</p>
          {state.phase === "reading" && state.error ? <p className={styles.error} role="alert">{s.errors[state.error]}</p> : null}
        </form>
      )}
    </article>
  );
}
