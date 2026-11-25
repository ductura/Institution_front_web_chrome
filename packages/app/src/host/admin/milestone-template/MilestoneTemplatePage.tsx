"use client";

import { Button, Checkbox, DataTable, Select, TextField, type DataTableColumn } from "@ductura/ui";
import { useCallback, useEffect, useId, useState } from "react";

import { appHref } from "@/components/index";
import { goToSignIn } from "@/client/api";

import { useHost } from "../../context";
import { milestoneTemplateMessages as t } from "./messages.hr";
import {
  MAX_MILESTONES, SUBMITS, changed, checkDraft, draftOf, emptyMilestone, isValid, move,
  type Draft, type DraftErrors, type DraftMilestone, type Submits, type TemplateVersion,
} from "./model";
import { readTemplate, saveTemplate, type TemplateRead } from "./read";

const date = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeZone: "Europe/Zagreb" });
const versionLine = (v: TemplateVersion) => t.versionOf.replace("{n}", String(v.version)).replace("{date}", date.format(new Date(v.effectiveFrom)));

const historyColumns: DataTableColumn<TemplateVersion>[] = [
  { id: "version", header: t.colVersion, cell: (v) => v.version, numeric: true, rowHeader: true },
  { id: "from", header: t.colFrom, cell: (v) => date.format(new Date(v.effectiveFrom)) },
  { id: "count", header: t.colCount, cell: (v) => v.milestones.length, numeric: true },
  { id: "final", header: t.colFinal, cell: (v) => (v.requireFinalStageApproval ? t.yes : t.no) },
];

function Current({ version }: { version: TemplateVersion | null }) {
  const id = useId();
  if (version === null) return <section aria-labelledby={id}><h2 id={id}>{t.currentHeading}</h2><p>{t.noVersion}</p></section>;
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{t.currentHeading}</h2>
      <p>{versionLine(version)}</p>
      {version.milestones.length === 0 ? <p>{t.noMilestones}</p> : (
        <ol>
          {version.milestones.map((m, i) => (
            <li key={i}>{t.summaryOf(m.title, m.relativeDue === undefined ? t.noDue : `${m.relativeDue} d`, t.submitsOptions[m.submits])}</li>
          ))}
        </ol>
      )}
      <p>{t.requireFinalStageApproval}: {version.requireFinalStageApproval ? t.yes : t.no}</p>
    </section>
  );
}

