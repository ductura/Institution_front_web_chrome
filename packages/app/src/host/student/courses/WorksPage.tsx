"use client";

// WEB-2103 (paritet E-4 "Moji radovi"): a row per assignment with the state line
// ("Predano" without a time, the contract has none), "Rok" only for what is not
// submitted, the same filter as before (search and year, A-10), skeleton, a real
// "Pokušaj ponovno" and the empty state with the enrol link.
import { Button, Select, TextField } from "@ductura/ui";

import { appHref } from "../../../../../../src/components/index.ts";
import { zagrebParts } from "../../../../../../src/components/summary/zagreb-time.ts";
import { messagesHr } from "../../../../../../src/lib/i18n/messages.hr.ts";
import { filterWorks, worksOf, yearsOf, type WorksFilter } from "../../../../../../src/components/student/radovi/works-view.ts";
import page from "../../../../../../src/components/student/StudentWorkspace.module.css";

import { useHost } from "../../context";
import { coursesText as t } from "./messages.hr";
import { effectiveDue, nearTag, ROW_ACTION, rowKind } from "./model";
import { EnrollLink, Frame, State } from "./CoursesPages";
import { readCourses, type CoursesCall } from "./read";
import own from "./courses.module.css";
import { createApi } from "../../../../../../src/client/api.ts";
import { useEffect, useState, useCallback } from "react";
import type { CoursesRead } from "./read";

const w = messagesHr.student.works;
const STATE_TEXT = {
  notice: w.state.notice, not_started: w.state.notStarted, in_progress: w.state.inProgress, submitted: t.submittedNoTime,
} as const;
const whenHr = (iso: string) => {
  const p = zagrebParts(iso);
  return p === null ? iso : `${p.date} ${messagesHr.teacherCourses.at} ${p.time}`;
};
const yearHr = (y: string) => y.replace(/^(\d{4})\/(\d{4})$/, "$1./$2.");

export function MyWorksPage({ filter }: { filter: WorksFilter }) {
  const { base } = useHost();
  const [read, setRead] = useState<CoursesRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    setRead(null);
    void readCourses(createApi() as unknown as CoursesCall, true).then((r) => { if (live) setRead(r); });
    return () => { live = false; };
  }, [attempt]);
  const here = appHref(base, "/zadaci/radovi");
  const ready = read !== null && read.kind === "ready";
  const items = ready ? worksOf(read.courses, read.states) : [];
  const shown = filterWorks(items, filter);
  const years = yearsOf(items);
  if (filter.year !== "" && !years.includes(filter.year)) years.push(filter.year);
  const now = new Date();
  return (
    <Frame title={w.title} lede={ready ? w.lede : null}>
      <State read={read} retry={retry} here="/zadaci/radovi" base={base} />
      {ready && items.length === 0 ? (
        <section className={page.state} aria-labelledby="radovi-prazno">
          <h2 id="radovi-prazno" className={page.stateTitle}>{w.emptyHeading}</h2>
          <p className={page.stateBody}>{w.emptyBody}</p>
          <EnrollLink base={base} />
        </section>
      ) : null}
      {ready && items.length > 0 ? (
        <div>
          <form key={JSON.stringify([filter.q, filter.year])} className={page.filter} method="get" action={here} role="search">
            <TextField label={w.search} type="search" name="q" defaultValue={filter.q} maxLength={200} autoComplete="off" className={page.field} />
            <Select label={w.year} name="godina" defaultValue={filter.year} autoComplete="off" className={page.field}
              placeholder={w.allYears} options={years.map((y) => ({ value: y, label: yearHr(y) }))} />
            <Button type="submit">{w.apply}</Button>
            {filter.q !== "" || filter.year !== "" ? <a className={page.reset} href={here}>{w.reset}</a> : null}
          </form>
          {shown.length === 0 ? <p className={page.noMatch} role="status">{w.noMatch}</p> : (
            <ul className={page.list} aria-label={w.list}>
              {shown.map((item) => {
                const kind = rowKind(item.noticeFirst, item.state);
                const due = effectiveDue(item.dueAt, item.extendedDueAt);
                const near = kind === "submitted" ? null : nearTag(due, now);
                const id = `rad-${item.assignmentId}`;
                const course = item.academicYear === "" ? item.courseName : `${item.courseName} · ${yearHr(item.academicYear)}`;
                const text = kind === "submitted" ? STATE_TEXT.submitted : kind === "notice" ? STATE_TEXT.notice
                  : item.state === null ? null : STATE_TEXT[item.state];
                return (
                  <li key={item.assignmentId}>
                    <article className={page.item} aria-labelledby={id}>
                      <div className={page.meta}>
                        <p className={page.eyebrow}>{course}</p>
                        <h2 id={id} className={page.itemTitle}>{item.title}</h2>
                        <p className={page.facts}>
                          {text === null ? null : <span className={page.stateText} data-tone={kind === "submitted" ? "done" : "idle"}>{text}</span>}
                          {kind === "submitted" ? null : (
                            <span className={page.due}>{t.dueLabel.replace("{time}", whenHr(due))}
                              {near === null ? null : <span className={own.tag}>{near}</span>}</span>
                          )}
                        </p>
                      </div>
                      <a className={page.action} href={appHref(base, `/rad/${encodeURIComponent(item.assignmentId)}`)} aria-describedby={id}>
                        {ROW_ACTION[kind].label}
                      </a>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </Frame>
  );
}
