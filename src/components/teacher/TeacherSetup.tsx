"use client";

import { useRef, useState, type FormEvent } from "react";

import { formatDateHr } from "@/lib/i18n/hr";
import { wordRangeHr } from "@/lib/i18n/length-line";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import {
  AI_PURPOSES,
  WORK_TYPES,
  assignmentBody,
  parseWordRange,
  type AiPurpose,
  type AssignmentCreation,
  type WorkType,
} from "./assignment-create";
import { publishAssignment } from "./TeacherSetup/assignment-mutations";
import type { TeacherCourse } from "./teacher-courses-read";
import styles from "./TeacherSetup.module.css";

type ExistingCourse = Pick<TeacherCourse, "id" | "name" | "academicYear" | "aiPolicy">;

function PreviewRange({ text }: { text: string | null }) {
  return text ? <span> · {text}</span> : null;
}

function CourseSummary({ course }: { course: ExistingCourse }) {
  const c = t.teacher.course;
  return (
    <section className={styles.card} aria-labelledby="kolegij">
      <h2 id="kolegij">{c.heading}</h2>
      <p className={styles.listHead}>{course.name}</p>
      <p className={styles.hint}>
        {c.years[course.academicYear as keyof typeof c.years] ?? course.academicYear} · {c.policies[course.aiPolicy]}
      </p>
      <p className={styles.hint}>{t.teacher.existingCourse.codeKept}</p>
    </section>
  );
}