/** The form for the next version, over the version in force; keyed by it, so a reload resets the form. */
function TemplateForm({ current, onSaved, onStale, onRefused }: {
  current: TemplateVersion | null; onSaved: (n: number) => void; onStale: () => void; onRefused: (kind: "signedOut" | "denied") => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => draftOf(current));
  const [errors, setErrors] = useState<DraftErrors>({ rows: {} });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const edit = (next: Draft) => { setDraft(next); setErrors({ rows: {} }); setFailure(null); setHint(null); };
  const patch = (key: number, part: Partial<DraftMilestone>) =>
    edit({ ...draft, milestones: draft.milestones.map((m) => (m.key === key ? { ...m, ...part } : m)) });

  const save = async () => {
    const found = checkDraft(draft);
    setErrors(found);
    if (!isValid(found)) return;
    if (!changed(current, draft)) { setHint(t.noChange); return; }
    setBusy(true);
    setFailure(null);
    const result = await saveTemplate(current?.version ?? 0, draft);
    setBusy(false);
    if (result.kind === "saved") onSaved(result.version);
    else if (result.kind === "stale") onStale();
    else if (result.kind === "signedOut" || result.kind === "denied") onRefused(result.kind);
    else setFailure(result.kind === "invalid" ? t.invalid : t.formUnavailable);
  };

  const summary = [
    ...(errors.form === undefined ? [] : [t.errors[errors.form]]),
    ...Object.values(errors.rows).flatMap((row) => [row.title, row.due].flatMap((code) => (code === undefined ? [] : [t.errors[code]]))),
  ];
  const last = draft.milestones.length - 1;
  return (
    <section aria-labelledby={`${id}-form`}>
      <h2 id={`${id}-form`}>{t.formHeading}</h2>
      <div role="group" aria-label={t.formHeading}>
        {summary.length > 0 && (
          <div role="alert">
            <p>{t.errorSummary}</p>
            <ul>{[...new Set(summary)].map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        )}
        <h3>{t.milestonesHeading}</h3>
        {draft.milestones.length === 0 && <p>{t.noMilestones}</p>}
        {draft.milestones.map((m, i) => {
          const row = errors.rows[m.key];
          const n = String(i + 1);
          return (
            <fieldset key={m.key}>
              <legend>{t.milestone.replace("{n}", n)}</legend>
              <TextField label={t.title_} value={m.title} error={row?.title === undefined ? undefined : t.errors[row.title]} onChange={(e) => patch(m.key, { title: e.target.value })} />
              <TextField
                label={t.relativeDue} hint={t.relativeDueHint} inputMode="numeric" value={m.due}
                error={row?.due === undefined ? undefined : t.errors[row.due]} onChange={(e) => patch(m.key, { due: e.target.value })}
              />
              <Select
                label={t.submits} value={m.submits}
                options={SUBMITS.map((value) => ({ value, label: t.submitsOptions[value] }))}
                onChange={(e) => patch(m.key, { submits: e.target.value as Submits })}
              />
              <Button tone="quiet" disabled={i === 0} onClick={() => edit({ ...draft, milestones: move(draft.milestones, i, -1) })}>{t.moveUp.replace("{n}", n)}</Button>
              <Button tone="quiet" disabled={i === last} onClick={() => edit({ ...draft, milestones: move(draft.milestones, i, 1) })}>{t.moveDown.replace("{n}", n)}</Button>
              <Button tone="quiet" onClick={() => edit({ ...draft, milestones: draft.milestones.filter((x) => x.key !== m.key) })}>{t.remove.replace("{n}", n)}</Button>
            </fieldset>
          );
        })}
        <Button tone="secondary" disabled={draft.milestones.length >= MAX_MILESTONES} onClick={() => edit({ ...draft, milestones: [...draft.milestones, emptyMilestone()] })}>{t.add}</Button>
        {draft.milestones.length >= MAX_MILESTONES && <p>{t.maxReached}</p>}
        <Checkbox label={t.requireFinalStageApproval} checked={draft.requireFinalStageApproval} onChange={(e) => edit({ ...draft, requireFinalStageApproval: e.target.checked })} />
        <Button busy={busy} onClick={() => void save()}>{busy ? t.saving : t.save}</Button>
        <Button tone="quiet" onClick={() => { setDraft(draftOf(current)); setErrors({ rows: {} }); setFailure(null); setHint(null); }}>{t.reset}</Button>
      </div>
      {hint !== null && <p role="status">{hint}</p>}
      {failure !== null && <p role="alert">{failure}</p>}
    </section>
  );
}

/**
 * WEB-V16-ETAPE-ADMIN: the administrator edits the institution's milestone template over
 * institution.milestone-template.get/.put. Saving sends `expectedVersion`; a 409 reloads the version in force.
 */
export default function MilestoneTemplatePage() {
  const { base } = useHost();
  const [read, setRead] = useState<TemplateRead | { kind: "loading" }>({ kind: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    void readTemplate().then((result) => { if (active) setRead(result); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    if (read.kind === "signedOut") goToSignIn(appHref(base, "/ustanova/etape"));
  }, [read, base]);

  if (read.kind === "loading") return <p role="status">{t.loading}</p>;
  if (read.kind === "signedOut") return <p role="alert">{t.signedOut}</p>;
  if (read.kind === "denied") return <p role="alert">{t.denied}</p>;
  if (read.kind !== "ready") {
    return (
      <div>
        <p role="alert">{t.unavailable}</p>
        <Button onClick={() => { setRead({ kind: "loading" }); reload(); }}>{t.retry}</Button>
      </div>
    );
  }
  return (
    <>
      <p>{t.lead}</p>
      {notice !== null && <p role="status">{notice}</p>}
      {stale && <p role="alert">{t.stale}</p>}
      <Current version={read.current} />
      <TemplateForm
        key={read.current?.version ?? 0}
        current={read.current}
        onSaved={(n) => { setNotice(t.saved.replace("{n}", String(n))); setStale(false); reload(); }}
        onStale={() => { setNotice(null); setStale(true); reload(); }}
        onRefused={(kind) => setRead({ kind })}
      />
      {read.versions.length > 0 && (
        <section>
          <h2>{t.historyHeading}</h2>
          <DataTable
            caption={t.historyCaption} columns={historyColumns}
            rows={[...read.versions].sort((a, b) => b.version - a.version)} rowKey={(v) => String(v.version)} empty={t.noVersion}
          />
        </section>
      )}
    </>
  );
}
