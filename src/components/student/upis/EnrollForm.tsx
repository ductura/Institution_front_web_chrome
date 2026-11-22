"use client";

import { Button, Dialog, TextField } from "@ductura/ui";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { messagesHr as t } from "@/lib/i18n/messages.hr";

import { courseHref } from "./course-read";
import { enroll, type EnrollResult } from "./enroll";
import styles from "./Enroll.module.css";

const e = t.student.enroll;

/** The text under the field for a refused attempt; null when the result is not an error. */
export function enrollError(result: EnrollResult | null): string | null {
  if (result === null || "courseId" in result) return null;
  const { kind } = result;
  return kind === "invalidCode" || kind === "expiredCode" || kind === "signedOut" ? e.codeErrors[kind] : e.errors[kind];
}

/**
 * E-5 (WEB-11): the code field and its seven states: entry, sending, a code
 * that does not exist, an expired code, already enrolled (PD-5), a course
 * without an assignment (PD-6) and the enrollment, which opens the notice.
 */
export default function EnrollForm({ signInHref, navigate, initialCode = "" }: {
  /** E-2 R-10: the code the home carried over; the field starts filled and takes the focus (R-17). */
  initialCode?: string;
  signInHref: string;
  /** Where the form goes next; by default the Next router (the app host passes one that adds its base). */
  navigate?: (href: string, replace?: boolean) => void;
}) {
  const router = useRouter();
  const go = navigate ?? ((href: string, replace = false) => (replace ? router.replace(href) : router.push(href)));
  const [code, setCode] = useState(initialCode);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<EnrollResult | null>(null);
  const busy = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    const next = await enroll(code);
    setResult(next);
    // PRODUCT §5 rule 6: the next screen is the notice of the open assignment.
    if (next.kind === "enrolled") {
      go(courseHref(next.courseId), true);
      return;
    }
    busy.current = false;
    setSending(false);
  }

  // The code stays in the field, so the submit button stays enabled and the
  // dialog can give the focus back to it.
  function again() {
    setResult(null);
  }

  if (result?.kind === "enrolled") return <p className={styles.status} role="status">{e.opening}</p>;
  const error = enrollError(result);
  return (
    // No `name` on the field: a submit before hydration must not put the code in the URL.
    <form className={styles.form} onSubmit={submit} aria-busy={sending || undefined}>
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
        autoFocus={initialCode === "" ? undefined : true}
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <Button type="submit" busy={sending} disabled={!sending && !code.trim()}>{sending ? e.sending : e.submit}</Button>
      {result?.kind === "signedOut" ? <p><a href={signInHref}>{t.student.signIn}</a></p> : null}
      <Dialog
        open={result?.kind === "alreadyEnrolled"}
        title={e.already.title}
        onClose={again}
        actions={
          <>
            <Button tone="quiet" onClick={again}>{e.already.close}</Button>
            <Button onClick={() => result && "courseId" in result && go(courseHref(result.courseId))}>
              {e.already.open}
            </Button>
          </>
        }
      >
        <p>{e.already.body}</p>
      </Dialog>
      <Dialog
        open={result?.kind === "noAssignment"}
        title={e.empty.title}
        onClose={again}
        actions={
          <>
            <Button tone="quiet" onClick={again}>{e.empty.close}</Button>
            <Button onClick={() => go("/zadaci")}>{e.empty.assignments}</Button>
          </>
        }
      >
        <p>{e.empty.body}</p>
      </Dialog>
    </form>
  );
}
