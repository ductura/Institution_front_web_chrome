"use client";

import { ActionRow, Button, TextArea } from "@ductura/ui";
import { useEffect, useMemo, useState } from "react";

import { createApi, goToSignIn } from "@/client/api";
import { appHref } from "@/components/shell/nav";

import { useHost } from "../../context";
import { declarationQuestionHr as t } from "./messages.hr";

type Call = ReturnType<typeof createApi>;

/** OD-4: the question's limit in declaration-v1 (Unicode code points), named. */
export const DECLARATION_QUESTION_MAX_CHARS = 500;

export type QuestionProblem = "tooLong" | "invalid";
export type QuestionOutcome = "saved" | "none" | "signedOut" | "invalid" | "failed";
export type QuestionRead = { kind: "ready"; question: string | null } | { kind: "signedOut" | "unavailable" };

const codePoints = (text: string) => Array.from(text).length;
// Control characters other than the line feed are refused by declaration-v1.
const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/;

/** The text as the route takes it (NFC, no leading or trailing space); empty means "no question" (null). */
export function normalizeQuestion(text: string): string | null {
  const clean = text.normalize("NFC").trim();
  return clean === "" ? null : clean;
}

/** What is wrong with the text, if anything; empty text is fine (no question). */
export function checkQuestion(text: string): QuestionProblem | null {
  const clean = normalizeQuestion(text);
  if (clean === null) return null;
  if (CONTROL.test(clean)) return "invalid";
  return codePoints(clean) > DECLARATION_QUESTION_MAX_CHARS ? "tooLong" : null;
}

/** teacher.declaration-question.get; a refusal or an unexpected answer is "unavailable", never "no question". */
export async function readQuestion(call: Call, assignmentId: string): Promise<QuestionRead> {
  try {
    const result = await call("teacher.declaration-question.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!result.ok) return result.status === 401 ? { kind: "signedOut" } : { kind: "unavailable" };
    return { kind: "ready", question: result.body.question };
  } catch {
    return { kind: "unavailable" };
  }
}

/**
 * teacher.declaration-question.put. "none": a new assignment with no question, nothing sent. "saved" only when the
 * server's answer repeats what was sent (B-6).
 */
export async function saveQuestion(call: Call, assignmentId: string, text: string, opts: { skipEmpty?: boolean } = {}): Promise<QuestionOutcome> {
  const question = normalizeQuestion(text);
  if (question === null && opts.skipEmpty === true) return "none";
  if (checkQuestion(text) !== null) return "invalid";
  try {
    const result = await call("teacher.declaration-question.put", { params: { assignmentId }, query: undefined, body: { question } });
    if (!result.ok) return result.status === 401 ? "signedOut" : result.status === 422 ? "invalid" : "failed";
    return result.body.question === question ? "saved" : "failed";
  } catch {
    return "failed";
  }
}

/** NF-4 NZ-15: the controlled field beside the declaration; the form saves it after publishing, the edit page by its own button. */
export function QuestionField({ prefix = "zs", value, onChange, disabled = false }: {
  prefix?: string; value: string; onChange: (next: string) => void; disabled?: boolean;
}) {
  const problem = checkQuestion(value);
  const max = DECLARATION_QUESTION_MAX_CHARS.toLocaleString("hr-HR");
  return (
    <div data-nf4="NZ-15">
      <TextArea name={`${prefix}-question`} label={t.label} value={value} disabled={disabled} rows={undefined}
        onChange={(event) => onChange(event.target.value)}
        hint={t.hint.replace("{max}", max)}
        {...(problem ? { error: t.errors[problem].replace("{max}", max) } : {})} />
    </div>
  );
}

/** The same field on the edit page (/uredi), read from and saved to the server; "spremljeno" follows only its answer. */
export function QuestionLive({ assignmentId, client }: { assignmentId: string; client?: Call }) {
  const { base } = useHost();
  const call = useMemo(() => client ?? createApi(), [client]);
  const [read, setRead] = useState<QuestionRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "status" | "alert"; text: string } | null>(null);
  const here = `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/uredi`;

  useEffect(() => {
    let live = true;
    void readQuestion(call, assignmentId).then((answer) => {
      if (!live) return;
      if (answer.kind === "signedOut") goToSignIn(appHref(base, here));
      setRead(answer);
      if (answer.kind === "ready") { setSaved(answer.question ?? ""); setText(answer.question ?? ""); }
    });
    return () => { live = false; };
  }, [call, assignmentId, attempt, base, here]);

  async function save() {
    if (busy || checkQuestion(text) !== null) return;
    setBusy(true);
    setNote(null);
    const outcome = await saveQuestion(call, assignmentId, text);
    setBusy(false);
    if (outcome === "signedOut") return goToSignIn(appHref(base, here));
    if (outcome === "saved") { const next = normalizeQuestion(text) ?? ""; setSaved(next); setText(next); setNote({ tone: "status", text: t.live.saved }); return; }
    setNote({ tone: "alert", text: outcome === "invalid" ? t.live.invalid : t.live.notSaved });
  }

  if (read === null) return <p role="status" className="meta">{t.live.loading}</p>;
  if (read.kind !== "ready") {
    return (
      <section className="card" aria-label={t.label}>
        <p role="alert">{t.live.unavailable}</p>
        <Button type="button" tone="secondary" onClick={() => { setRead(null); setAttempt((n) => n + 1); }}>{t.live.retry}</Button>
      </section>
    );
  }
  const changed = (normalizeQuestion(text) ?? "") !== saved;
  return (
    <div className="card">
      <QuestionField prefix="live" value={text} disabled={busy} onChange={(next) => { setNote(null); setText(next); }} />
      {note ? <p className="note" role={note.tone === "alert" ? "alert" : "status"}>{note.text}</p> : null}
      <ActionRow>
        <Button type="button" disabled={!changed || busy || checkQuestion(text) !== null} onClick={() => void save()}>{t.live.save}</Button>
      </ActionRow>
    </div>
  );
}
