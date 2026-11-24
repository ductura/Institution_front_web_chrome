"use client";

import { Button, Select } from "@ductura/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createApi } from "../../../../../../src/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { readTeacherCourses, type TeacherCoursesCall } from "../../../../../../src/components/teacher/teacher-courses-read";
import { ProcessSummaryView } from "../../../../../../src/components/summary/ProcessSummaryView";
import { bySurname, fullName, textRuns, type FastPathRecord, type FastPathStudent } from "../../../../../../src/components/teacher/fast-path";
import { readFastPath } from "../../../../../../src/components/teacher/fast-path/read";
import { fastPathControlsHr as c } from "../../../../../../src/components/teacher/fast-path/messages.hr";
import { liveWorkHref, SUMMARY_ANCHOR } from "../../../../../../src/components/teacher/LiveWorkFrame";
import { messagesHr } from "../../../../../../src/lib/i18n/messages.hr";
import { nextPath } from "../../../bases";
import { useHost } from "../../context";
import { TeacherPage, useTeacherRead } from "../../pages";
import { PageHead } from "../shell/TeacherPage";
import { fastPathHostText as t } from "./messages.hr";
import { assignmentOf, detailLines, fastPathPath, fastPathRead, fastPathTasks, stateText, type FastPathAnswer } from "./model";

const fp = messagesHr.fastPath;

/** N-05 "Brz put" (WEB-2142): the works of the assignment in `?zadatak=`, one after another, read only. */
type Tasks = readonly { value: string; label: string }[];

/** NZ-1: the teacher's assignments for the chooser; null while unread, empty when the read fails or has none. */
function useTasks(): Tasks | null {
  const [tasks, setTasks] = useState<Tasks | null>(null);
  useEffect(() => {
    let live = true;
    void readTeacherCourses(createApi() as unknown as TeacherCoursesCall).catch(() => null).then((read) => {
      if (live) setTasks(read?.kind === "ready" ? fastPathTasks(read.courses, Date.now()) : []);
    });
    return () => {
      live = false;
    };
  }, []);
  return tasks;
}

/**
 * The chooser "Zadatak": choosing only selects, the button "Otvori" opens that assignment's works (as in
 * TaskPicker; WCAG 3.2.2, an arrow key on a closed select must not navigate). The chooser stays mounted
 * across the new read, so the focus stays on it.
 */
function TaskChooser({ tasks, current }: { tasks: Tasks; current: string }) {
  const { base } = useHost();
  const router = useRouter();
  const listed = tasks.some((o) => o.value === current);
  const [chosen, setChosen] = useState(listed ? current : "");
  useEffect(() => {
    setChosen(tasks.some((o) => o.value === current) ? current : "");
  }, [tasks, current]);
  if (tasks.length === 0) return null;
  return (
    <form className="card" onSubmit={(event) => {
      event.preventDefault();
      if (chosen !== "" && chosen !== current) router.push(nextPath(base, fastPathPath(chosen)));
    }}>
      <Select label={t.task} value={chosen} options={[...tasks]} placeholder={listed ? undefined : fp.pickAssignment}
        onChange={(event) => setChosen(event.target.value)} />
      <div className="acts"><Button type="submit" tone="secondary">{t.open}</Button></div>
    </form>
  );
}

export default function FastPathPage({ read = readFastPath }: { read?: (assignmentId: string) => Promise<FastPathAnswer> }) {
  const asked = assignmentOf(useSearchParams().get("zadatak"));
  const tasks = useTasks();
  // NZ-1: without `?zadatak=` the first assignment of the teacher's courses is shown, with the chooser.
  const assignmentId = asked ?? (tasks?.[0]?.value ?? null);
  if (assignmentId === null) {
    return (
      <>
        <PageHead title={t.title} lead={t.lead} />
        <section className="card"><p className="note" role="status">{tasks === null ? t.tasksLoading : fp.pickAssignment}</p></section>
      </>
    );
  }
  return <AssignmentFastPath assignmentId={assignmentId} read={read}
    chooser={tasks === null ? null : <TaskChooser tasks={tasks} current={assignmentId} />} />;
}

