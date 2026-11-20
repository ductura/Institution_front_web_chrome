"use client";

import { Button, Card, Dialog, TextField } from "@ductura/ui";
import { useRef, useState } from "react";

import { createApi, goToSignIn } from "@/client/api";
import { countHr, formatDateTimeHr } from "@/lib/i18n/hr";
import { messagesHr } from "@/lib/i18n/messages.hr";

import type { TeacherCourse } from "../teacher-courses-read";
import { codeOutcome, defaultValidUntil, nextNote, validUntilInstant, type CodeNote } from "./course-codes";
import styles from "./CourseCodes.module.css";

const t = messagesHr.teacherCourseCodes;
const policies = messagesHr.facultyRuleVersions.policies;
const aiLabel = messagesHr.facultyRuleVersions.aiPolicy;
type Course = Pick<TeacherCourse, "id" | "name" | "academicYear" | "aiPolicy" | "assignments">;
type Failure = "invalid" | "forbidden" | "unavailable";

function assignmentsText(count: number): string {
  return count === 0 ? t.assignments.none : countHr(count, t.assignments.one, t.assignments.few, t.assignments.many);
}

/** "2026/2027" as Croatian writes it: "2026./2027.". */
function yearText(year: string): string {
  return `${year.replace("/", "./")}.`;
}

/** The courses grouped by academic year, in the order the server sent them (year descending). */
function byYear(courses: readonly Course[]): [string, Course[]][] {
  const groups = new Map<string, Course[]>();
  for (const course of courses) groups.set(course.academicYear, [...(groups.get(course.academicYear) ?? []), course]);
  return [...groups];
}

function noteText(note: CodeNote): string {
  if (note.kind === "issued") return t.issuedNote.replace("{until}", formatDateTimeHr(note.validUntil));
  if (note.kind === "unknown") return t.unknownNote;
  return note.kind === "revoked" ? t.revokedNote : t.nothingRevokedNote;
}

/**
 * WEB-18 (N-01): the teacher's courses with the dk-h dialog for each one's
 * enrolment code. Both requests go through src/client only; the server
 * decides whether the caller teaches the course. The code is held only while
 * its dialog is open (A-8): closing drops it, and the row keeps "issued".
 */
export default function CourseCodes({ courses, here }: { courses: readonly Course[]; here: string }) {
  const [open, setOpen] = useState<Course | null>(null);
  const [local, setLocal] = useState("");
  const [fieldError, setFieldError] = useState(false);
  const [busy, setBusy] = useState<"issue" | "revoke" | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [notes, setNotes] = useState<Readonly<Record<string, CodeNote>>>({});
  const closeRef = useRef<HTMLButtonElement>(null);

  function show(course: Course) {
    setOpen(course);
    setLocal(defaultValidUntil(Date.now()));
    setFieldError(false);
    setFailure(null);
    setCode(null);
  }

  function close() {
    if (busy !== null) return;
    setOpen(null);
    setCode(null);
  }

  async function send(action: "issue" | "revoke") {
    if (open === null || busy !== null) return;
    const validUntil = validUntilInstant(local);
    if (action === "issue" && validUntil === null) {
      setFieldError(true);
      return;
    }
    setFailure(null);
    setBusy(action);
    const api = createApi();
    const params = { courseId: open.id };
    const answer = await (action === "issue"
      ? api("institution.enrollment-code.post", { params, query: undefined, body: { validUntil: validUntil ?? "" } })
      : api("institution.enrollment-code-revocation.post", { params, query: undefined, body: {} })
    ).catch(() => ({ ok: false, status: 0, code: "unexpected" }) as const);
    setBusy(null);
    const outcome = codeOutcome(answer);
    if (outcome.kind === "signedOut") {
      goToSignIn(here);
      return;
    }
    const id = open.id;
    setNotes((now) => {
      const note = nextNote(now[id] ?? null, outcome, validUntil ?? "");
      return note === null ? now : { ...now, [id]: note };
    });
    if (outcome.kind === "issued") {
      setCode(outcome.code);
      closeRef.current?.focus();
    } else if (outcome.kind === "revoked") {
      setCode(null);
    } else {
      // An unknown outcome may have replaced or revoked the shown code: never keep showing it.
      if (outcome.kind === "unavailable") setCode(null);
      setFailure(outcome.kind);
    }
  }

  return (
    <>
      {byYear(courses).map(([year, list]) => (
        <section key={year} className={styles.year} aria-labelledby={`godina-${year}`}>
          <h2 id={`godina-${year}`} className={styles.yearHeading}>{t.yearHeading.replace("{year}", yearText(year))}</h2>
          <ul className={styles.list}>
            {list.map((course) => {
              const note = notes[course.id];
              return (
                <li key={course.id}>
                  <Card title={course.name}>
                    <div className={styles.row}>
                      <div className={styles.text}>
                        <p className={styles.meta}>
                          {aiLabel}: {policies[course.aiPolicy]} · {assignmentsText(course.assignments.length)}
                        </p>
                        {note ? <p className={styles.note} role="status">{noteText(note)}</p> : null}
                      </div>
                      <Button tone="quiet" onClick={() => show(course)} aria-label={`${t.codeButton}: ${course.name}`}>{t.codeButton}</Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <Dialog
        open={open !== null}
        title={open ? t.dialogTitle.replace("{course}", open.name) : ""}
        onClose={close}
        dismissible={busy === null}
        error={failure ? t.errors[failure] : undefined}
        actions={
          <>
            <Button tone="quiet" busy={busy === "revoke"} onClick={() => void send("revoke")}>
              {busy === "revoke" ? t.revoking : t.revoke}
            </Button>
            <Button tone="quiet" ref={closeRef} onClick={close}>{t.close}</Button>
            <Button busy={busy === "issue"} onClick={() => void send("issue")}>
              {busy === "issue" ? t.issuing : t.issue}
            </Button>
          </>
        }
      >
        <p className={styles.lead}>{t.dialogLead}</p>
        <TextField
          label={t.validUntil}
          type="datetime-local"
          value={local}
          busy={busy !== null}
          error={fieldError ? t.validUntilInvalid : undefined}
          onChange={(event) => {
            setLocal(event.target.value);
            setFieldError(false);
          }}
        />
        {code ? (
          <div className={styles.code}>
            <p className={styles.codeLabel}>{t.codeLabel}</p>
            <output className={styles.codeValue} aria-live="polite">{code}</output>
            <p className={styles.shownOnce}>{t.shownOnce}</p>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
