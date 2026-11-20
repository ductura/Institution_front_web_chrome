"use client";

import { Button, Card, Select, TextField } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

// Relative paths, like MentorshipRequests: packages/app imports src/components without the "@/" alias.
import { createApi, goToSignIn } from "../../../client/api.ts";
import {
  EXTENSION_REASONS, recordDeadlineExtension,
  type DeadlineExtension, type ExtensionStudent, type RecordOutcome,
} from "../../../client/deadline-extensions.ts";
import { formatDateTimeHr } from "../../../lib/i18n/hr.ts";
import { messagesHr } from "../../../lib/i18n/messages.hr.ts";
import { zagrebInstant } from "../../../lib/i18n/zagreb.ts";

import styles from "./DeadlineExtensions.module.css";

const t = messagesHr.deadlineExtensions;

/** The page of N-13 for an assignment. */
export function extensionsHref(assignmentId: string): string {
  return `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/produljenje`;
}

/** The extensions as the page read them; anything but a list is "unavailable", never "none". */
export type ExtensionsRead = { kind: "ready"; extensions: readonly DeadlineExtension[] } | { kind: "unavailable" };

export type ExtensionNote = { readonly tone: "status" | "alert"; readonly lines: readonly string[] };

/** What the page says after a record: a success only from the server's answer (B-6). */
export function extensionNote(outcome: RecordOutcome): ExtensionNote | null {
  switch (outcome.kind) {
    case "zabiljezeno":
      return { tone: "status", lines: outcome.existingSubmissionsUnchanged ? [t.recorded, t.earlierSubmission] : [t.recorded] };
    case "greska":
      return { tone: "alert", lines: [outcome.code === "not_found" ? t.notFound : t.invalid] };
    case "nepoznato":
      return { tone: "alert", lines: [t.unknown] };
    default:
      return null;
  }
}

/** The reasons the form offers: "all" only for all students (N-13). */
export function reasonOptions(scope: "one" | "all") {
  return EXTENSION_REASONS.filter((r) => scope === "all" || r !== "all").map((r) => ({ value: r, label: t.reasons[r] }));
}

function whoOf(extension: DeadlineExtension, names: ReadonlyMap<string, string | null>): string {
  if (extension.studentId === null) return t.allStudents;
  return names.get(extension.studentId) ?? t.unnamed;
}

/**
 * WEB-1113 (N-13, C-15): the form "Produljenje roka" (one student or all, the
 * new deadline in Zagreb time, a reason from the closed list) and the list
 * "Produljeni rokovi". A note follows only the server's answer (B-6); after a
 * recorded extension the page is read again, so the list shows it.
 */
export default function DeadlineExtensions({
  assignmentId, read, students,
}: { assignmentId: string; read: ExtensionsRead; students: readonly ExtensionStudent[] | null }) {
  const router = useRouter();
  const canPickOne = students !== null && students.length > 0;
  const [scope, setScope] = useState<"one" | "all">(canPickOne ? "one" : "all");
  const [studentId, setStudentId] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<ExtensionNote | null>(null);
  const names = new Map((students ?? []).map((s) => [s.studentId, s.name] as const));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const dueAt = zagrebInstant(dueLocal);
    if (dueAt === null || reasonId === "" || (scope === "one" && studentId === "")) {
      setNote({ tone: "alert", lines: [t.missing] });
      return;
    }
    setBusy(true);
    setNote(null);
    const outcome = await recordDeadlineExtension(createApi(), assignmentId, { scope, studentId, dueAt, reasonId });
    setBusy(false);
    if (outcome.kind === "session-expired") return goToSignIn(extensionsHref(assignmentId));
    setNote(extensionNote(outcome));
    if (outcome.kind === "zabiljezeno") {
      setDueLocal("");
      setReasonId("");
      router.refresh();
    }
  }

  return (
    <>
      <Card title={t.formTitle}>
        <form className={styles.form} onSubmit={submit} noValidate>
          <Select
            label={t.scope}
            value={scope}
            options={[...(canPickOne ? [{ value: "one", label: t.scopeOne }] : []), { value: "all", label: t.scopeAll }]}
            onChange={(e) => {
              const next = e.target.value === "one" ? "one" : "all";
              setScope(next);
              if (next === "one" && reasonId === "all") setReasonId("");
            }}
          />
          {students === null ? <p className={styles.hint}>{t.studentsUnavailable}</p> : null}
          {scope === "one" ? (
            <Select
              label={t.student}
              placeholder={t.studentPlaceholder}
              value={studentId}
              options={(students ?? []).map((s) => ({ value: s.studentId, label: s.name ?? t.unnamed }))}
              onChange={(e) => setStudentId(e.target.value)}
            />
          ) : null}
          <TextField
            label={t.due}
            hint={t.dueHint}
            type="datetime-local"
            value={dueLocal}
            onChange={(e) => setDueLocal(e.target.value)}
          />
          <Select
            label={t.reason}
            placeholder={t.reasonPlaceholder}
            value={reasonId}
            options={reasonOptions(scope)}
            onChange={(e) => setReasonId(e.target.value)}
          />
          {note !== null ? (
            <div role={note.tone} className={note.tone === "alert" ? styles.alert : styles.status}>
              {note.lines.map((line) => <p key={line}>{line}</p>)}
            </div>
          ) : null}
          <div className={styles.actions}>
            <Button type="submit" disabled={busy}>{busy ? t.saving : t.save}</Button>
          </div>
        </form>
      </Card>
      <Card title={t.listTitle}>
        {read.kind === "unavailable" ? (
          <p role="alert" className={styles.alert}>{t.unavailable}</p>
        ) : read.extensions.length === 0 ? (
          <p>{t.empty}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t.columns.who}</th>
                <th scope="col">{t.columns.due}</th>
                <th scope="col">{t.columns.previous}</th>
                <th scope="col">{t.columns.reason}</th>
                <th scope="col">{t.columns.when}</th>
              </tr>
            </thead>
            <tbody>
              {read.extensions.map((e) => (
                <tr key={e.id}>
                  <td>{whoOf(e, names)}</td>
                  <td>{formatDateTimeHr(e.dueAt)}</td>
                  <td>{formatDateTimeHr(e.previousDueAt)}</td>
                  <td>{e.reasonId === null ? t.reasonHidden : t.reasons[e.reasonId]}</td>
                  <td>{formatDateTimeHr(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
