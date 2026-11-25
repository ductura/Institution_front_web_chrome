"use client";

// WEB-V16-OBRASCI: the "Obrasci i suglasnost" section of the shared "Završni rad" panel. The form's name is the
// server's `title`; the student sees the consent and cannot change it; every write shows its outcome as a message.
import { useState } from "react";

import { ActionRow, Button, Notice, Select, Tag, TextArea } from "@ductura/ui";

import { createApi } from "../../../../../../src/client/api";
import type { SectionViewProps, ThesisRole, ThesisSectionDef } from "../model";
import { allowedStates, COMMENT_MAX, setConsent, setFormState, type Outcome } from "./actions";
import { formsHr as t } from "./messages.hr";
import { readForms, type Call, type FormsValue, type FormState, type ThesisForm } from "./read";

const when = (iso: string | null) => (iso === null ? "" : new Date(iso).toLocaleDateString("hr-HR"));
export type Source = "form" | "consent";
export const say = (o: Outcome, source: Source) => (o === "saved" ? t.saved : o === "unchanged" ? (source === "consent" ? t.consentUnchanged : t.unchanged) : t[o]);

function FormRow({ form, role, documentId, call, onDone }: { form: ThesisForm; role: ThesisRole; documentId: string; call: Call; onDone: (o: Outcome, source: Source) => void }) {
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState<FormState>(form.state);
  const options = allowedStates(role, form.state);
  const run = async (state: FormState) => {
    setBusy(true);
    const o = await setFormState(call, documentId, role, form, state);
    setBusy(false);
    onDone(o, "form");
  };
  return (
    <li data-testid={`form-${form.code}`}>
      <strong>{form.title}</strong> <Tag tone={form.state === "accepted" ? "accent" : "neutral"}>{t.states[form.state]}</Tag>
      {form.changedByPart !== null && <small> {t.changedBy[form.changedByPart]} {when(form.changedAt)}</small>}
      {role === "student" && form.state === "accepted" && <p>{t.readOnlyAccepted}</p>}
      {role === "student" && options.length === 1 && (
        <Button tone="secondary" disabled={busy} onClick={() => void run(options[0]!)}>
          {options[0] === "submitted" ? t.markSubmitted : t.markNotSubmitted}
        </Button>
      )}
      {role === "mentor" && (
        <ActionRow>
          <Select label={t.stateSelect} value={next} onChange={(e) => setNext(e.target.value as FormState)}
            options={(["not_submitted", "submitted", "accepted"] as const).map((s) => ({ value: s, label: t.states[s] }))} />
          <Button tone="secondary" disabled={busy} onClick={() => void run(next)}>{t.setState}</Button>
        </ActionRow>
      )}
    </li>
  );
}

function Consent({ value, role, documentId, call, onDone }: { value: FormsValue["consent"]; role: ThesisRole; documentId: string; call: Call; onDone: (o: Outcome, source: Source) => void }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (given: boolean) => {
    setBusy(true);
    const o = await setConsent(call, documentId, role, value.state, given, comment);
    setBusy(false);
    if (o === "saved") setComment("");
    onDone(o, "consent");
  };
  return (
    <div data-testid="consent">
      <h4>{t.consentHeading}</h4>
      <p><Tag>{t.consentStates[value.state]}</Tag> {value.requiredForSubmission ? t.consentRequired : t.consentOptional}</p>
      {value.comment !== null && <p>{value.comment}</p>}
      {role === "mentor" && (
        <>
          <TextArea label={t.consentComment} hint={t.consentCommentHint} value={comment} maxLength={COMMENT_MAX + 1}
            error={comment.trim().length > COMMENT_MAX ? t.commentTooLong : undefined} onChange={(e) => setComment(e.target.value)} />
          <ActionRow>
            <Button disabled={busy || value.state === "given"} onClick={() => void run(true)}>{t.give}</Button>
            <Button tone="secondary" disabled={busy || value.state !== "given"} onClick={() => void run(false)}>{t.withdraw}</Button>
          </ActionRow>
        </>
      )}
      <h5>{t.history}</h5>
      {value.history.length === 0 ? <p>{t.noHistory}</p> : (
        <ul>
          {value.history.map((h, i) => (
            <li key={`${h.changedAt}-${i}`}>{h.given ? t.historyGiven : t.historyWithdrawn} {when(h.changedAt)}{h.comment !== null ? `: ${h.comment}` : ""}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FormsView({ documentId, role, value: first, reload, call = createApi() }: SectionViewProps<FormsValue> & { call?: Call }) {
  const [value, setValue] = useState(first);
  const [message, setMessage] = useState<string | null>(null);
  const done = (o: Outcome, source: Source) => {
    setMessage(say(o, source));
    // After a write the truth is the server's: read again here, so the view stays mounted and keeps its message;
    // if that read gives nothing usable, the frame reloads the whole section.
    if (o !== "saved" && o !== "conflict") return;
    void readForms(call, documentId).then((r) => { if (r.kind === "ready") setValue(r.value); else reload(); }, () => reload());
  };
  return (
    <div>
      <h4>{t.formsHeading}</h4>
      {value.forms.length === 0 ? <p>{t.noForms}</p> : (
        <ul>{value.forms.map((f) => <FormRow key={f.code} form={f} role={role} documentId={documentId} call={call} onDone={done} />)}</ul>
      )}
      <p><small>{t.stateNote}</small></p>
      <Consent value={value.consent} role={role} documentId={documentId} call={call} onDone={done} />
      {message !== null && <Notice tone={message === t.saved || message === t.unchanged || message === t.consentUnchanged ? "info" : "warn"}>{message}</Notice>}
    </div>
  );
}

export const section: ThesisSectionDef<FormsValue> = {
  id: "forms",
  order: 20,
  title: t.title,
  read: (documentId) => readForms(createApi(), documentId),
  View: (props) => <FormsView {...props} />,
};
