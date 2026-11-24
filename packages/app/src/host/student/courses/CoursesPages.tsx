"use client";

// WEB-2103 (paritet E-3 "Moji kolegiji" and E-4 "Moji radovi"): the student's
// courses and works in the host, over student.assignments.get and
// student.assignment-work.get through src/client only. States: skeleton
// (aria-busy), error with a real "Pokušaj ponovno" button (reads again),
// expired session (AAI@EduHr only, D-09), empty with the enrol link.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Button, PracticeBadge, Tag } from "@ductura/ui";

import { appHref } from "../../../../../../src/components/index.ts";
import { createApi, goToSignIn } from "../../../../../../src/client/api.ts";
import { messagesHr } from "../../../../../../src/lib/i18n/messages.hr.ts";

import { nextPath, type Base } from "../../../bases";
import { useHost } from "../../context";
import { protoDateTime } from "../home/format";
import { coursesText as t } from "./messages.hr";
import { effectiveDue, extensionText, groupLabels, nearTag, practiceOf, ROW_ACTION, rowKind, submittedLine, type ExtensionNote, type RowKind, type Submitted } from "./model";
import { readCourses, readExtensions, serverHistory, type Assignment, type Course, type CoursesCall, type CoursesRead } from "./read";
import own from "./courses.module.css";

const home = messagesHr.student.home;

export const whenHr = protoDateTime;
const yearHr = (y: string) => /^(\d{4})\/(\d{4})$/.test(y) ? y.replace(/^(\d{4})\/(\d{4})$/, "$1./$2.") : y;
export const yearLabel = yearHr;

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

/** NF-1 P-7: the history of each extended deadline of a ready read; empty until (and unless) it answers. */
export function useExtensions(read: CoursesRead | null): ReadonlyMap<string, ExtensionNote> {
  const [notes, setNotes] = useState<ReadonlyMap<string, ExtensionNote>>(new Map());
  useEffect(() => {
    if (read === null || read.kind !== "ready") { setNotes(new Map()); return; }
    let live = true;
    void readExtensions(serverHistory, read.courses).then((n) => { if (live) setNotes(n); });
    return () => { live = false; };
  }, [read]);
  return notes;
}

export function Frame({ title, lede, children }: { title: string; lede: string | null; children: ReactNode }) {
  return (
    <div className={own.wrap}>
      <div className={own.head}>
        <h1>{title}</h1>
        {lede === null ? null : <p className={own.lede}>{lede}</p>}
      </div>
      {children}
    </div>
  );
}

/** The states shared by both pages; null when the read is ready. */
export function State({ read, retry, here, base }: { read: CoursesRead | null; retry: () => void; here: string; base: string }) {
  if (read === null) {
    return (
      <div className={own.course} aria-busy="true" role="status">
        <span className={own.hidden}>{t.loading}</span>
        <div className={own.skel} data-w="40" />
        <div className={own.item}><div className={own.skel} data-w="80" /><div className={own.skel} data-w="60" /></div>
        <div className={own.item}><div className={own.skel} data-w="80" /><div className={own.skel} data-w="40" /></div>
      </div>
    );
  }
  if (read.kind === "signedOut") {
    return (
      <div className={`${own.card} ${own.center}`}>
        <p className={own.note} role="status">{t.signedOut}</p>
        <Button onClick={() => goToSignIn(appHref(base, here))}>{t.signIn}</Button>
      </div>
    );
  }
  if (read.kind === "unavailable") {
    return (
      <section className={own.card} role="alert" aria-labelledby="stanje-greska">
        <h2 id="stanje-greska">{home.unavailableHeading}</h2>
        <p className={own.note}>{home.unavailableBody}</p>
        <Button className={own.start} onClick={retry}>{t.retry}</Button>
      </section>
    );
  }
  return null;
}

/**
 * One task row, as the prototype's `task()` draws it: the course (if asked), the title, the date line, the button.
 * One primary button per row (P-13); its name carries the title and its description is the date line, so a screen
 * reader hears the state and the deadline with the button (E-2h). NF-1 P-6/P-7: the submission time where the
 * server gave one, and the history of an extended deadline where the history read answered.
 */
