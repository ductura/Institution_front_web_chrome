"use client";

// WEB-V16-OBRANA: the section "Nakon predaje i obrana" of the "Završni rad" panel. The student reads the stage
// (submitted to the office, defense scheduled, defended) and the defense date; the mentor sets them through a
// form that sends `defenseAt` only for "defense_scheduled". A note of success follows only the server's answer.
import { useState } from "react";

import { createApi, goToSignIn } from "@/client/api";
import { Button, Select, TextField } from "@ductura/ui";

import type { SectionRead, SectionViewProps, ThesisSectionDef } from "../model";
import { checkStage, fieldOf, formatDefense, STAGES, stepsOf, type Stage, type StageView } from "./model";
import { stageHr as t } from "./messages.hr";
import { readStage, writeStage } from "./read";

type Api = ReturnType<typeof createApi>;
const defaultCall = (): Api => createApi();

export async function readSection(documentId: string, call: Api = defaultCall()): Promise<SectionRead<StageView>> {
  const r = await readStage(call, documentId);
  if (r.kind === "ok") return { kind: "ready", value: r.view };
  if (r.kind === "notFound") return { kind: "notFound" };
  if (r.kind === "signedOut") goToSignIn(window.location.pathname);
  return { kind: "unavailable" };
}

const FAILURE = { invalid: t.errors.invalid, forbidden: t.errors.forbidden, notFound: t.errors.notFound, unknown: t.errors.unknown } as const;

export function StageSection({ documentId, role, value, reload, call = defaultCall }: SectionViewProps<StageView> & { call?: () => Api }) {
  const [shown, setShown] = useState<StageView>(value);
  const [stage, setStage] = useState<Stage>(value.stage);
  const [local, setLocal] = useState(fieldOf(value.defenseAt));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "status" | "alert"; text: string } | null>(null);
  const [problem, setProblem] = useState<"dateRequired" | "dateInvalid" | null>(null);

  async function save() {
    const checked = checkStage(stage, local);
    if (!checked.ok) { setProblem(checked.problem); setNote(null); return; }
    setProblem(null); setNote(null); setBusy(true);
    const result = await writeStage(call(), documentId, checked.body);
    setBusy(false);
    if (result.kind === "done") {
      setShown(result.view); setStage(result.view.stage); setLocal(fieldOf(result.view.defenseAt));
      setNote({ tone: "status", text: t.saved });
      return;
    }
    if (result.kind === "signedOut") { goToSignIn(window.location.pathname); return; }
    setNote({ tone: "alert", text: FAILURE[result.kind] });
    // The server may know more than this page. A work that is gone hides the whole section (reload); after an
    // unknown outcome the stage is read again in place, so the notice and the mentor's edited date stay.
    if (result.kind === "notFound") { reload(); return; }
    if (result.kind === "unknown") {
      const again = await readStage(call(), documentId);
      if (again.kind === "ok") setShown(again.view);
      else if (again.kind === "notFound") reload();
    }
  }

  const when = formatDefense(shown.defenseAt);
  return (
    <div>
      {shown.stage === "none" ? <p>{t.stageNone}</p> : null}
      <ol aria-label={t.title}>
        {stepsOf(shown.stage).map((s) => (
          <li key={s.id} data-state={s.state}>{t.steps[s.id]} ({t[s.state === "done" ? "done" : s.state === "current" ? "current" : "pending"]})</li>
        ))}
      </ol>
      <p data-testid="defense-at">{when === null ? t.defenseAtNone : `${t.defenseAt}: ${when}`}</p>
      {shown.changedByPart !== null ? <p>{t.changedBy[shown.changedByPart]}</p> : null}
      {role === "mentor" ? (
        <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <Select label={t.stageLabel} name="stage" value={stage} onChange={(e) => { setStage(e.target.value as Stage); setProblem(null); }}
            options={STAGES.map((s) => ({ value: s, label: t.options[s] }))} />
          {stage === "defense_scheduled" ? (
            <TextField label={t.defenseAtLabel} hint={t.defenseAtHint} type="datetime-local" name="defenseAt" value={local}
              onChange={(e) => setLocal(e.target.value)} error={problem === null ? undefined : t.errors[problem]} />
          ) : null}
          <Button type="submit" busy={busy}>{busy ? t.saving : t.save}</Button>
        </form>
      ) : <p>{t.studentNote}</p>}
      {note !== null ? <p role={note.tone === "alert" ? "alert" : "status"}>{note.text}</p> : null}
    </div>
  );
}

export const section: ThesisSectionDef<StageView> = {
  id: "stage",
  order: 90,
  title: t.title,
  read: (documentId) => readSection(documentId),
  View: (props) => <StageSection {...props} />,
};
