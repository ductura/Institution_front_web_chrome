"use client";

// WEB-2103 (paritet E-3 "Moji kolegiji" and E-4 "Moji radovi"): the student's
// courses and works in the host, over student.assignments.get and
// student.assignment-work.get through src/client only. States: skeleton
// (aria-busy), error with a real "Pokušaj ponovno" button (reads again),
// expired session (AAI@EduHr only, D-09), empty with the enrol link.
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { appHref } from "../../../../../../src/components/index.ts";
import { createApi, signInHref } from "../../../../../../src/client/api.ts";
import { zagrebParts } from "../../../../../../src/components/summary/zagreb-time.ts";
import { messagesHr } from "../../../../../../src/lib/i18n/messages.hr.ts";
import cards from "../../../../../../src/components/student/MyAssignments.module.css";
import page from "../../../../../../src/components/student/StudentWorkspace.module.css";

import { useHost } from "../../context";
import { coursesText as t } from "./messages.hr";
import { effectiveDue, groupLabels, mentorLabel, nearTag, ROW_ACTION, rowKind, workTypeLabel, type RowKind } from "./model";
import { readCourses, type Assignment, type Course, type CoursesCall, type CoursesRead } from "./read";
import own from "./courses.module.css";

const home = messagesHr.student.home;

const whenHr = (iso: string) => {
  const p = zagrebParts(iso);
  return p === null ? iso : `${p.date} ${messagesHr.teacherCourses.at} ${p.time}`;
};
const yearHr = (y: string) => /^(\d{4})\/(\d{4})$/.test(y) ? y.replace(/^(\d{4})\/(\d{4})$/, "$1./$2.") : y;

/** One read per visit and per "Pokušaj ponovno"; null while it runs. */
function useCoursesRead(withStates: boolean): [CoursesRead | null, () => void] {
  const [read, setRead] = useState<CoursesRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setRead(null);
    void readCourses(createApi() as unknown as CoursesCall, withStates).then((r) => { if (live) setRead(r); });
    return () => { live = false; };
  }, [withStates, attempt]);
  return [read, useCallback(() => setAttempt((n) => n + 1), [])];
}

export function Frame({ title, lede, children }: { title: string; lede: string | null; children: ReactNode }) {
  return (
    <div className={page.page}>
      <header className={page.heading}>
        <h1 className={page.title}>{title}</h1>
        {lede === null ? null : <p className={page.lede}>{lede}</p>}
      </header>
      {children}
    </div>
  );
}

/** The states shared by both pages; null when the read is ready. */
export function State({ read, retry, here, base }: { read: CoursesRead | null; retry: () => void; here: string; base: string }) {
  if (read === null) {
    return (
      <div role="status" aria-busy="true" className={own.skeleton}>
        <span className="sr-only">{t.loading}</span>
        <div className={own.bar} aria-hidden="true" /><div className={own.bar} aria-hidden="true" />
      </div>
    );
  }
  if (read.kind === "signedOut") {
    return (
      <div className={page.state}>
        <p role="status">{t.signedOut}</p>
        <p><a className="btn" href={signInHref(appHref(base, here))}>{t.signIn}</a></p>
      </div>
    );
  }
  if (read.kind === "unavailable") {
    return (
      <section className={page.state} role="alert" aria-labelledby="stanje-greska">
        <h2 id="stanje-greska" className={page.stateTitle}>{home.unavailableHeading}</h2>
        <p className={page.stateBody}>{home.unavailableBody}</p>
        <p><button type="button" className={`btn ${own.retry}`} onClick={retry}>{t.retry}</button></p>
      </section>
    );
  }
  return null;
}

function TaskRow({ a, kind, now, base }: { a: Assignment; kind: RowKind; now: Date; base: string }) {
  const due = effectiveDue(a.dueAt, a.extendedDueAt);
  const near = kind === "submitted" ? null : nearTag(due, now);
  const type = workTypeLabel(a.workType);
  const mentor = mentorLabel(a.mentor);
  const action = ROW_ACTION[kind];
  return (
    <li>
      <a className={cards.assignment} href={appHref(base, `/rad/${encodeURIComponent(a.id)}`)} data-row-kind={kind} data-primary={action.primary} data-id={a.id}>
        <span className={cards.title}>{a.title}</span>
        {type === null && mentor === null ? null : <span className={own.meta}>{[type, mentor].filter(Boolean).join(" · ")}</span>}
        <span className={cards.bottom}>
          <span className={cards.due}>
            {kind === "submitted" ? t.submittedNoTime : t.dueLabel.replace("{time}", whenHr(due))}
            {near === null ? null : <span className={own.tag}>{near}</span>}
            {kind === "notice" ? <span className={own.tag}>{t.noticeFirst}</span> : null}
          </span>
          <span className={cards.action}>{action.label}<span aria-hidden="true" className={cards.arrow}>→</span></span>
        </span>
      </a>
    </li>
  );
}

export function EnrollLink({ base }: { base: string }) {
  return <p><a className={page.secondary} href={appHref(base, "/upis")}>{t.enroll}</a></p>;
}

/** E-3 "Moji kolegiji": a card per course with year, seminar groups and its tasks. */
export function MyCoursesPage() {
  const { base } = useHost();
  const [read, retry] = useCoursesRead(true);
  const now = new Date();
  const shown = read !== null && read.kind === "ready";
  return (
    <Frame title={home.courses} lede={shown ? home.coursesLede : null}>
      <State read={read} retry={retry} here="/zadaci/kolegiji" base={base} />
      {shown && read.courses.length === 0 ? (
        <section className={page.state} aria-labelledby="kolegiji-prazno">
          <h2 id="kolegiji-prazno" className={page.stateTitle}>{t.coursesEmpty}</h2>
          <EnrollLink base={base} />
        </section>
      ) : null}
      {shown && read.courses.length > 0 ? (
        <div className={cards.grid}>
          {read.courses.map((c: Course) => (
            <section key={c.id} className={cards.course} aria-labelledby={`kolegij-${c.id}`}>
              <header className={cards.head}>
                <p className={cards.eyebrow}>{c.academicYear ? `${home.courseLabel} · ${yearHr(c.academicYear)}` : home.courseLabel}</p>
                <h2 id={`kolegij-${c.id}`} className={cards.courseName}>{c.name}</h2>
              </header>
              {groupLabels(c.groups).length === 0 ? null : (
                <ul className={own.chips} aria-label={t.group}>
                  {groupLabels(c.groups).map((g) => <li key={g} className={own.chip}>{g}</li>)}
                </ul>
              )}
              {c.assignments.length === 0 ? <p className={cards.none}>{messagesHr.student.assignments.noAssignments}</p> : (
                <ul className={cards.assignments}>
                  {c.assignments.map((a) => <TaskRow key={a.id} a={a} now={now} base={base} kind={rowKind(a.noticeFirst, read.states?.get(a.id) ?? null)} />)}
                </ul>
              )}
            </section>
          ))}
        </div>
      ) : null}
    </Frame>
  );
}
