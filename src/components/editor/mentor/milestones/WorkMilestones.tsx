"use client";

import { Button, Details, Dialog, TextField } from "@ductura/ui";
import { useRef, useState } from "react";

import { readWorkMilestones, saveWorkMilestoneDue, type WorkMilestone } from "@/client/work-milestones";
import { zagrebParts } from "@/components/summary/zagreb-time";
import { zagrebInstant, zagrebLocalMinute } from "@/lib/i18n/zagreb";

import { workMilestonesHr as t } from "./messages.hr";
import styles from "./WorkMilestones.module.css";
import { useMentorRead, type MentorAccess } from "./useMentorRead";

export function WorkMilestones({ mayEditDue, ...access }: MentorAccess & { mayEditDue: boolean }) {
  const { data, setData, status, retry } = useMentorRead(readWorkMilestones, access);
  const [edit, setEdit] = useState<WorkMilestone | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const milestones = data?.milestones ?? [];
  const approved = milestones.filter((item) => item.state === "approved").length;
  const heading = data ? t.progress.replace("{approved}", String(approved)).replace("{total}", String(milestones.length)) : t.heading;

  const begin = (milestone: WorkMilestone) => {
    setEdit(milestone);
    setDraft(milestone.dueAt === null ? "" : zagrebLocalMinute(milestone.dueAt));
    setError(undefined);
  };

  const save = async () => {
    if (!edit || !mayEditDue || inFlight.current || !access.current()) return;
    // Keeping a displayed minute unchanged must also preserve the original offset and seconds.
    const original = edit.dueAt;
    if (original !== null && draft === zagrebLocalMinute(original)) {
      setEdit(null);
      return;
    }
    const dueAt = zagrebInstant(draft);
    if (dueAt === null) { setError(t.invalidDue); return; }
    inFlight.current = true;
    setSaving(true);
    setError(undefined);
    const result = await saveWorkMilestoneDue(access.documentId, edit.id, dueAt).catch(() => null);
    inFlight.current = false;
    if (!access.current()) return;
    setSaving(false);
    if (result?.ok) {
      const saved = result.body;
      setData((list) => list && { milestones: list.milestones.map((item) => item.id === edit.id ? saved : item) });
      setEdit(null);
    } else if (result?.status === 401) {
      access.onSessionEnd();
    } else {
      setError(result?.status === 409 ? t.rejected : t.failed);
    }
  };

  return <Details summary={heading}>
    {status === "loading" && <p role="status">{t.loading}</p>}
    {(status === "unavailable" || status === "notFound") && <p role="alert">{t.unavailable}</p>}
    {status === "unavailable" && <Button tone="quiet" onClick={retry}>{t.retry}</Button>}
    {status === "ready" && milestones.length === 0 && <p>{t.empty}</p>}
    {milestones.length > 0 && <ol className={styles.list}>
      {milestones.map((item) => {
        const parts = item.dueAt === null ? null : zagrebParts(item.dueAt);
        return <li key={item.id}>
          <strong>{item.title}</strong> · {t.state[item.state]}
          {item.description && <p>{item.description}</p>}
          <p>{parts ? <time dateTime={item.dueAt ?? undefined}>{parts.date} {parts.time}</time> : t.noDue}</p>
          {mayEditDue && <Button tone="quiet" onClick={() => begin(item)}>{item.dueAt === null ? t.addDue : t.changeDue}</Button>}
        </li>;
      })}
    </ol>}
    <Dialog open={edit !== null && mayEditDue} title={t.dueTitle} error={error} dismissible={!saving} onClose={() => setEdit(null)}
      actions={<>
        <Button tone="quiet" disabled={saving} onClick={() => setEdit(null)}>{t.cancel}</Button>
        <Button disabled={saving} onClick={() => void save()}>{saving ? t.saving : t.save}</Button>
      </>}>
      <TextField label={edit?.title ?? t.dueTitle} type="datetime-local" value={draft} disabled={saving} hint={t.dueZone}
        onChange={(event) => { setDraft(event.target.value); setError(undefined); }} />
    </Dialog>
  </Details>;
}
