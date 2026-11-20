"use client";

import { Button, Card, Select, TextField } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { goToSignIn } from "../../../client/api.ts";
import {
  createDeadlineExtension, EXTENSION_REASONS, extensionInput, fetchExtensionCall,
  type DeadlineExtension, type ExtensionCall, type FormProblem, type Scope,
} from "../../../client/deadline-extensions.ts";
import { formatDateTimeHr } from "../../../lib/i18n/hr.ts";
import { messagesHr } from "../../../lib/i18n/messages.hr.ts";
import { extensionNote, withRecorded, type ExtensionNote, type ExtensionStudent } from "./deadline-extensions-logic.ts";

import styles from "./DeadlineExtensions.module.css";

const t = messagesHr.deadlineExtensions;

/** What the page read: anything but a list is "unavailable", never "none". */
export type ExtensionsRead = { kind: "ready"; extensions: readonly DeadlineExtension[] } | { kind: "unavailable" };

const PROBLEM_TEXT: Record<FormProblem, string> = { student: t.errStudent, due: t.errDue, reason: t.errReason };
const reasonLabel = (id: string) => EXTENSION_REASONS.find((r) => r.id === id)?.label ?? "";

export type DeadlineExtensionsProps = {
  readonly assignmentId: string;
  readonly read: ExtensionsRead;
  /** Empty when the roster could not be read: only "all" can then be recorded. */
  readonly students: readonly ExtensionStudent[];
  readonly here: string;
  readonly backHref: string;
  /** Tests give a transport; the page uses the browser's. */
  readonly call?: ExtensionCall;
};

/** WEB-1113 (N-13): the form of one deadline extension, and the list of recorded ones. */
export default function DeadlineExtensions({ assignmentId, read, students, here, backHref, call }: DeadlineExtensionsProps) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>(students.length === 0 ? "all" : "student");
  const [studentId, setStudentId] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<ExtensionNote | null>(null);
  const [added, setAdded] = useState<DeadlineExtension | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setNote(null);
    const form = extensionInput({ scope, studentId, dueLocal, reasonId });
    if (!form.ok) {
      setProblem(form.problem);
      return;
    }
    setProblem(null);
    setBusy(true);
    const outcome = await createDeadlineExtension(call ?? fetchExtensionCall((input, init) => fetch(input, init)), assignmentId, form.input);
    setBusy(false);
    if (outcome.kind === "session-expired") {
      goToSignIn(here);
      return;
    }
    setNote(extensionNote(outcome, form.input, students));
    if (outcome.kind === "zabiljezeno") {
      setAdded(outcome.extension);
      setDueLocal("");
      setReasonId("");
      setStudentId("");
      router.refresh();
    }
  }

  const noteLine = note === null ? null : note.tone === "alert"
    ? <p role="alert" className={styles.note}>{note.text}</p>
    : <p role="status" className={styles.note}>{note.text}</p>;
  const recorded = read.kind === "ready" ? withRecorded(read.extensions, added) : [];

  return (
    <div className={styles.page}>
      <Card title={t.formTitle}>
        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
          <fieldset className={styles.scope} disabled={busy}>
            <legend>{t.scopeLegend}</legend>
            <label><input type="radio" name="scope" value="student" checked={scope === "student"}
              disabled={students.length === 0} onChange={() => setScope("student")} /> {t.scopeStudent}</label>
            <label><input type="radio" name="scope" value="all" checked={scope === "all"}
              onChange={() => { setScope("all"); setStudentId(""); setProblem(null); }} /> {t.scopeAll}</label>
          </fieldset>
          {students.length === 0 && <p className={styles.hint}>{t.studentsUnavailable}</p>}
          {scope === "student" && students.length > 0 && (
            <Select label={t.student} placeholder={t.studentPlaceholder} value={studentId} busy={busy}
              options={students.map((s) => ({ value: s.studentId, label: s.name ?? t.unnamed }))}
              error={problem === "student" ? PROBLEM_TEXT.student : undefined}
              onChange={(event) => setStudentId(event.target.value)} />
          )}
          <TextField label={t.due} type="datetime-local" value={dueLocal} busy={busy} hint={t.dueHint}
            error={problem === "due" ? PROBLEM_TEXT.due : undefined} onChange={(event) => setDueLocal(event.target.value)} />
          <Select label={t.reason} placeholder={t.reasonPlaceholder} value={reasonId} busy={busy}
            options={EXTENSION_REASONS.map((r) => ({ value: r.id, label: r.label }))}
            error={problem === "reason" ? PROBLEM_TEXT.reason : undefined} onChange={(event) => setReasonId(event.target.value)} />
          {noteLine}
          <div className={styles.actions}>
            <Button type="submit" busy={busy}>{busy ? t.submitting : t.submit}</Button>
            <a className={styles.cancel} href={backHref}>{t.cancel}</a>
          </div>
        </form>
      </Card>
      <Card title={t.listTitle}>
        {read.kind === "unavailable" ? (
          <>
            <p role="alert">{t.unavailable}</p>
            <p><a href={here}>{t.retry}</a></p>
          </>
        ) : recorded.length === 0 ? <p>{t.empty}</p> : (
          <ul className={styles.list}>
            {recorded.map((e) => (
              <li key={e.extensionId} className={styles.item}>
                <span className={styles.who}>{e.scope === "all" ? t.forAll : (e.studentName ?? t.unnamed)}</span>
                <span>{t.newDue}: {formatDateTimeHr(e.dueAt)}</span>
                <span>{t.oldDue}: {formatDateTimeHr(e.previousDueAt)}</span>
                <span>{reasonLabel(e.reasonId)}</span>
                <span className={styles.meta}>{t.recorded.replace("{when}", formatDateTimeHr(e.recordedAt))}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
