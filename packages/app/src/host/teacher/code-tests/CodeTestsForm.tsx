"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, RouteLoading, TextArea, TextField } from "@ductura/ui";

import { codeTestsText as t } from "./messages.hr";
import {
  byteLength, checkDraft, draftOf, emptyRow, isChanged, MAX_TESTS, MAX_TITLE, studentView,
  type CodeTestsView, type FormError, type RowDraft,
} from "./model";
import type { CodeTestsPort, ReadResult, WriteResult } from "./port";

type Note = { tone: "status" | "alert"; text: string };

const WRITE_FAILURE: Readonly<Record<Exclude<WriteResult["kind"], "done" | "signedOut">, string>> = {
  notFound: t.writeFailure.notFound, invalid: t.writeFailure.invalid, forbidden: t.writeFailure.forbidden, unknown: t.writeFailure.unknown,
};

/**
 * WEB-V21-KOD-TESTOVI-OBRAZAC: the teacher's form of the code tests of one assignment (teacher.assignment-code-tests.get/put).
 * Loading, failure and "no tests" are three different states; another course's task is "not available" (404), never an
 * empty form. A save is sent only when the checks pass, the form is locked while it is sent, and a note of success
 * follows only the server's answer. A failed save keeps what the teacher typed. The preview shows what the student sees.
 * A standalone component, mounted by CodeTestsPage; the link to it from the task's card is outside this lane.
 */
export function CodeTestsForm({ assignmentId, port, onSignedOut }: { assignmentId: string; port: CodeTestsPort; onSignedOut: () => void }) {
  const [read, setRead] = useState<ReadResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [rows, setRows] = useState<RowDraft[]>([]);
  const [error, setError] = useState<FormError | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void port.read(assignmentId).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") onSignedOut();
      setRead(result);
      if (result.kind === "ok") setRows(draftOf(result.view));
    });
    return () => { live = false; };
    // `port` and `onSignedOut` are stable per visit; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, assignmentId]);

  if (read === null || read.kind === "signedOut") return <Card level={2} title={t.title}><RouteLoading label={t.loading} /></Card>;
  if (read.kind !== "ok") {
    return (
      <Card level={2} title={t.title}>
        <p role="alert">{read.kind === "notFound" ? t.gone : t.unavailable}</p>
        {read.kind === "unavailable" && <p><Button tone="quiet" onClick={() => { setRead(null); setAttempt((n) => n + 1); }}>{t.retry}</Button></p>}
      </Card>
    );
  }
  const saved: CodeTestsView = read.view;
  const changed = isChanged(rows, saved);
  const rowError = (index: number, field: "title" | "input" | "expected") =>
    error?.kind === "row" && error.index === index && error.field === field ? t.errors[field] : undefined;
  const setRow = (index: number, patch: Partial<RowDraft>) => setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setNote(null);
    const checked = checkDraft(rows);
    if (!checked.ok) { setError(checked.error); return; }
    setError(null);
    setBusy(true);
    const outcome = await port.write(assignmentId, checked.value);
    setBusy(false);
    if (outcome.kind === "signedOut") { onSignedOut(); return; }
    if (outcome.kind !== "done") { setNote({ tone: "alert", text: WRITE_FAILURE[outcome.kind] }); return; }
    setRead({ kind: "ok", view: outcome.view });
    setRows(draftOf(outcome.view));
    setNote({ tone: "status", text: t.saved });
  }

  const sizeNow = (() => { const c = checkDraft(rows); return c.ok ? byteLength(c.value) : null; })();
  const seen = studentView(rows);
  return (
    <>
      <Card level={2} title={t.title}>
        {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
        <p>{t.language} · <span data-testid="revision">{t.revision.replace("{n}", String(saved.revisionNo))}</span></p>
        <p>{t.limits.replace("{max}", String(MAX_TESTS))}</p>
        <p data-testid="count">{t.count.replace("{n}", String(rows.length)).replace("{max}", String(MAX_TESTS))}{sizeNow !== null && ` · ${t.size.replace("{n}", String(sizeNow))}`}</p>
        {error?.kind === "count" && <p role="alert">{t.errors.count}</p>}
        {error?.kind === "size" && <p role="alert">{t.errors.size}</p>}
        {rows.length === 0 && <p data-testid="no-tests">{t.empty}</p>}
        <form onSubmit={(event) => void save(event)} noValidate>
          {rows.map((row, index) => (
            <fieldset key={row.key} disabled={busy} data-testid="test-row">
              <legend>{t.test.group.replace("{n}", String(index + 1))}</legend>
              <TextField label={t.test.title} value={row.title} maxLength={MAX_TITLE} error={rowError(index, "title")} onChange={(e) => setRow(index, { title: e.target.value })} />
              <TextArea label={t.test.input} value={row.input} error={rowError(index, "input")} spellCheck={false} onChange={(e) => setRow(index, { input: e.target.value })} />
              <TextArea label={t.test.expected} value={row.expected} error={rowError(index, "expected")} spellCheck={false} onChange={(e) => setRow(index, { expected: e.target.value })} />
              <Button type="button" tone="quiet" aria-label={t.test.remove.replace("{n}", String(index + 1))}
                onClick={() => setRows(rows.filter((_, i) => i !== index))}>{t.test.remove.replace("{n}", String(index + 1))}</Button>
            </fieldset>
          ))}
          <p>
            <Button type="button" tone="secondary" disabled={busy || rows.length >= MAX_TESTS} onClick={() => setRows([...rows, emptyRow(rows)])}>{t.add}</Button>
            {rows.length >= MAX_TESTS && <span data-testid="add-limit"> {t.addLimit}</span>}
          </p>
          <p>
            <Button type="submit" busy={busy} disabled={!changed}>{busy ? t.saving : t.save}</Button>
            {changed && <Button type="button" tone="quiet" disabled={busy} onClick={() => { setRows(draftOf(saved)); setError(null); }}>{t.reset}</Button>}
          </p>
        </form>
      </Card>
      <Card level={2} title={t.preview.title}>
        <p>{t.preview.lead}</p>
        {seen.length === 0 ? <p>{t.preview.none}</p> : (
          <ol data-testid="preview">
            {seen.map((s, i) => (
              <li key={i}><strong>{s.title}</strong> <code>{t.preview.input}: {s.input}</code> <code>{t.preview.expected}: {s.expected}</code></li>
            ))}
          </ol>
        )}
        <p>{t.preview.note}</p>
      </Card>
    </>
  );
}
