"use client";

// E-5 as the prototype has it: the seven states are inline (no dialogs), the
// code can arrive in ?kod (R-10) and the field takes the focus (R-17).
import { Button, CodeField } from "@ductura/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { courseHref } from "../../../../../../src/components/student/upis/course-read.ts";
import { enroll, type EnrollResult } from "../../../../../../src/components/student/upis/enroll.ts";
import { messagesHr as t } from "../../../../../../src/lib/i18n/messages.hr.ts";

import styles from "./Enrol.module.css";
import { enrolText } from "./messages.hr";
import { codeFromQuery, enrolError } from "./model";

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

  const heading = <h1 id="up-h">{e.heading}</h1>;
  if (result?.kind === "enrolled") {
    return <section className={styles.card}>{heading}<p className={styles.meta} role="status">{e.opening}</p></section>;
  }
  const courseId = result && "courseId" in result ? result.courseId : null;
  // PD-5: the card is only the sentence and the button; the heading stays for assistive technology.
  if (result?.kind === "alreadyEnrolled" && courseId) {
    return (
      <section className={styles.card}>
        <h1 className={styles.hidden}>{e.heading}</h1>
        <p className={styles.note} role="status">{enrolText.alreadyEnrolled}</p>
        <Button onClick={() => navigate(courseHref(courseId))}>{enrolText.openAssignment}</Button>
      </section>
    );
  }
  // PD-6: enrolled, but no open assignment yet.
  if (result?.kind === "noAssignment") {
    return (
      <section className={styles.card}>
        <h1 className={styles.hidden}>{e.heading}</h1>
        <p className={styles.note} role="status">{enrolText.noAssignment}</p>
        <a className={styles.link} href="#" onClick={(event) => { event.preventDefault(); setResult(null); setCode(""); }}>{enrolText.another}</a>
      </section>
    );
  }
  const error = enrolError(result);
  return (
    <section className={styles.card} aria-labelledby="up-h" aria-busy={sending || undefined}>
      {heading}
      <form ref={form} className={styles.form} onSubmit={submit} noValidate>
        <CodeField
          label={e.label}
          hint={e.hint}
          error={error ?? undefined}
          busy={sending}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={64}
          placeholder="KOD-KOLEGIJA"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          action={(
            <Button type="submit" busy={sending} disabled={!sending && !code.trim()}>
              {sending ? e.sending : e.submit}
            </Button>
          )}
        />
        {sending ? <p className={styles.meta} role="status">{enrolText.sendingStatus}</p> : null}
        {result?.kind === "signedOut" ? <p><a href={signInHref}>{t.student.signIn}</a></p> : null}
      </form>
    </section>
  );
}
