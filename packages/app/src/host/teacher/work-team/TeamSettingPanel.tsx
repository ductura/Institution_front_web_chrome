"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Checkbox, RouteLoading, Select } from "@ductura/ui";

import type { createApi } from "@/client/api";
import { LoadAlert } from "../../states/States";
import { teacherTeamText as t } from "./messages.hr";
import { checkSetting, draftOf, SIZES, type SettingDraft, type SettingError } from "./model";
import { putSetting, readSetting, type Read, type Setting, type Write } from "./read";

type Api = ReturnType<typeof createApi>;

const FAILURE: Readonly<Record<Exclude<Write<Setting>["kind"], "done" | "signedOut">, string>> = {
  conflict: t.setting.conflict, notFound: t.setting.notFound, invalid: t.setting.invalid, unknown: t.setting.unknown,
};

/**
 * WEB-V19-GRUPA: "Postavka tima" of one assignment (institution.assignment-team-setting.get/put): on or off,
 * the smallest and largest size, and who forms the teams. The checks are the server's, repeated to spare a
 * round trip; a note of success follows only the server's answer (B-6) and the form is locked while it is
 * being sent. The setting is read again after any answer (the server may know something the page did not) and
 * `onChanged` tells the page whose teams depend on it. A standalone component, mounted by TeamsPage.
 */
export function TeamSettingPanel({ assignmentId, call, onSignedOut, onChanged }: {
  assignmentId: string; call: () => Api; onSignedOut: () => void; onChanged: (setting: Setting | null) => void;
}) {
  const [read, setRead] = useState<Read<Setting> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<SettingDraft | null>(null);
  const [error, setError] = useState<{ field: string; error: SettingError } | null>(null);
  const [note, setNote] = useState<{ tone: "status" | "alert"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void readSetting(call(), assignmentId).then((result) => {
      if (!live) return;
      if (result.kind === "signedOut") onSignedOut();
      setRead(result);
      if (result.kind === "ok") { setDraft(draftOf(result.value)); onChanged(result.value); } else onChanged(null);
    });
    return () => { live = false; };
    // `call`, `onSignedOut` and `onChanged` are stable per visit; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, assignmentId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || draft === null) return;
    setNote(null);
    const checked = checkSetting(draft);
    if (!checked.ok) { setError({ field: checked.field, error: checked.error }); return; }
    setError(null);
    setBusy(true);
    const outcome = await putSetting(call(), assignmentId, checked.value);
    if (outcome.kind === "signedOut") { setBusy(false); onSignedOut(); return; }
    setNote(outcome.kind === "done" ? { tone: "status", text: t.setting.saved } : { tone: "alert", text: FAILURE[outcome.kind] });
    // The form stays locked until the setting is read again, so a late answer cannot overwrite a newer edit.
    const fresh = await readSetting(call(), assignmentId);
    setBusy(false);
    if (fresh.kind === "signedOut") { onSignedOut(); return; }
    setRead(fresh);
    if (fresh.kind === "ok") { setDraft(draftOf(fresh.value)); onChanged(fresh.value); }
  }

  if (read === null || read.kind === "signedOut") return <Card level={2} title={t.setting.title}><RouteLoading label={t.setting.loading} /></Card>;
  if (read.kind !== "ok" || draft === null) {
    return (
      <Card level={2} title={t.setting.title}>
        <LoadAlert body={read.kind === "notFound" ? t.gone : t.setting.unavailable}
          retry={read.kind === "unavailable" ? { label: t.retry, onRetry: () => { setRead(null); setAttempt((n) => n + 1); } } : undefined} />
      </Card>
    );
  }
  const fieldError = (field: string) => (error?.field === field ? t.setting.errors[error.error] : undefined);
  const sizes = SIZES.map((n) => ({ value: String(n), label: String(n) }));
  return (
    <Card level={2} title={t.setting.title}>
      {note !== null && (note.tone === "alert" ? <LoadAlert body={note.text} /> : <p role="status">{note.text}</p>)}
      <form onSubmit={(event) => void save(event)} noValidate>
        <Checkbox label={t.setting.enabled} checked={draft.enabled} disabled={busy} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
        <Select label={t.setting.minSize} disabled={busy} value={draft.minSize} options={sizes} error={fieldError("minSize")} onChange={(e) => setDraft({ ...draft, minSize: e.target.value })} />
        <Select label={t.setting.maxSize} disabled={busy} value={draft.maxSize} options={sizes} error={fieldError("maxSize")} onChange={(e) => setDraft({ ...draft, maxSize: e.target.value })} />
        <Select label={t.setting.formation} disabled={busy} value={draft.formation}
          options={[{ value: "student_choice", label: t.setting.formationChoice }, { value: "teacher_assigned", label: t.setting.formationAssigned }]}
          onChange={(e) => setDraft({ ...draft, formation: e.target.value === "teacher_assigned" ? "teacher_assigned" : "student_choice" })} />
        <p><Button type="submit" busy={busy}>{busy ? t.setting.saving : t.setting.save}</Button></p>
      </form>
    </Card>
  );
}
