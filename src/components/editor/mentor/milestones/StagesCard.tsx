"use client";

import { Button, DataTable, Details, Dialog, Tag, TextArea, TextField } from "@ductura/ui";
import { useRef, useState } from "react";

import { zagrebParts } from "@/components/summary/zagreb-time";
import { zagrebInstant, zagrebLocalMinute } from "@/lib/i18n/zagreb";

import { mayDecide, mayDelete, optionalText, approvedCount, stageDot } from "./stage-model";
import { approveStage, deleteStage, readStages, renameStage, requestStageRevision, type Stage } from "./stages-api";
import { stagesHr as t } from "./stages-messages.hr";
import { useMentorRead, type MentorAccess } from "./useMentorRead";

type Failure = { ok: false; status: number };
type Done = { ok: true; body?: Stage } | Failure;

const when = (iso: string | null) => {
  const parts = iso === null ? null : zagrebParts(iso);
  return parts && iso ? <time dateTime={iso}>{parts.date} {parts.time}</time> : null;
};

function DateLine({ label, iso }: { label: string; iso: string | null }) {
  const value = when(iso);
  return value ? <p>{label}: {value}</p> : null;
}

/** The "Etape" card of the mentor work header (WEB-1520). Only the mentor (`mentor`) decides or edits. */
export function StagesCard({ mentor, ...access }: MentorAccess & { mentor: boolean }) {
  const { data, setData, status, retry } = useMentorRead(readStages, access);
  const [decide, setDecide] = useState<{ stage: Stage; kind: "revision" | "approve" } | null>(null);
  const [editing, setEditing] = useState(false);
  const stages = data?.milestones ?? [];
  const heading = data ? t.progress.replace("{approved}", String(approvedCount(stages))).replace("{total}", String(stages.length)) : t.heading;

  const replace = (saved: Stage) => setData((list) => list && { milestones: list.milestones.map((item) => item.id === saved.id ? saved : item) });

  return <Details summary={heading}>
    {status === "loading" && <p role="status">{t.loading}</p>}
    {(status === "unavailable" || status === "notFound") && <p role="alert">{t.unavailable}</p>}
    {status === "unavailable" && <Button tone="quiet" onClick={retry}>{t.retry}</Button>}
    {status === "ready" && stages.length === 0 && <p>{t.empty}</p>}
    {stages.length > 0 && <ol>
      {stages.map((stage) => <li key={stage.id} data-stage-dot={stageDot(stage)}>
        <strong>{stage.title}</strong> <Tag tone={stage.state === "revision_requested" ? "warn" : stage.state === "approved" ? "accent" : "neutral"}>{t.state[stageDot(stage)]}</Tag>
        {stage.description && <p>{stage.description}</p>}
        {stage.dueAt === null ? <p>{t.noDue}</p> : <DateLine label={t.dates.due} iso={stage.dueAt} />}
        <DateLine label={t.dates.submitted} iso={stage.submittedAt} />
        <DateLine label={t.dates.revisionRequested} iso={stage.revisionRequestedAt} />
        <DateLine label={t.dates.revisionDue} iso={stage.revisionDueAt} />
        {stage.revisionComment && <p>{stage.revisionComment}</p>}
        <DateLine label={t.dates.approved} iso={stage.approvedAt} />
        {stage.approvalMessage && <p>{stage.approvalMessage}</p>}
        {mentor && mayDecide(stage) && <>
          <Button tone="quiet" onClick={() => setDecide({ stage, kind: "revision" })}>{t.requestRevision}</Button>
          <Button onClick={() => setDecide({ stage, kind: "approve" })}>{t.approve}</Button>
        </>}
      </li>)}
    </ol>}
    {mentor && status === "ready" && <Button tone="quiet" onClick={() => setEditing(true)}>{t.edit}</Button>}
    {decide && <DecideDialog {...decide} access={access} onClose={() => setDecide(null)} onSaved={(saved) => { replace(saved); setDecide(null); }} />}
    {editing && <EditStages stages={stages} access={access} onClose={() => setEditing(false)}
      onSaved={replace} onDeleted={(id) => setData((list) => list && { milestones: list.milestones.filter((item) => item.id !== id) })} />}
  </Details>;
}

function useAction(access: MentorAccess) {
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const run = async (call: () => Promise<Done>): Promise<Done | null> => {
    if (inFlight.current || !access.current()) return null;
    inFlight.current = true;
    setSaving(true);
    setError(undefined);
    const result = await call().catch(() => ({ ok: false, status: 0 }) as Failure);
    inFlight.current = false;
    if (!access.current()) return null;
    setSaving(false);
    if (!result.ok) {
      if (result.status === 401) access.onSessionEnd();
      else setError(result.status === 409 ? t.rejected : t.failed);
    }
    return result;
  };
  return { run, saving, error, setError };
}

