"use client";

import { useId, useState, type FormEvent } from "react";

import buttonStyles from "../Button.module.css";
import { Button } from "../Button";
import { InertButton } from "../assistant-states/InertButton";
import { TextArea } from "../TextArea";
import { TextField } from "../TextField";
import styles from "./LegalHolds.module.css";

/** One active legal hold; `own` is true for a hold the signed-in administrator placed. */
export type LegalHold = {
  readonly id: string;
  readonly subject: string;
  readonly caseReference: string;
  /** Display text, already formatted. */
  readonly placedAt: string;
  readonly placedByName: string;
  readonly own: boolean;
};

export type LegalHoldsLabels = {
  title: string;
  lead: string;
  listTitle: string;
  empty: string;
  loading: string;
  retry: string;
  placedBy: (name: string, at: string) => string;
  reference: (caseReference: string) => string;
  placeTitle: string;
  subject: string;
  subjectHint: string;
  caseReference: string;
  caseReferenceHint: string;
  subjectMissing: string;
  caseReferenceMissing: string;
  place: string;
  placing: string;
  release: string;
  /** Why the placer cannot release their own hold; the disabled button points to it. */
  releaseOwn: string;
  releaseTitle: (subject: string) => string;
  reason: string;
  reasonHint: string;
  reasonMissing: string;
  confirmRelease: string;
  releasing: string;
  cancel: string;
};

export type LegalHoldsState =
  | { readonly kind: "loading" }
  /** `message` is the catalogue text for the server's answer, never a raw code. */
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "ready"; readonly holds: readonly LegalHold[] };

export type LegalHoldsProps = {
  labels: LegalHoldsLabels;
  state: LegalHoldsState;
  onPlace: (input: { subject: string; caseReference: string }) => void;
  onRelease: (id: string, reason: string) => void;
  onRetry?: () => void;
  /** A place or release call is running; the buttons wait. */
  busy?: boolean;
  /** The catalogue text of a refused place or release (e.g. 403); shown under the form. */
  actionError?: string;
};

function ReleaseForm({ hold, labels, busy, onRelease, onCancel }: {
  hold: LegalHold; labels: LegalHoldsLabels; busy: boolean; onRelease: (id: string, reason: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (reason.trim() === "") return setError(labels.reasonMissing);
    setError(undefined);
    onRelease(hold.id, reason.trim());
  };
  return (
    <form className={styles.form} onSubmit={submit} aria-label={labels.releaseTitle(hold.subject)} noValidate>
      <TextArea label={labels.reason} hint={labels.reasonHint} error={error} value={reason} rows={3} maxLength={500}
        onChange={(event) => { setReason(event.target.value); setError(undefined); }} autoFocus />
      <div className={styles.actions}>
        <Button type="submit" busy={busy}>{busy ? labels.releasing : labels.confirmRelease}</Button>
        <Button tone="quiet" onClick={onCancel}>{labels.cancel}</Button>
      </div>
    </form>
  );
}

/**
 * The institution's legal holds (M10.3, M10.7): the list of active holds, a form to place one
 * (subject and case reference) and the release of a hold with a reason. The administrator cannot
 * release a hold they placed themselves: that button stays focusable but inert, with the reason.
 */
export function LegalHolds({ labels, state, onPlace, onRelease, onRetry, busy = false, actionError }: LegalHoldsProps) {
  const [subject, setSubject] = useState("");
  const [caseReference, setCaseReference] = useState("");
  const [errors, setErrors] = useState<{ subject?: string; caseReference?: string }>({});
  const [releasing, setReleasing] = useState<string | null>(null);
  const ownNoteId = useId();

  const place = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = {
      ...(subject.trim() === "" ? { subject: labels.subjectMissing } : {}),
      ...(caseReference.trim() === "" ? { caseReference: labels.caseReferenceMissing } : {}),
    };
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onPlace({ subject: subject.trim(), caseReference: caseReference.trim() });
    setSubject("");
    setCaseReference("");
  };

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>{labels.title}</h2>
      <p className={styles.lead}>{labels.lead}</p>

      <section className={styles.section} aria-labelledby={`${ownNoteId}-list`}>
        <h3 id={`${ownNoteId}-list`} className={styles.heading}>{labels.listTitle}</h3>
        {state.kind === "loading" ? (
          <p role="status" className={styles.meta}>{labels.loading}</p>
        ) : state.kind === "error" ? (
          <div className={styles.fail}>
            <p role="alert" className={styles.alert}>{state.message}</p>
            {onRetry === undefined ? null : <Button tone="quiet" onClick={onRetry}>{labels.retry}</Button>}
          </div>
        ) : state.holds.length === 0 ? (
          <p className={styles.meta}>{labels.empty}</p>
        ) : (
          <ul className={styles.list}>
            {state.holds.map((hold) => (
              <li key={hold.id} className={styles.item}>
                <p className={styles.subject}>{hold.subject}</p>
                <p className={styles.meta}>{labels.reference(hold.caseReference)}</p>
                <p className={styles.meta}>{labels.placedBy(hold.placedByName, hold.placedAt)}</p>
                {releasing === hold.id ? (
                  <ReleaseForm hold={hold} labels={labels} busy={busy} onRelease={onRelease} onCancel={() => setReleasing(null)} />
                ) : hold.own ? (
                  <>
                    <InertButton tone="quiet" inert describedBy={`${ownNoteId}-${hold.id}`}>{labels.release}</InertButton>
                    <p id={`${ownNoteId}-${hold.id}`} className={styles.meta}>{labels.releaseOwn}</p>
                  </>
                ) : (
                  <Button tone="quiet" onClick={() => setReleasing(hold.id)}>{labels.release}</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby={`${ownNoteId}-place`}>
        <h3 id={`${ownNoteId}-place`} className={styles.heading}>{labels.placeTitle}</h3>
        <form className={styles.form} onSubmit={place} noValidate>
          <TextField label={labels.subject} hint={labels.subjectHint} error={errors.subject} value={subject} maxLength={200}
            onChange={(event) => setSubject(event.target.value)} />
          <TextField label={labels.caseReference} hint={labels.caseReferenceHint} error={errors.caseReference} value={caseReference} maxLength={100}
            onChange={(event) => setCaseReference(event.target.value)} />
          {actionError === undefined ? null : <p role="alert" className={styles.alert}>{actionError}</p>}
          <div className={styles.actions}>
            <button type="submit" className={buttonStyles.button} data-tone="primary" aria-disabled={busy || undefined} aria-busy={busy || undefined}>
              {busy ? labels.placing : labels.place}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