export default function TeacherSetup({ course }: { course: ExistingCourse }) {
  const a = t.teacher.assignment;
  const tools = t.teacher.tools;
  const [title, setTitle] = useState("");
  const [workType, setWorkType] = useState<WorkType>("seminar_paper");
  const [opensAt, setOpensAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [instructions, setInstructions] = useState("");
  const [wordMin, setWordMin] = useState("");
  const [wordMax, setWordMax] = useState("");
  const [purposes, setPurposes] = useState<AiPurpose[]>([...AI_PURPOSES]);
  const [assignmentResult, setAssignmentResult] = useState<AssignmentCreation | null>(null);

  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const request = useRef<{ body: string; id: string } | null>(null);
  async function guarded(work: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      await work();
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  // A retry key belongs to the serialized body, not the raw form text.
  function edit<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setAssignmentResult(null);
    };
  }

  const coursePolicy = course.aiPolicy;
  const allowed = coursePolicy === "prohibited" ? [] : AI_PURPOSES.filter((p) => purposes.includes(p));
  const bannedPurposes = AI_PURPOSES.filter((p) => !allowed.includes(p));
  const published = assignmentResult?.kind === "available";
  const previewRange = parseWordRange(wordMin, wordMax);
  const previewRangeText = previewRange ? wordRangeHr({ min: previewRange.wordMin, max: previewRange.wordMax }) : null;

  function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || published) return;
    const body = assignmentBody({ title, instructions, workType, opensAt, dueAt, aiPurposes: purposes, wordMin, wordMax }, coursePolicy);
    if (!body) return setAssignmentResult({ kind: "invalid" });
    const serialized = JSON.stringify(body);
    if (request.current?.body !== serialized) request.current = { body: serialized, id: crypto.randomUUID() };
    const key = request.current.id;
    void guarded(async () => setAssignmentResult(await publishAssignment(course.id, body, key)));
  }

  const assignmentError =
    assignmentResult && assignmentResult.kind !== "available" ? a.errors[assignmentResult.kind] : null;
  const date = (local: string) => (local ? formatDateHr(local) : "…");
  return (
    <div className={styles.layout}>
      <div className={styles.forms}>
        <CourseSummary course={course} />
        <form className={styles.card} onSubmit={submitAssignment} aria-labelledby="zadatak">
          <h2 id="zadatak">{a.heading}</h2>
          <fieldset className={styles.fields} disabled={pending || published}>
            <label className={styles.field}>
              <span>{a.title}</span>
              <input className={styles.control} value={title} maxLength={200} autoComplete="off"
                onChange={(e) => edit(setTitle)(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span>{a.workType}</span>
              <select className={styles.control} value={workType}
                onChange={(e) => edit(setWorkType)(e.target.value as WorkType)}>
                {WORK_TYPES.map((w) => <option key={w} value={w}>{a.workTypes[w]}</option>)}
              </select>
            </label>
            <div className={styles.pair}>
              <label className={styles.field}>
                <span>{a.opensAt}</span>
                <input className={styles.control} type="datetime-local" value={opensAt}
                  aria-describedby="zadatak-vrijeme-pomoc" onChange={(e) => edit(setOpensAt)(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span>{a.dueAt}</span>
                <input className={styles.control} type="datetime-local" value={dueAt}
                  aria-describedby="zadatak-vrijeme-pomoc" onChange={(e) => edit(setDueAt)(e.target.value)} />
              </label>
            </div>
            <p id="zadatak-vrijeme-pomoc" className={styles.hint}>{a.timesHint}</p>
            <label className={styles.field}>
              <span>{a.instructions}</span>
              <textarea className={styles.control} rows={4} value={instructions}
                onChange={(e) => edit(setInstructions)(e.target.value)} />
            </label>
            <div className={styles.pair}>
              <label className={styles.field}>
                <span>{a.wordMin}</span>
                <input className={styles.control} type="text" inputMode="numeric" autoComplete="off"
                  value={wordMin} onChange={(e) => edit(setWordMin)(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span>{a.wordMax}</span>
                <input className={styles.control} type="text" inputMode="numeric" autoComplete="off"
                  value={wordMax} onChange={(e) => edit(setWordMax)(e.target.value)} />
              </label>
            </div>
            <p className={styles.hint}>{a.wordRangeHint}</p>

            <fieldset className={styles.tools}>
              <legend>{tools.heading}</legend>
              <p className={styles.hint}>{coursePolicy === "prohibited" ? tools.courseProhibits : tools.narrowOnly}</p>
              <p className={styles.listHead}>{tools.allowed}</p>
              {AI_PURPOSES.map((p) => (
                <label key={p} className={styles.check}>
                  <input type="checkbox" checked={allowed.includes(p)} disabled={coursePolicy === "prohibited"}
                    onChange={(e) => edit(setPurposes)(e.target.checked
                      ? [...purposes, p] : purposes.filter((x) => x !== p))} />
                  <span>{tools.purposes[p]}</span>
                </label>
              ))}
              {Object.values(tools.conditions).map((text) => <p key={text} className={styles.hint}>{text}</p>)}
              <p className={styles.listHead}>{tools.banned}</p>
              {/* DAN-345: with every purpose allowed there is no empty list, only the sentence. */}
              {bannedPurposes.length ? (
                <ul className={styles.banned}>
                  {bannedPurposes.map((p) => (
                    <li key={p}><s>{tools.purposes[p]}</s></li>
                  ))}
                </ul>
              ) : (
                <p className={styles.hint}>{tools.bannedNone}</p>
              )}
              <p className={styles.hint}>{tools.alwaysBannedHead}</p>
              <ul className={styles.banned}>
                {Object.values(tools.alwaysBanned).map((text) => <li key={text}>{text}</li>)}
              </ul>
              <p className={styles.hint}>{tools.source}</p>
            </fieldset>

            <button className="btn" type="submit">
              {published ? a.published : pending ? a.pending : a.publish}
            </button>
          </fieldset>
          <p className={styles.hint}>
            {t.teacher.existingCourse.studentsNotified}
          </p>
          <p className={styles.hint}>{a.newVersion}</p>
          {assignmentError ? <p className={styles.notice} role="alert">{assignmentError}</p> : null}
          {published ? <p className={styles.notice} role="status">{a.publishedNotice}</p> : null}
        </form>
      </div>

      <aside className={styles.preview} aria-labelledby="pregled">
        <h2 id="pregled">{t.teacher.preview.heading}</h2>
        <p className={styles.hint}>{t.teacher.preview.step}</p>
        <h3>{title.trim() || t.teacher.preview.untitled}</h3>
        <p className={styles.hint}>
          {a.workTypes[workType]} · {t.teacher.preview.opensFrom} {date(opensAt)} · {t.teacher.preview.due} {date(dueAt)}
          <PreviewRange text={previewRangeText} />
        </p>
        {instructions.trim() ? <p className={styles.brief}>{instructions}</p> : null}
        <p className={styles.listHead}>{tools.allowed}</p>
        {/* DAN-345: nothing allowed reads as the student's notice does, not as an empty list. */}
        {allowed.length ? (
          <ul className={styles.summary}>
            {allowed.map((p) => <li key={p}><span aria-hidden="true">✓ </span>{tools.purposes[p]}</li>)}
          </ul>
        ) : (
          <p className={styles.hint}>{t.student.noTools}</p>
        )}
        <p className={styles.listHead}>{tools.banned}</p>
        <ul className={styles.summary}>
          {[...bannedPurposes.map((p) => tools.purposes[p]),
            ...Object.values(tools.alwaysBanned)].map((text) => (
            <li key={text}><span aria-hidden="true">× </span>{text}</li>
          ))}
        </ul>
        {Object.values(tools.conditions).map((text) => <p key={text} className={styles.hint}>{text}</p>)}
        <p className={styles.hint}>{tools.source}</p>
        <p className={styles.hint}>{t.teacher.preview.rest}</p>
      </aside>
    </div>
  );
}