function DecideDialog({ stage, kind, access, onClose, onSaved }: {
  stage: Stage; kind: "revision" | "approve"; access: MentorAccess; onClose: () => void; onSaved: (saved: Stage) => void;
}) {
  const { run, saving, error, setError } = useAction(access);
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const revision = kind === "revision";

  const submit = async () => {
    if (revision) {
      const comment = optionalText(text);
      const revisionDueAt = zagrebInstant(due);
      if (comment === undefined || revisionDueAt === null) { setError(t.revisionNeeded); return; }
      const result = await run(() => requestStageRevision(access.documentId, stage.id, comment, revisionDueAt));
      if (result?.ok && result.body) onSaved(result.body);
    } else {
      const result = await run(() => approveStage(access.documentId, stage.id, optionalText(text)));
      if (result?.ok && result.body) onSaved(result.body);
    }
  };

  return <Dialog open title={revision ? t.revisionTitle : t.approveTitle} error={error} dismissible={!saving} onClose={onClose}
    actions={<>
      <Button tone="quiet" disabled={saving} onClick={onClose}>{t.cancel}</Button>
      <Button disabled={saving} onClick={() => void submit()}>{saving ? t.saving : revision ? t.send : t.confirm}</Button>
    </>}>
    <p><strong>{stage.title}</strong></p>
    <TextArea label={revision ? t.revisionComment : t.approveMessage} value={text} maxLength={revision ? 2000 : 1000} disabled={saving}
      onChange={(event) => { setText(event.target.value); setError(undefined); }} />
    {revision
      ? <TextField label={t.revisionDue} type="datetime-local" value={due} disabled={saving} hint={t.revisionDueHint}
        onChange={(event) => { setDue(event.target.value); setError(undefined); }} />
      : <p>{t.approveDate}</p>}
  </Dialog>;
}

function EditStages({ stages, access, onClose, onSaved, onDeleted }: {
  stages: readonly Stage[]; access: MentorAccess; onClose: () => void; onSaved: (saved: Stage) => void; onDeleted: (id: string) => void;
}) {
  const { run, saving, error, setError } = useAction(access);
  const [drafts, setDrafts] = useState<Record<string, { title: string; due: string }>>({});
  const draftOf = (stage: Stage) => drafts[stage.id] ?? { title: stage.title, due: stage.dueAt === null ? "" : zagrebLocalMinute(stage.dueAt) };
  const change = (stage: Stage, part: Partial<{ title: string; due: string }>) => {
    setDrafts((all) => ({ ...all, [stage.id]: { ...draftOf(stage), ...part } }));
    setError(undefined);
  };

  const save = async (stage: Stage) => {
    const draft = draftOf(stage);
    const title = optionalText(draft.title);
    const body: { title?: string; dueAt?: string } = {};
    if (title !== undefined && title !== stage.title) body.title = title;
    if (draft.due !== "" && !(stage.dueAt !== null && draft.due === zagrebLocalMinute(stage.dueAt))) {
      const dueAt = zagrebInstant(draft.due);
      if (dueAt === null) { setError(t.invalidDue); return; }
      body.dueAt = dueAt;
    }
    if (Object.keys(body).length === 0) return;
    const result = await run(() => renameStage(access.documentId, stage.id, body));
    if (result?.ok && result.body) onSaved(result.body);
  };

  const remove = async (stage: Stage) => {
    const result = await run(() => deleteStage(access.documentId, stage.id));
    if (result?.ok) onDeleted(stage.id);
  };

  return <Dialog open title={t.editTitle} error={error} dismissible={!saving} onClose={onClose}
    actions={<Button tone="quiet" disabled={saving} onClick={onClose}>{t.close}</Button>}>
    <DataTable caption={t.editCaption} rows={stages} rowKey={(stage) => stage.id} empty={t.empty}
      columns={[
        { id: "n", header: t.colNumber, numeric: true, cell: (stage) => stages.indexOf(stage) + 1 },
        { id: "title", header: t.colTitle, rowHeader: true, cell: (stage) =>
          <TextField label={t.titleLabel} value={draftOf(stage).title} maxLength={200} disabled={saving} onChange={(event) => change(stage, { title: event.target.value })} /> },
        { id: "due", header: t.colDue, cell: (stage) =>
          <TextField label={t.colDue} type="datetime-local" value={draftOf(stage).due} disabled={saving} hint={t.revisionDueHint} onChange={(event) => change(stage, { due: event.target.value })} /> },
        { id: "submits", header: t.colSubmits, cell: () => <Tag>{t.submitsUnavailable}</Tag> },
        { id: "actions", header: t.colActions, cell: (stage) => <>
          <Button tone="quiet" disabled={saving} onClick={() => void save(stage)}>{t.save}</Button>
          <Button tone="quiet" disabled={saving || !mayDelete(stage)} onClick={() => void remove(stage)}>{t.remove}</Button>
          {!mayDelete(stage) && <p>{t.removeBlocked}</p>}
        </> },
      ]} />
    <Button tone="quiet" disabled aria-describedby="stages-na">{t.add}</Button>
    <Button tone="quiet" disabled aria-describedby="stages-na">{t.template}</Button>
    <p id="stages-na">{t.unavailableAction}</p>
  </Dialog>;
}
