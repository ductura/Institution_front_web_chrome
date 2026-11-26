"use client";

// ED-35 (Daniel's decision of 26. 11. 2026, Ductus#2058, replacing B-9): the student reads the working
// criteria of the student's own work, each teacher's separately, never merged, in the server's order,
// and only reads. While `call` is null the card says "nedostupno".
import { Button } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  readStudentCriteria, teacherNameText, type StudentCriteriaCall, type TeacherCriteria,
} from "../../../../../../../src/client/student-working-criteria";

import styles from "./Consult.module.css";
import { criteriaHeading, criterionTitle } from "./consult-model";
import { consultHr } from "./messages.hr";

const t = consultHr.criteria;
type Load = { kind: "loading" } | { kind: "ready"; teachers: readonly TeacherCriteria[] } | { kind: "unavailable" | "notFound" | "signedOut" };

export function StudentCriteria({ documentId, call, onSessionEnd }: {
  documentId: string; call: StudentCriteriaCall | null; onSessionEnd?: () => void;
}) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const read = useCallback(async () => {
    setLoad({ kind: "loading" });
    const result = call ? await readStudentCriteria(call, documentId) : { kind: "nepoznato" as const };
    if (!alive.current) return;
    if (result.kind === "ready") setLoad(result);
    else if (result.kind === "session-expired") { setLoad({ kind: "signedOut" }); onSessionEnd?.(); }
    else setLoad({ kind: result.kind === "greska" && result.code === "not_found" ? "notFound" : "unavailable" });
  }, [call, documentId, onSessionEnd]);
  useEffect(() => { void read(); }, [read]);

  if (load.kind === "loading") return <p role="status" className={styles.muted}>{t.loading}</p>;
  if (load.kind !== "ready") {
    const text = load.kind === "signedOut" ? t.errors.signedOut : load.kind === "notFound" ? t.notFound : t.unavailable;
    return (
      <div className={styles.card}>
        <p role="alert" className={styles.error}>{text}</p>
        {load.kind === "unavailable" && call ? <Button size="dense" tone="secondary" onClick={() => void read()}>{t.retry}</Button> : null}
      </div>
    );
  }
  if (load.teachers.length === 0) return <p className={styles.muted} data-criteria-none="">{t.noneYet}</p>;
  return (
    <div data-student-criteria="">
      {load.teachers.map((teacher) => {
        const name = teacherNameText(teacher.teacherName);
        const headingId = `kriteriji-${teacher.teacherId}`;
        return (
          <section key={teacher.teacherId} className={styles.card} aria-labelledby={headingId}>
            <h3 id={headingId}>{criteriaHeading(teacher.criteria)}</h3>
            <p className={styles.muted}>{name === null ? t.teacherUnnamed : t.teacherLine.replace("{name}", name)}</p>
            <ul className={styles.list}>
              {teacher.criteria.map((c) => (
                <li key={c.id} className={styles.item}>
                  <b>{criterionTitle(c)}</b>
                  {c.assessment !== null ? <span>{t.assessments[c.assessment]}</span> : <p className={styles.muted}>{t.unrated}</p>}
                  {c.note !== null ? <p className={styles.noteText}>{c.note}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className={styles.muted}>{t.note}</p>
    </div>
  );
}
