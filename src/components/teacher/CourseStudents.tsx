"use client";

import { Select, Skeleton, StateTag, type SubmissionState } from "@ductura/ui";
import { useState } from "react";

import type { CourseStudent, WorkState } from "@/client/teacher-reads";
import { isDocumentId } from "@/domain/collaboration/comment";
import { compareHr } from "@/domain/text/compare-hr";
import { courseStudentsHr as t } from "@/lib/i18n/messages.hr";

import styles from "./kolegiji/CourseCodes.module.css";

// TODO(ugovor): the WEB-30 roster has assignmentId and state. The course
// read supplies assignment metadata, and N-06 needs the actual document id.
type RosterWork = CourseStudent["works"][number] & {
  readonly title?: string;
  readonly workType?: string;
  readonly documentId?: string | null;
};

type RosterStudent = Omit<CourseStudent, "works"> & { readonly works: readonly RosterWork[] };

type RosterResult =
  | { kind: "loading" }
  | { kind: "unavailable"; retryHref: string }
  | { kind: "ready"; students: readonly RosterStudent[]; courseName?: string };

const stateTags = {
  predano: "submitted",
  nije_predano: "not_submitted",
  nakon_roka: "late",
  ceka: "pending",
} satisfies Record<WorkState, SubmissionState>;

function seminarHref(work: RosterWork): string | null {
  const { documentId } = work;
  if (work.workType !== "seminar_paper" || !isDocumentId(documentId)
    || documentId === "." || documentId === ".." || /\p{Surrogate}/u.test(documentId)) return null;
  return `/nastavnik/rad/${encodeURIComponent(documentId)}`;
}

function StudentRows({ students }: { students: readonly RosterStudent[] }) {
  const [group, setGroup] = useState("");
  const counts = new Map<string, number>();
  for (const student of students) {
    if (student.group !== null) counts.set(student.group, (counts.get(student.group) ?? 0) + 1);
  }
  const options = [
    { value: "", label: `${t.allGroups} (${students.length})` },
    ...[...counts].sort(([a], [b]) => compareHr(a, b)).map(([value, count]) => ({
      value, label: `${value} (${count})`,
    })),
  ];
  const visible = students
    .filter((student) => group === "" || student.group === group)
    .sort((a, b) => {
      if (a.name === null) return b.name === null ? 0 : 1;
      return b.name === null ? -1 : compareHr(a.name, b.name);
    });

  return (
    <div>
      {counts.size > 0 && (
        <div id="f-gr" style={{ maxWidth: 280 }}>
          <Select label={t.filter} options={options} value={group}
            onChange={(event) => setGroup(event.target.value)} />
        </div>
      )}
      <ul className={styles.list} role="list">
        {visible.map((student) => (
          <li key={student.studentId} style={{ borderBlockEnd: "1px solid var(--rule)", paddingBlockEnd: 12 }}>
            <p><strong>{student.name ?? t.noName}</strong>{student.group && ` · ${student.group}`}</p>
            {student.works.length === 0 && <p className={styles.note}>{t.noWorks}</p>}
            {student.works.map((work) => {
              const href = seminarHref(work);
              return (
                <div key={work.assignmentId} className={styles.row}>
                  <p>{work.title ?? t.noAssignmentTitle} <StateTag state={stateTags[work.state]} /></p>
                  {href && <a href={href}>{t.openSeminar}</a>}
                </div>
              );
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** N-04, with the roster and its access scope supplied by the reader. */
export default function CourseStudents({ result }: { result: RosterResult }) {
  const courseTitle = result.kind === "ready" ? result.courseName : undefined;
  return (
    <div className="page">
      <h1>{courseTitle ? t.courseTitle.replace("{course}", () => courseTitle) : t.title}</h1>
      {result.kind === "loading" && <Skeleton label={t.loading} />}
      {result.kind === "unavailable" && (
        <div>
          <p role="alert">{t.unavailable}</p>
          <a href={result.retryHref}>{t.retry}</a>
        </div>
      )}
      {result.kind === "ready" && (result.students.length === 0 ? (
        <div>
          <p role="status">{t.empty}</p>
          <a href="/nastavnik/kolegiji">{t.backToCourses}</a>
        </div>
      ) : <StudentRows students={result.students} />)}
    </div>
  );
}
