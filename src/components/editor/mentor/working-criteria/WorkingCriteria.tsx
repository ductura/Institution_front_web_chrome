"use client";

/**
 * The teacher's six working criteria at the end of the Mentor card (WEB-1112;
 * E 3.5 mentor3, B-9). Read-write for the teacher only; the student's editor
 * never mounts it (the test in WorkingCriteria.student.test.ts keeps it so).
 * Each criterion has three assessments (a click on the pressed one clears it)
 * and a note. A write that failed leaves the form as it was typed, with the
 * reason, so the teacher can send it again; a success is shown only from the
 * server's answer. Text is rendered as React text, never as HTML.
 */

import { Button } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ASSESSMENTS, NOTE_MAX, readWorkingCriteria, saveWorkingCriterion,
  type CriteriaCall, type CriterionInput, type WorkingCriterion,
} from "@/client/teacher-working-criteria";

import styles from "./WorkingCriteria.module.css";
import { IDLE_ROW as IDLE, afterWrite, assessmentChange, headingText, noteChange, type Row } from "./criteria-logic";
import { workingCriteriaHr as t } from "./messages.hr";

export type CriteriaLoad =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly criteria: readonly WorkingCriterion[] }
  | { readonly kind: "unavailable" | "notFound" | "signedOut" };

export function CriteriaView({ load, rows, onPick, onEdit, onDraft, onSaveNote, onCancel, onRetry }: {
  load: CriteriaLoad;
  rows: Readonly<Record<string, Row>>;
  onPick: (criterion: WorkingCriterion, picked: (typeof ASSESSMENTS)[number]) => void;
  onEdit: (criterion: WorkingCriterion) => void;
  onDraft: (criterion: WorkingCriterion, text: string) => void;
  onSaveNote: (criterion: WorkingCriterion) => void;
  onCancel: (criterion: WorkingCriterion) => void;
  onRetry: () => void;
}) {
  if (load.kind === "loading") return <p role="status" className={styles.muted}>{t.loading}</p>;
  if (load.kind !== "ready") {
    const text = load.kind === "signedOut" ? t.errors.signedOut : load.kind === "notFound" ? t.notFound : t.unavailable;
    return (
      <div className={styles.card}>
        <p role="alert" className={styles.error}>{text}</p>
        {load.kind === "unavailable" ? <Button onClick={onRetry}>{t.retry}</Button> : null}
      </div>
    );
  }
  return (
    <section className={styles.card} aria-labelledby="radni-kriteriji">
      <h2 id="radni-kriteriji">{headingText(load.criteria)}</h2>
      <ul className={styles.list}>
        {load.criteria.map((c) => {
          const row = rows[c.criterionId] ?? IDLE;
          return (
            <li key={c.criterionId} className={styles.item}>
              <b>{c.title}</b>
              <div className={styles.seg} role="group" aria-label={t.assessmentGroup.replace("{title}", c.title)}>
                {ASSESSMENTS.map((a) => (
                  <Button key={a} aria-pressed={c.assessment === a} disabled={row.busy} onClick={() => onPick(c, a)}>
                    {t.assessments[a]}
                  </Button>
                ))}
              </div>
              {c.assessment === null ? <p className={styles.muted}>{t.unrated}</p> : null}
              {c.note !== null && !row.editing ? <p className={styles.noteText}>{c.note}</p> : null}
              {row.editing ? (
                <div className={styles.card}>
                  <label>
                    {t.noteLabel.replace("{title}", c.title)}
                    <textarea className={styles.field} value={row.draft} maxLength={NOTE_MAX} disabled={row.busy}
                      onChange={(e) => onDraft(c, e.target.value)} />
                  </label>
                  <p className={styles.muted}>{t.noteHint.replace("{max}", String(NOTE_MAX))}</p>
                  <div className={styles.row}>
                    <Button disabled={row.busy} onClick={() => onSaveNote(c)}>{row.busy ? t.saving : t.saveNote}</Button>
                    <Button disabled={row.busy} onClick={() => onCancel(c)}>{t.cancel}</Button>
                  </div>
                </div>
              ) : (
                <Button disabled={row.busy} onClick={() => onEdit(c)}>{c.note === null ? t.addNote : t.editNote}</Button>
              )}
              {row.error ? <p role="alert" className={styles.error}>{row.error}</p> : null}
            </li>
          );
        })}
      </ul>
      <p className={styles.muted}>{t.note}</p>
    </section>
  );
}

export default function WorkingCriteria({ documentId, call, onSessionEnd }: {
  documentId: string;
  /** Without a transport (TODO(ugovor)) the card says the criteria are unavailable. */
  call: CriteriaCall | null;
  onSessionEnd?: () => void;
}) {
  const [load, setLoad] = useState<CriteriaLoad>({ kind: "loading" });
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

  const send = async (criterion: WorkingCriterion, input: CriterionInput, done: Partial<Row>) => {
    const id = criterion.criterionId;
    if (!call || inFlight.current.has(id)) return;
    inFlight.current.add(id);
    patch(id, { busy: true, error: null });
    const result = await saveWorkingCriterion(call, documentId, id, input);
    inFlight.current.delete(id);
    if (!alive.current) return;
    if (result.kind === "saved") {
      setLoad((l) => (l.kind === "ready" ? { kind: "ready", criteria: afterWrite(l.criteria, IDLE, result, {}).criteria } : l));
    }
    setRows((all) => ({ ...all, [id]: afterWrite([], all[id] ?? IDLE, result, done).row }));
    if (result.kind === "session-expired") onSessionEnd?.();
  };

  return (
    <CriteriaView load={load} rows={rows} onRetry={() => void read()}
      onPick={(c, a) => void send(c, assessmentChange(c, a), {})}
      onEdit={(c) => patch(c.criterionId, { editing: true, draft: c.note ?? "", error: null })}
      onDraft={(c, text) => patch(c.criterionId, { draft: text })}
      onCancel={(c) => patch(c.criterionId, { editing: false, error: null })}
      onSaveNote={(c) => {
        const input = noteChange(c, rows[c.criterionId]?.draft ?? "");
        if (input === null) patch(c.criterionId, { error: t.errors.invalid });
        else void send(c, input, { editing: false });
      }} />
  );
}
