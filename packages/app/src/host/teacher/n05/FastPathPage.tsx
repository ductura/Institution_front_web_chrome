"use client";

import { Button, PanelTabs } from "@ductura/ui";
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
import { fastPathHostText as t } from "./messages.hr";
import { assignmentOf, detailLines, fastPathRead, stateText, type FastPathAnswer } from "./model";

const fp = messagesHr.fastPath;

/** N-05 "Brz put" (WEB-2142): the works of the assignment in `?zadatak=`, one after another, read only. */
export default function FastPathPage({ read = readFastPath }: { read?: (assignmentId: string) => Promise<FastPathAnswer> }) {
  const assignmentId = assignmentOf(useSearchParams().get("zadatak"));
  if (assignmentId === null) {
    return (
      <div className="page">
        <h1>{t.title}</h1>
        <p role="status">{fp.pickAssignment}</p>
      </div>
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
      <section aria-labelledby="brz-put-prazno">
        <h2 id="brz-put-prazno">{t.emptyTitle}</h2>
        <p role="status">{t.emptyText}</p>
      </section>
    );
  }
  // The chosen student stays chosen through a new read while still on the list.
  const index = Math.max(0, sorted.findIndex((s) => s.id === chosenId));
  const current = sorted[index]!;
  const work = liveWorkHref(current.documentId);
  const step = (to: FastPathStudent | undefined, label: string) => (
    <Button tone="quiet" disabled={to === undefined} onClick={() => to && setChosenId(to.id)}>{label}</Button>
  );
  return (
    <div>
      <nav aria-label={fp.studentsLabel}>
        <h2>{fp.studentsTitle}</h2>
        <ul>
          {sorted.map((s) => (
            <li key={s.id}>
              <Button tone="quiet" aria-current={s.id === current.id ? "true" : undefined} onClick={() => setChosenId(s.id)}>
                <span>{fullName(s)}</span> <span data-work={s.work}>{stateText(s)}</span>
              </Button>
            </li>
          ))}
        </ul>
        <p>{fp.orderNote}</p>
      </nav>
      <section aria-labelledby="brz-put-student">
        <h2 id="brz-put-student">{fullName(current)}</h2>
        {current.record ? <Work student={current} record={current.record} summaryHref={work && hrefOf(`${work}#${SUMMARY_ANCHOR}`)} />
          : <p role="status">{t.notStarted}</p>}
        <p>
          {step(sorted[index - 1], c.previous)} {step(sorted[index + 1], c.next)}
          {work && <> <a href={hrefOf(work)}>{fp.openWork}</a></>}
        </p>
      </section>
    </div>
  );
}

function Work({ student, record, summaryHref }: { student: FastPathStudent; record: FastPathRecord; summaryHref: string | null }) {
  const text = (
    <article aria-label={fp.textLabel}>
      {textRuns(record.blocks).map((run, i) => {
        if (run.kind === "heading") return <h3 key={i}>{run.texts[0]}</h3>;
        if (run.kind === "bulletItem") return <ul key={i}>{run.texts.map((s, j) => <li key={j}>{s}</li>)}</ul>;
        if (run.kind === "quote") return <blockquote key={i}>{run.texts.map((s, j) => <p key={j}>{s}</p>)}</blockquote>;
        return <p key={i}>{run.texts[0]}</p>;
      })}
    </article>
  );
  return (
    <>
      <dl>
        {detailLines(student, record).map((line) => [
          <dt key={`${line.key}-k`}>{line.label}</dt>,
          <dd key={`${line.key}-v`} data-line={line.key}>{line.value}</dd>,
        ])}
      </dl>
      <PanelTabs label={fp.viewLabel} tabs={[
        { id: "text", label: fp.views.text, content: text },
        { id: "summary", label: fp.views.summary, content: (
          <div>
            <ProcessSummaryView summary={record.summary} />
            {summaryHref && <a href={summaryHref}>{c.openSummary}</a>}
          </div>
        ) },
      ]} />
    </>
  );
}