export function TaskItem({ a, course, kind, now, line, extension, submitted }: {
  a: Assignment; course: string | null; kind: RowKind; now: Date; line?: ReactNode;
  extension?: ExtensionNote | null; submitted?: Submitted | null;
}) {
  const { base } = useHost();
  const due = effectiveDue(a.dueAt, a.extendedDueAt);
  const near = kind === "submitted" ? null : nearTag(due, now);
  const action = ROW_ACTION[kind];
  const route = kind === "submitted" ? `/rad/${encodeURIComponent(a.id)}/predaja/potvrda` : kind === "notice" ? `/zadatak/${encodeURIComponent(a.id)}` : `/rad/${encodeURIComponent(a.id)}`;
  const extended = typeof a.extendedDueAt === "string" && a.extendedDueAt !== "" && kind !== "submitted";
  const whenId = `kad-${a.id}`;
  const extId = `produljenje-${a.id}`;
  return (
    <li className={own.item} data-row-kind={kind} data-id={a.id}>
      <span>
        {course === null ? null : <span className={own.eyebrow}>{course}</span>}
        <span className={own.title}>{a.title}</span>
        <span className={own.when} id={whenId}>
          {line ?? (kind === "submitted" ? <span>{submittedLine(submitted, whenHr)}</span> : <span>{t.dueLabel.replace("{time}", whenHr(due))}</span>)}
          {line === undefined && near !== null ? <Tag tone="warn">{near}</Tag> : null}
          {line === undefined && kind === "notice" ? <Tag tone="open">{t.noticeFirst}</Tag> : null}
          {extended ? <Tag tone="open">{t.extended}</Tag> : null}
          <PracticeBadge practice={practiceOf(a)} />
        </span>
        {extended && extension ? <span className={own.meta} id={extId}>{extensionText(extension, whenHr)}</span> : null}
      </span>
      <a className={own.open} data-tone={action.primary ? "primary" : "secondary"}
        aria-label={t.openNamed.replace("{action}", action.label).replace("{title}", a.title)}
        aria-describedby={extended && extension ? `${whenId} ${extId}` : whenId}
        href={appHref(base, route)}>{action.label}</a>
    </li>
  );
}

export function EnrollLink({ base }: { base: Base }) {
  const router = useRouter();
  return <Button onClick={() => router.push(nextPath(base, "/upis"))}>{t.enroll}</Button>;
}

/** E-3 "Moji kolegiji": a card per course with year, seminar groups and its tasks. */
export function MyCoursesPage() {
  const { base } = useHost();
  const [read, retry] = useCoursesRead(true);
  const extensions = useExtensions(read);
  const now = new Date();
  const shown = read !== null && read.kind === "ready";
  return (
    <Frame title={home.courses} lede={home.coursesLede}>
      <State read={read} retry={retry} here="/zadaci/kolegiji" base={base} />
      {shown && read.courses.length === 0 ? (
        <section className={`${own.card} ${own.center}`} aria-labelledby="kolegiji-prazno">
          <p id="kolegiji-prazno" className={own.note}>{t.coursesEmpty}</p>
          <EnrollLink base={base} />
        </section>
      ) : null}
      {shown ? read.courses.map((c: Course) => (
        <section key={c.id} className={own.course} aria-labelledby={`kolegij-${c.id}`}>
          <span className={own.eyebrow}>{c.academicYear ? `${home.courseLabel} · ${yearHr(c.academicYear)}` : home.courseLabel}</span>
          <h2 id={`kolegij-${c.id}`}>{c.name}</h2>
          {groupLabels(c.groups).length === 0 ? null : (
            <ul className={own.tags} aria-label={t.group}>
              {groupLabels(c.groups).map((g) => <li key={g}><Tag>{g}</Tag></li>)}
            </ul>
          )}
          {c.assignments.length === 0 ? <p className={own.note}>{messagesHr.student.assignments.noAssignments}</p> : (
            <ul className={own.list}>
              {c.assignments.map((a) => <TaskItem key={a.id} a={a} course={null} now={now} kind={rowKind(a.noticeFirst, read.states?.get(a.id) ?? null)}
                extension={extensions.get(a.id) ?? null} submitted={read.submitted?.get(a.id) ?? null} />)}
            </ul>
          )}
        </section>
      )) : null}
    </Frame>
  );
}
