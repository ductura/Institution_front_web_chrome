"use client";

// WEB-2122 (prototype mentor3, "Kriteriji ocjene"; decision 22. 11. 2026: visible to the student).
// The teacher sets three assessments and a note per criterion; the student and the collaborator only
// read. Until the server's criteria operations exist (`call` is null) the card says "nedostupno".
import { Button } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ASSESSMENTS, NOTE_MAX, readWorkingCriteria, saveWorkingCriterion,
  type CriteriaCall, type CriterionInput, type WorkingCriterion,
} from "../../../../../../../src/client/teacher-working-criteria";

import styles from "./Consult.module.css";
import { assessmentChange, canEditCriteria, criteriaHeading, criterionFailure, criterionTitle, noteChange, withCriterion, type Role } from "./consult-model";
import { consultHr } from "./messages.hr";

const t = consultHr.criteria;
type Row = { busy: boolean; error: string | null; editing: boolean; draft: string };
const IDLE: Row = { busy: false, error: null, editing: false, draft: "" };
type Load = { kind: "loading" } | { kind: "ready"; criteria: readonly WorkingCriterion[] } | { kind: "unavailable" | "notFound" | "signedOut" };

export function ConsultCriteria({ documentId, role, call, onSessionEnd }: {
  documentId: string; role: Role; call: CriteriaCall | null; onSessionEnd?: () => void;
}) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [rows, setRows] = useState<Record<string, Row>>({});
  const alive = useRef(true);
  const inFlight = useRef(new Set<string>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const read = useCallback(async () => {
    setLoad({ kind: "loading" });
    const result = call ? await readWorkingCriteria(call, documentId) : { kind: "nepoznato" as const };
    if (!alive.current) return;
    if (result.kind === "ready") setLoad(result);
    else if (result.kind === "session-expired") { setLoad({ kind: "signedOut" }); onSessionEnd?.(); }
    else setLoad({ kind: result.kind === "greska" && result.code === "not_found" ? "notFound" : "unavailable" });
  }, [call, documentId, onSessionEnd]);
  useEffect(() => { void read(); }, [read]);

  const patch = (id: string, next: Partial<Row>) => setRows((all) => ({ ...all, [id]: { ...(all[id] ?? IDLE), ...next } }));
  const send = async (c: WorkingCriterion, input: CriterionInput, done: Partial<Row>) => {
    const id = c.id;
    if (!call || !canEditCriteria(role) || inFlight.current.has(id)) return;
    inFlight.current.add(id);
    patch(id, { busy: true, error: null });
    const result = await saveWorkingCriterion(call, documentId, id, input);
    inFlight.current.delete(id);
    if (!alive.current) return;
    if (result.kind === "saved") {
      setLoad((l) => (l.kind === "ready" ? { kind: "ready", criteria: withCriterion(l.criteria, result.criterion) } : l));
      patch(id, { busy: false, error: null, ...done });
    } else {
      patch(id, { busy: false, error: criterionFailure(result) });
      if (result.kind === "session-expired") onSessionEnd?.();
    }
  };

  if (load.kind === "loading") return <p role="status" className={styles.muted}>{t.loading}</p>;
  if (load.kind !== "ready") {
    const text = load.kind === "signedOut" ? t.errors.signedOut : load.kind === "notFound" ? t.notFound : t.unavailable;
    return (
      <div className={styles.card}>
        <p role="alert" className={styles.error}>{text}</p>
        {load.kind === "unavailable" && call ? <Button onClick={() => void read()}>{t.retry}</Button> : null}
      </div>
    );
  }
  const editable = canEditCriteria(role);
  return (
    <section className={styles.card} aria-labelledby="radni-kriteriji">
      <h3 id="radni-kriteriji">{criteriaHeading(load.criteria)}</h3>
      <ul className={styles.list}>
        {load.criteria.map((c) => {
          const row = rows[c.id] ?? IDLE;
          const title = criterionTitle(c);
          return (
            <li key={c.id} className={styles.item}>
              <b>{title}</b>
              {editable ? (
                <div className={styles.seg} role="group" aria-label={t.assessmentGroup.replace("{title}", title)}>
                  {ASSESSMENTS.map((a) => (
                    <Button key={a} aria-pressed={c.assessment === a} disabled={row.busy} onClick={() => void send(c, assessmentChange(c, a), {})}>{t.assessments[a]}</Button>
                  ))}
                </div>
              ) : c.assessment !== null ? <span>{t.assessments[c.assessment]}</span> : null}
              {c.assessment === null ? <p className={styles.muted}>{t.unrated}</p> : null}
              {c.note !== null && !row.editing ? <p className={styles.noteText}>{c.note}</p> : null}
              {editable && row.editing ? (
                <div className={styles.card}>
                  <label>{t.noteLabel.replace("{title}", title)}
                    <textarea className={styles.field} value={row.draft} maxLength={NOTE_MAX} disabled={row.busy} onChange={(e) => patch(c.id, { draft: e.target.value })} />
                  </label>
                  <p className={styles.muted}>{t.noteHint.replace("{max}", String(NOTE_MAX))}</p>
                  <div className={styles.row}>
                    <Button disabled={row.busy} onClick={() => {
                      const input = noteChange(c, row.draft);
                      if (input === null) patch(c.id, { error: t.errors.invalid }); else void send(c, input, { editing: false });
                    }}>{row.busy ? t.saving : t.saveNote}</Button>
                    <Button disabled={row.busy} onClick={() => patch(c.id, { editing: false, error: null })}>{t.cancel}</Button>
                  </div>
                </div>
              ) : editable ? (
                <Button disabled={row.busy} onClick={() => patch(c.id, { editing: true, draft: c.note ?? "", error: null })}>{c.note === null ? t.addNote : t.editNote}</Button>
              ) : null}
              {row.error ? <p role="alert" className={styles.error}>{row.error}</p> : null}
            </li>
          );
        })}
      </ul>
      <p className={styles.muted}>{t.note}</p>
    </section>
  );
}
