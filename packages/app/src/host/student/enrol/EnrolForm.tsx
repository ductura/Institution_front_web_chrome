"use client";

// E-5 as the prototype has it: the seven states are inline (no dialogs), the
// code can arrive in ?kod (R-10) and the field takes the focus (R-17).
import { Button, TextField } from "@ductura/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { courseHref } from "../../../../../../src/components/student/upis/course-read.ts";
import { enroll, type EnrollResult } from "../../../../../../src/components/student/upis/enroll.ts";
import { enrollError } from "../../../../../../src/components/student/upis/EnrollForm.tsx";
import styles from "../../../../../../src/components/student/upis/Enroll.module.css";
import { messagesHr as t } from "../../../../../../src/lib/i18n/messages.hr.ts";

import { enrolText } from "./messages.hr";
import { codeFromQuery } from "./model";

const e = t.student.enroll;

export default function EnrolForm({ signInHref, navigate }: {
  signInHref: string;
  navigate: (href: string, replace?: boolean) => void;
}) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<EnrollResult | null>(null);
  const busy = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const preset = codeFromQuery(window.location.search);
    if (preset) setCode(preset);
    form.current?.querySelector("input")?.focus({ preventScroll: true });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    const next = await enroll(code);
    setResult(next);
    if (next.kind === "enrolled") {
      navigate(courseHref(next.courseId), true);
      return;
    }
    busy.current = false;
    setSending(false);
  }

  if (result?.kind === "enrolled") return <p className={styles.status} role="status">{e.opening}</p>;
  const error = enrollError(result);
  const courseId = result && "courseId" in result ? result.courseId : null;
  return (
    <form ref={form} className={styles.form} onSubmit={submit} aria-busy={sending || undefined}>
      <TextField
        className={styles.field}
        label={e.label}
        hint={e.hint}
        error={error ?? undefined}
        busy={sending}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={64}
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <Button type="submit" busy={sending} disabled={!sending && !code.trim()}>
        {sending ? e.sending : e.submit}
      </Button>
      {sending ? <p className={styles.status} role="status">{enrolText.sendingStatus}</p> : null}
      {result?.kind === "signedOut" ? <p><a href={signInHref}>{t.student.signIn}</a></p> : null}
      {result?.kind === "alreadyEnrolled" && courseId ? (
        <div className={styles.links}>
          <p className={styles.status} role="status">{enrolText.alreadyEnrolled}</p>
          <Button onClick={() => navigate(courseHref(courseId))}>{enrolText.openAssignment}</Button>
        </div>
      ) : null}
      {result?.kind === "noAssignment" ? (
        <div className={styles.links}>
          <p className={styles.status} role="status">{enrolText.noAssignment}</p>
          <Button tone="quiet" onClick={() => { setResult(null); setCode(""); }}>{enrolText.another}</Button>
        </div>
      ) : null}
    </form>
  );
}
