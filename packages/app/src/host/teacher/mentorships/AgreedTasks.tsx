"use client";

// F4-MEN-R03: the tasks agreed at the latest consultation, under "Dogovoreno na konzultacijama" on N-16. The
// mentor adds a task and ticks it done or not done; the box shows only what the server answered, and a task
// the server did not confirm keeps its old state (or, when added, stays in the field). The student reads the
// same list in "Priprema za konzultacije" and never ticks it.
import { Button, Checkbox, TextField } from "@ductura/ui";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import {
  MAX_TASKS, addTask, markTask, readTasks, taskTextProblem, tasksCall, tasksOf,
  type AgreedTask, type TaskFailure, type TasksCall,
} from "./agreed-tasks";
import { mentorPlanText } from "./messages.hr";

const t = mentorPlanText.agreed.taskList;
type Note = { tone: "status" | "alert"; text: string };

function failureText(kind: TaskFailure, fallback: string): string {
  switch (kind) {
    case "forbidden": return t.forbidden;
    case "notFound": return t.notFound;
    case "invalid": return t.invalid;
    default: return fallback;
  }
}

export function AgreedTasks({ documentId, recordId, onSignedOut, call = tasksCall }: {
  documentId: string; recordId: string; onSignedOut: () => void; call?: () => TasksCall;
}) {
  const [tasks, setTasks] = useState<readonly AgreedTask[] | null | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const inFlight = useRef(false);
  const headingId = useId();

  useEffect(() => {
    let live = true;
    setTasks(undefined);
    void readTasks(call(), documentId).then((read) => {
      if (!live) return;
      if (read.kind === "signedOut") { onSignedOut(); return; }
      setTasks(read.kind === "read" ? tasksOf(read.tasks, recordId) : null);
    });
    return () => { live = false; };
  }, [call, documentId, recordId, attempt, onSignedOut]);

  async function run(key: string, send: () => ReturnType<typeof addTask>, saved: (task: AgreedTask) => void, fallback: string) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(key);
    setNote(null);
    const outcome = await send();
    inFlight.current = false;
    setBusy(null);
    if (outcome.kind === "signedOut") { onSignedOut(); return false; }
    if (outcome.kind !== "saved") { setNote({ tone: "alert", text: failureText(outcome.kind, fallback) }); return false; }
    saved(outcome.task);
    return true;
  }

  async function add() {
    const problem = taskTextProblem(draft);
    if (problem !== null) { setError(problem === "blank" ? t.blank : t.long); return; }
    setError(undefined);
    const text = draft.trim();
    const done = await run("add", () => addTask(call(), documentId, recordId, text), (task) => {
      setTasks((list) => tasksOf([...(list ?? []).filter((x) => x.id !== task.id), task], recordId));
    }, t.addFailed);
    if (done) { setDraft(""); setNote({ tone: "status", text: t.added }); }
  }

  function mark(task: AgreedTask) {
    void run(task.id, () => markTask(call(), documentId, task.id, !task.done), (saved) => {
      setTasks((list) => (list ?? []).map((x) => (x.id === saved.id ? saved : x)));
    }, t.markFailed);
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") { event.preventDefault(); void add(); }
  }

  const full = tasks !== null && tasks !== undefined && tasks.length >= MAX_TASKS;
  return (
    <section aria-labelledby={headingId} aria-busy={tasks === undefined || busy !== null}>
      <h3 id={headingId}>{t.title}</h3>
      {tasks === undefined && <p role="status">{t.loading}</p>}
      {tasks === null && (
        <>
          <p role="alert">{t.unavailable}</p>
          <p><Button tone="quiet" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button></p>
        </>
      )}
      {tasks && tasks.length === 0 && <p>{t.empty}</p>}
      {tasks && tasks.length > 0 && (
        <ul data-testid="agreed-tasks">
          {tasks.map((task) => (
            <li key={task.id}>
              <Checkbox label={task.text} checked={task.done} disabled={busy !== null} onChange={() => mark(task)} />
            </li>
          ))}
        </ul>
      )}
      {tasks && !full && (
        <>
          <TextField label={t.field} hint={t.hint} error={error} value={draft} busy={busy === "add"}
            onChange={(event) => setDraft(event.target.value)} onKeyDown={onKey} />
          <p><Button onClick={() => void add()} disabled={busy !== null}>{t.add}</Button></p>
        </>
      )}
      {full && <p>{t.full}</p>}
      {note && <p role={note.tone}>{note.text}</p>}
    </section>
  );
}
