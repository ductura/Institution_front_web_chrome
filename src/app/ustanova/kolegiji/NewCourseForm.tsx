"use client";

import { Button, Card, Select, TextArea, TextField } from "@ductura/ui";
import { useRef, useState } from "react";

import { createApi, goToSignIn } from "@/client/api";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { AI_POLICIES, createOutcome, newCourseInput, type CreateOutcome, type FieldErrors, type NewCourseFields } from "./new-course";
import styles from "./page.module.css";

const t = messagesHr.institutionCourses.newCourse;
const policies = messagesHr.facultyRuleVersions.policies;
const POLICY_OPTIONS = AI_POLICIES.map((value) => ({ value, label: policies[value] }));

type Created = { readonly name: string; readonly groups: readonly string[] };

/**
 * WEB-20: the administrator's "Novi kolegij" form. The body goes to
 * institution.admin-courses.post through src/client only; the server decides
 * whether the caller is the institution's administrator and the holder its
 * teacher. No <form> element: nothing is sent except through createApi.
 */
export default function NewCourseForm({ here, years }: { here: string; years: readonly string[] }) {
  const empty: NewCourseFields = { name: "", academicYear: years[0] ?? "", aiPolicy: "prohibited", holderId: "", groups: "" };
  const [fields, setFields] = useState(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Exclude<CreateOutcome, "created"> | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  // After "another" the button is gone; focus returns to the first field.
  const formRef = useRef<HTMLDivElement>(null);
  const set = (key: keyof NewCourseFields) => (event: { target: { value: string } }) =>
    setFields((now) => ({ ...now, [key]: event.target.value }));

  async function submit() {
    if (busy) return;
    const read = newCourseInput(fields);
    setOutcome(null);
    if (!read.ok) {
      setErrors(read.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await createApi()("institution.admin-courses.post", { params: undefined, query: undefined, body: read.input })
      .catch(() => ({ ok: false, status: 0, code: "unexpected" }) as const);
    setBusy(false);
    const next = createOutcome(result);
    if (next === "created" && result.ok) {
      setCreated({ name: read.input.name, groups: result.body.groups.map((group) => group.name) });
      return;
    }
    if (next === "signedOut") goToSignIn(here);
    setOutcome(next === "created" ? "unavailable" : next);
  }

  if (created !== null) {
    return (
      <div className={styles.done}>
        <p role="status">{t.created.replace("{name}", created.name)}</p>
        <Card title={t.createdGroups} empty={t.createdNoGroups}>
          {created.groups.length > 0 && <ul>{created.groups.map((group) => <li key={group}>{group}</li>)}</ul>}
        </Card>
        <Button tone="quiet" onClick={() => { setCreated(null); setFields(empty); requestAnimationFrame(() => formRef.current?.querySelector("input")?.focus()); }}>
          {t.another}
        </Button>
      </div>
    );
  }

  const error = (key: keyof FieldErrors) => (errors[key] === undefined ? undefined : t[errors[key]]);
  return (
    <div ref={formRef} className={styles.form} aria-busy={busy || undefined}
      onKeyDown={(event) => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) void submit(); }}>
      <TextField label={t.name} value={fields.name} onChange={set("name")} busy={busy}
        maxLength={160} autoComplete="off" error={error("name")} />
      <Select label={t.academicYear} value={fields.academicYear} onChange={set("academicYear")} busy={busy}
        options={years.map((year) => ({ value: year, label: year }))} />
      <Select label={t.aiPolicy} value={fields.aiPolicy} onChange={set("aiPolicy")} busy={busy} options={POLICY_OPTIONS} />
      <TextField label={t.holder} hint={t.holderHint} value={fields.holderId} onChange={set("holderId")} busy={busy}
        spellCheck={false} autoComplete="off" error={error("holderId")} />
      <TextArea label={t.groups} hint={t.groupsHint} value={fields.groups} onChange={set("groups")} busy={busy}
        error={error("groups")} />
      {outcome !== null && <p role="alert" className={styles.alert}>{t[outcome]}</p>}
      <div>
        <Button busy={busy} onClick={() => void submit()}>{busy ? t.busy : t.submit}</Button>
      </div>
    </div>
  );
}