/** Not keyed by the assignment: another assignment reads anew, but the chooser above keeps its place and focus. */
function AssignmentFastPath({ assignmentId, read, chooser }: {
  assignmentId: string; read: (id: string) => Promise<FastPathAnswer>; chooser: React.ReactNode;
}) {
  const { base } = useHost();
  const [answer, retry] = useTeacherRead(base, async () => fastPathRead(await read(assignmentId)));
  const shown = useRef(assignmentId);
  useEffect(() => {
    if (shown.current === assignmentId) return;
    shown.current = assignmentId;
    retry();
  }, [assignmentId, retry]);
  return (
    <TeacherPage title={t.title} lead={t.lead} read={answer} retry={retry} unavailable={t.unavailable} retryLabel={t.retry}
      notice={chooser} ready={(students) => <FastPathBody key={assignmentId} students={students} hrefOf={(path) => appHref(base, path)} />} />
  );
}

/** The roster and the chosen work; an assignment without works says so in the prototype's words. */
export function FastPathBody({ students, hrefOf }: { students: readonly FastPathStudent[]; hrefOf: (path: string) => string }) {
  const sorted = bySurname(students);
  const [chosenId, setChosenId] = useState(sorted[0]?.id);
  if (sorted.length === 0) {
    return (
      <section className="card center" aria-labelledby="brz-put-prazno">
        <h2 id="brz-put-prazno">{t.emptyTitle}</h2>
        <p className="note" role="status">{t.emptyText}</p>
      </section>
    );
  }
  // The chosen student stays chosen through a new read while still on the list.
  const index = Math.max(0, sorted.findIndex((s) => s.id === chosenId));
  const current = sorted[index]!;
  const work = liveWorkHref(current.documentId);
  const step = (to: FastPathStudent | undefined, label: string) => (
    <button type="button" className="btn secondary" aria-disabled={to === undefined ? "true" : undefined}
      onClick={() => to && setChosenId(to.id)}>{label}</button>
  );
  return (
    <div className="fp">
      <nav className="card fp-list" aria-label={fp.studentsLabel} style={{ padding: 12 }}>
        <p className="meta">{fp.studentsTitle}</p>
        {sorted.map((s) => (
          <a key={s.id} href="#brz-put" aria-current={s.id === current.id ? "true" : undefined}
            onClick={(event) => { event.preventDefault(); setChosenId(s.id); }}>
            {fullName(s)}<span data-work={s.work}>{stateText(s)}</span>
          </a>
        ))}
        <p className="meta">{fp.orderNote}</p>
      </nav>
      <section className="card" aria-labelledby="brz-put-student">
        <h2 id="brz-put-student">{fullName(current)}</h2>
        {current.record ? <Work student={current} record={current.record} summaryHref={work && hrefOf(`${work}#${SUMMARY_ANCHOR}`)} />
          : <p className="note" role="status">{t.notStarted}</p>}
        <div className="sb-acts">
          {step(sorted[index - 1], t.previous)}
          {step(sorted[index + 1], t.next)}
          {work && <a className="btn" href={hrefOf(work)}>{fp.openWork}</a>}
        </div>
      </section>
    </div>
  );
}

function Work({ student, record, summaryHref }: { student: FastPathStudent; record: FastPathRecord; summaryHref: string | null }) {
  const text = (
    <article className="sheet ed-sheet" data-sheet-theme="light" aria-label={fp.textLabel} style={{ padding: 24 }}>
      {textRuns(record.blocks).map((run, i) => {
        if (run.kind === "heading") return <h3 key={i}>{run.texts[0]}</h3>;
        if (run.kind === "bulletItem") return <ul key={i}>{run.texts.map((s, j) => <li key={j}>{s}</li>)}</ul>;
        if (run.kind === "quote") return <blockquote key={i}>{run.texts.map((s, j) => <p key={j}>{s}</p>)}</blockquote>;
        return <p key={i}>{run.texts[0]}</p>;
      })}
    </article>
  );
  const [tab, setTab] = useState<"text" | "summary">("text");
  return (
    <>
      {detailLines(student, record).map((line) => (
        <div key={line.key} className="sb-kv"><span>{line.label}</span><b data-line={line.key}>{line.value}</b></div>
      ))}
      <div className="tabs" role="tablist" aria-label={fp.viewLabel}>
        {(["text", "summary"] as const).map((id) => (
          <button key={id} type="button" role="tab" id={`fp-tab-${id}`} aria-selected={tab === id} aria-controls={`fp-panel-${id}`}
            onClick={() => setTab(id)}>{fp.views[id]}</button>
        ))}
      </div>
      <div role="tabpanel" id={`fp-panel-${tab}`} aria-labelledby={`fp-tab-${tab}`}>
        {tab === "text" ? text : (
          <div style={{ display: "grid", gap: 12 }}>
            <ProcessSummaryView summary={record.summary} />
            {summaryHref && <a href={summaryHref}>{c.openSummary}</a>}
          </div>
        )}
      </div>
    </>
  );
}
