"use client";

// WEB-2103 (paritet E-4 "Moji radovi"): a row per assignment with the state line
// ("Predano" without a time, the contract has none), "Rok" only for what is not
// submitted, the same filter as before (search and year, A-10), skeleton, a real
// "Pokušaj ponovno" and the empty state with the enrol link.
import { Button, Select, TextField } from "@ductura/ui";

import { appHref } from "../../../../../../src/components/index.ts";
import { messagesHr } from "../../../../../../src/lib/i18n/messages.hr.ts";
import { filterWorks, worksOf, yearsOf, type WorksFilter } from "../../../../../../src/components/student/radovi/works-view.ts";

import { useHost } from "../../context";
import { coursesText as t } from "./messages.hr";
import { effectiveDue, rowKind } from "./model";
import { EnrollLink, Frame, State, TaskItem, whenHr, yearLabel } from "./CoursesPages";
import { readCourses, type CoursesCall } from "./read";
import own from "./courses.module.css";
import { createApi } from "../../../../../../src/client/api.ts";
import { useEffect, useState, useCallback } from "react";
import type { CoursesRead } from "./read";

const w = messagesHr.student.works;
const STATE_TEXT = {
  notice: w.state.notice, not_started: w.state.notStarted, in_progress: w.state.inProgress, submitted: t.submittedNoTime,
} as const;

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
    <Frame title={w.title} lede={w.lede}>
      <State read={read} retry={retry} here="/zadaci/radovi" base={base} />
      {ready && items.length === 0 ? (
        <section className={`${own.card} ${own.center}`} aria-labelledby="radovi-prazno">
          <h2 id="radovi-prazno">{w.emptyHeading}</h2>
          <p className={own.note}>{w.emptyBody}</p>
          <EnrollLink base={base} />
        </section>
      ) : null}
      {ready && items.length > 0 ? (
        <>
          <form key={JSON.stringify([filter.q, filter.year])} className={own.filter} method="get" action={here} role="search">
            <TextField label={w.search} type="search" name="q" defaultValue={filter.q} maxLength={200} autoComplete="off" />
            <Select label={w.year} name="godina" defaultValue={filter.year} autoComplete="off"
              placeholder={w.allYears} options={years.map((y) => ({ value: y, label: yearLabel(y) }))} />
            <Button type="submit">{w.apply}</Button>
            {filter.q !== "" || filter.year !== "" ? <a className={own.reset} href={here}>{w.reset}</a> : null}
          </form>
          {shown.length === 0 ? <p className={own.noMatch} role="status">{w.noMatch}</p> : (
            <ul className={own.list} aria-label={w.list}>
              {shown.map((item) => {
                const kind = rowKind(item.noticeFirst, item.state);
                const due = effectiveDue(item.dueAt, item.extendedDueAt);
                const text = kind === "submitted" ? STATE_TEXT.submitted : kind === "notice" ? STATE_TEXT.notice
                  : item.state === null ? null : STATE_TEXT[item.state];
                const course = item.academicYear === "" ? item.courseName : `${item.courseName} · ${yearLabel(item.academicYear)}`;
                const a = { id: item.assignmentId, title: item.title, dueAt: item.dueAt, extendedDueAt: item.extendedDueAt, noticeFirst: item.noticeFirst };
                const line = (
                  <>
                    {text === null ? null : <span>{text}</span>}
                    {kind === "submitted" ? null : <span>{`Rok ${whenHr(due)}`}</span>}
                  </>
                );
                return <TaskItem key={item.assignmentId} a={a} course={course} kind={kind} now={now} line={line} />;
              })}
            </ul>
          )}
        </>
      ) : null}
    </Frame>
  );
}
