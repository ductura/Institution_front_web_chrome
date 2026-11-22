"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { appHref } from "../../../../../../src/components/shell/nav";
import { ProcessSummaryView } from "../../../../../../src/components/summary/ProcessSummaryView";
import { bySurname, fullName, textRuns, type FastPathRecord, type FastPathStudent } from "../../../../../../src/components/teacher/fast-path";
import { readFastPath } from "../../../../../../src/components/teacher/fast-path/read";
import { fastPathControlsHr as c } from "../../../../../../src/components/teacher/fast-path/messages.hr";
import { liveWorkHref, SUMMARY_ANCHOR } from "../../../../../../src/components/teacher/LiveWorkFrame";
import { messagesHr } from "../../../../../../src/lib/i18n/messages.hr";
import { useHost } from "../../context";
import { TeacherPage, useTeacherRead } from "../../pages";
import { PageHead } from "../shell/TeacherPage";
import { fastPathHostText as t } from "./messages.hr";
import { assignmentOf, detailLines, fastPathRead, stateText, type FastPathAnswer } from "./model";

const fp = messagesHr.fastPath;

/** N-05 "Brz put" (WEB-2142): the works of the assignment in `?zadatak=`, one after another, read only. */
export default function FastPathPage({ read = readFastPath }: { read?: (assignmentId: string) => Promise<FastPathAnswer> }) {
  const assignmentId = assignmentOf(useSearchParams().get("zadatak"));
  if (assignmentId === null) {
    return (
      <>
        <PageHead title={t.title} lead={t.lead} />
        <section className="card"><p className="note" role="status">{fp.pickAssignment}</p></section>
      </>
    );
  }
  return <AssignmentFastPath key={assignmentId} assignmentId={assignmentId} read={read} />;
}

function AssignmentFastPath({ assignmentId, read }: { assignmentId: string; read: (id: string) => Promise<FastPathAnswer> }) {
  const { base } = useHost();
  const [answer, retry] = useTeacherRead(base, async () => fastPathRead(await read(assignmentId)));
  return (
    <TeacherPage title={t.title} lead={t.lead} read={answer} retry={retry} unavailable={t.unavailable} retryLabel={t.retry}
      ready={(students) => <FastPathBody students={students} hrefOf={(path) => appHref(base, path)} />} />
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
