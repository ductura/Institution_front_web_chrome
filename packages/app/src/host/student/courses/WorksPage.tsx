"use client";

// WEB-2103 (paritet E-4 "Moji radovi"): a row per assignment with the state line
// ("Predano" without a time, the contract has none), "Rok" only for what is not
// submitted, the same filter as before (search and year, A-10), skeleton, a real
// "Pokušaj ponovno" and the empty state with the enrol link.
import { Button, Select, TextField } from "@ductura/ui";

import { appHref } from "../../../../../../src/components/index.ts";
import { studentHostHr as messagesHr } from "../i18n/messages.hr.ts";
import { filterWorks, worksOf, yearsOf, type WorksFilter } from "../read/works-view.ts";

import { useHost } from "../../context";
import { coursesText as t } from "./messages.hr";
import { effectiveDue, matchesState, rowKind, STATE_FILTERS, stateFilterOf, submittedLine, type StateFilter } from "./model";
import { EnrollLink, Frame, State, TaskItem, useExtensions, whenHr, yearLabel } from "./CoursesPages";
import { readCourses, type CoursesCall } from "./read";
import own from "./courses.module.css";
import { createApi } from "../../../../../../src/client/api.ts";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import type { CoursesRead } from "./read";

const w = messagesHr.student.works;
const STATE_TEXT = {
  notice: w.state.notice, not_started: w.state.notStarted, in_progress: w.state.inProgress,
} as const;

export function MyWorksPage({ filter }: { filter: WorksFilter }) {
  const { base } = useHost();
  const [read, setRead] = useState<CoursesRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // NF-1 P-5: `?stanje=` is read here (the route passes q and godina); a value outside the closed set is "sve".
  const stateFilter: StateFilter = stateFilterOf(useSearchParams().get("stanje"));
  useEffect(() => {
    let live = true;
    setRead(null);
    void readCourses(createApi() as unknown as CoursesCall, true).then((r) => { if (live) setRead(r); });
    return () => { live = false; };
  }, [attempt]);
  const here = appHref(base, "/zadaci/radovi");
  const ready = read !== null && read.kind === "ready";
  const items = ready ? worksOf(read.courses, read.states) : [];
  const extensions = useExtensions(read);
  const kindOf = (item: (typeof items)[number]) => rowKind(item.noticeFirst, item.state);
  const narrowed = filterWorks(items, filter);
  const shown = narrowed.filter((item) => matchesState(kindOf(item), stateFilter));
  const filtered = filter.q !== "" || filter.year !== "" || stateFilter !== "sve";
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
          <form key={JSON.stringify([filter.q, filter.year, stateFilter])} className={own.filter} method="get" action={here} role="search">
            <TextField label={w.search} type="search" name="q" defaultValue={filter.q} maxLength={200} autoComplete="off" />
            <Select label={w.year} name="godina" defaultValue={filter.year} autoComplete="off"
              placeholder={w.allYears} options={years.map((y) => ({ value: y, label: yearLabel(y) }))} />
            <Select label={t.filterState} name="stanje" defaultValue={stateFilter} autoComplete="off"
              options={STATE_FILTERS.map((f) => ({ value: f, label: t.filterStates[f] }))} />
            <Button type="submit">{w.apply}</Button>
            {filtered ? <a className={own.reset} href={here}>{w.reset}</a> : null}
          </form>
          {shown.length === 0 ? <p className={own.noMatch} role="status">{w.noMatch}</p> : (
            <ul className={own.list} aria-label={w.list}>
              {shown.map((item) => {
                const kind = kindOf(item);
                const submitted = read.kind === "ready" ? read.submitted?.get(item.assignmentId) ?? null : null;
                const due = effectiveDue(item.dueAt, item.extendedDueAt);
                const text = kind === "submitted" ? submittedLine(submitted, whenHr) : kind === "notice" ? STATE_TEXT.notice
                  : item.state === null || item.state === "submitted" ? null : STATE_TEXT[item.state];
                const course = item.academicYear === "" ? item.courseName : `${item.courseName} · ${yearLabel(item.academicYear)}`;
                const a = { id: item.assignmentId, title: item.title, dueAt: item.dueAt, extendedDueAt: item.extendedDueAt, noticeFirst: item.noticeFirst };
                const line = (
                  <>
                    {text === null ? null : <span>{text}</span>}
                    {kind === "submitted" ? null : <span>{`Rok ${whenHr(due)}`}</span>}
                  </>
                );
                return <TaskItem key={item.assignmentId} a={a} course={course} kind={kind} now={now} line={line}
                  extension={extensions.get(item.assignmentId) ?? null} />;
              })}
            </ul>
          )}
        </>
      ) : null}
    </Frame>
  );
}
