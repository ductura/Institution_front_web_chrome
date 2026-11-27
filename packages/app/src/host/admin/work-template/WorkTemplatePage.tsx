"use client";

import { Button, Checkbox, DataTable, Select, TextField, type DataTableColumn } from "@ductura/ui";
import { useCallback, useEffect, useId, useState } from "react";

import { appHref } from "@/components/index";
import { goToSignIn } from "@/client/api";

import { DeniedState, LoadAlert } from "../../states/States";

import { useHost } from "../../context";
import { workTemplateMessages as t } from "./messages.hr";
import {
  MAX_SECTIONS, TITLE_FIELDS, WORK_TYPES, changed, checkDraft, draftOf, emptySection, isValid, isWorkType, move, withField,
  type Draft, type DraftErrors, type DraftSection, type TemplateVersion, type WorkType,
} from "./model";
import { readTemplate, saveTemplate, type TemplateRead } from "./read";

const date = new Intl.DateTimeFormat("hr-HR", { dateStyle: "long", timeZone: "Europe/Zagreb" });
const versionLine = (v: TemplateVersion) => t.versionOf.replace("{n}", String(v.version)).replace("{date}", date.format(new Date(v.effectiveFrom)));

const historyColumns: DataTableColumn<TemplateVersion>[] = [
  { id: "version", header: t.colVersion, cell: (v) => v.version, numeric: true, rowHeader: true },
  { id: "from", header: t.colFrom, cell: (v) => date.format(new Date(v.effectiveFrom)) },
  { id: "title", header: t.colTitlePage, cell: (v) => v.titlePage.map((f) => t.titleFields[f]).join(", ") },
  { id: "count", header: t.colSections, cell: (v) => v.sections.length, numeric: true },
];

function Current({ version }: { version: TemplateVersion | null }) {
  const id = useId();
  if (version === null) return <section aria-labelledby={id}><h2 id={id}>{t.currentHeading}</h2><p>{t.noVersion}</p></section>;
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{t.currentHeading}</h2>
      <p>{versionLine(version)}</p>
      <h3>{t.titlePageHeading}</h3>
      {version.titlePage.length === 0 ? <p>{t.titlePageNone}</p> : <ul>{version.titlePage.map((f) => <li key={f}>{t.titleFields[f]}</li>)}</ul>}
      <h3>{t.sectionsHeading}</h3>
      {version.sections.length === 0 ? <p>{t.noSections}</p> : (
        <ol>{version.sections.map((s, i) => <li key={i}>{s.title}, {s.hint === "" ? t.noHint : s.hint}</li>)}</ol>
      )}
      <p>{t.citationHeading}: {t.citationStyle}</p>
    </section>
  );
}

/** The form for the next version, over the version in force; keyed by type and version, so a reload resets the form. */
function TemplateForm({ workType, current, onSaved, onStale, onRefused }: {
  workType: WorkType; current: TemplateVersion | null; onSaved: (n: number) => void; onStale: () => void; onRefused: (kind: "signedOut" | "denied") => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => draftOf(current));
  const [errors, setErrors] = useState<DraftErrors>({ rows: {} });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const edit = (next: Draft) => { setDraft(next); setErrors({ rows: {} }); setFailure(null); setHint(null); };
  const patch = (key: number, part: Partial<DraftSection>) =>
    edit({ ...draft, sections: draft.sections.map((s) => (s.key === key ? { ...s, ...part } : s)) });

  const save = async () => {
    const found = checkDraft(draft);
    setErrors(found);
    if (!isValid(found)) return;
    if (!changed(current, draft)) { setHint(t.noChange); return; }
    setBusy(true);
    setFailure(null);
    const result = await saveTemplate(workType, current?.version ?? 0, draft);
    setBusy(false);
    if (result.kind === "saved") onSaved(result.version);
    else if (result.kind === "stale") onStale();
    else if (result.kind === "signedOut" || result.kind === "denied") onRefused(result.kind);
    else setFailure(result.kind === "invalid" ? t.invalid : t.formUnavailable);
  };

  const summary = [
    ...(errors.form === undefined ? [] : [t.errors[errors.form]]),
    ...Object.values(errors.rows).flatMap((row) => [row.title, row.hint].flatMap((code) => (code === undefined ? [] : [t.errors[code]]))),
  ];
  const last = draft.sections.length - 1;
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
        <fieldset>
          <legend>{t.titlePageHeading}</legend>
          {TITLE_FIELDS.map((field) => (
            <Checkbox key={field} label={t.titleFields[field]} checked={draft.titlePage.includes(field)}
              onChange={(e) => edit({ ...draft, titlePage: withField(draft.titlePage, field, e.target.checked) })} />
          ))}
        </fieldset>
        <h3>{t.sectionsHeading}</h3>
        {draft.sections.length === 0 && <p>{t.noSections}</p>}
        {draft.sections.map((s, i) => {
          const row = errors.rows[s.key];
          const n = String(i + 1);
          return (
            <fieldset key={s.key}>
              <legend>{t.section.replace("{n}", n)}</legend>
              <TextField label={t.sectionTitle} value={s.title} error={row?.title === undefined ? undefined : t.errors[row.title]} onChange={(e) => patch(s.key, { title: e.target.value })} />
              <TextField label={t.sectionHint} hint={t.sectionHintHint} value={s.hint} error={row?.hint === undefined ? undefined : t.errors[row.hint]} onChange={(e) => patch(s.key, { hint: e.target.value })} />
              <Button tone="quiet" disabled={i === 0} onClick={() => edit({ ...draft, sections: move(draft.sections, i, -1) })}>{t.moveUp.replace("{n}", n)}</Button>
              <Button tone="quiet" disabled={i === last} onClick={() => edit({ ...draft, sections: move(draft.sections, i, 1) })}>{t.moveDown.replace("{n}", n)}</Button>
              <Button tone="quiet" onClick={() => edit({ ...draft, sections: draft.sections.filter((x) => x.key !== s.key) })}>{t.remove.replace("{n}", n)}</Button>
            </fieldset>
          );
        })}
        <Button tone="secondary" disabled={draft.sections.length >= MAX_SECTIONS} onClick={() => edit({ ...draft, sections: [...draft.sections, emptySection()] })}>{t.add}</Button>
        {draft.sections.length >= MAX_SECTIONS && <p>{t.maxReached}</p>}
        <p>{t.citationHeading}: {t.citationStyle}</p>
        <Button busy={busy} onClick={() => void save()}>{busy ? t.saving : t.save}</Button>
        <Button tone="quiet" onClick={() => { setDraft(draftOf(current)); setErrors({ rows: {} }); setFailure(null); setHint(null); }}>{t.reset}</Button>
      </div>
      {hint !== null && <p role="status">{hint}</p>}
      {failure !== null && <LoadAlert body={failure} />}
    </section>
  );
}

/** The template of one type of work: reads and saves over institution.work-template.get/.put; a 409 reloads the version in force. */
function TypeEditor({ workType }: { workType: WorkType }) {
  const { base } = useHost();
  const [read, setRead] = useState<TemplateRead | { kind: "loading" }>({ kind: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    void readTemplate(workType).then((result) => { if (active) setRead(result); });
    return () => { active = false; };
  }, [workType, attempt]);
  useEffect(() => {
    if (read.kind === "signedOut") goToSignIn(appHref(base, "/ustanova/predlozak-rada"));
  }, [read, base]);

  if (read.kind === "loading") return <p role="status">{t.loading}</p>;
  // 401: only the redirect to the sign-in above, no text on the page (A3).
  if (read.kind === "signedOut") return null;
  if (read.kind === "denied") return <DeniedState title={t.deniedTitle} backLabel={t.backToOwn} backHref={appHref(base, "/ustanova")} />;
  if (read.kind !== "ready") {
    return <LoadAlert body={t.unavailable} retry={{ label: t.retry, onRetry: () => { setRead({ kind: "loading" }); reload(); } }} />;
  }
  return (
    <>
      {notice !== null && <p role="status">{notice}</p>}
      {stale && <LoadAlert body={t.stale} />}
      <Current version={read.current} />
      <TemplateForm
        key={`${workType}-${read.current?.version ?? 0}`}
        workType={workType}
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

/** WEB-V17-TEMPLATE-ADMIN: the administrator picks a type of work and edits its template (title page, sections, citation style). */
export default function WorkTemplatePage() {
  const [workType, setWorkType] = useState<WorkType>(WORK_TYPES[0]);
  return (
    <>
      <p>{t.lead}</p>
      <Select
        label={t.workTypeLabel} value={workType}
        options={WORK_TYPES.map((value) => ({ value, label: t.workTypes[value] }))}
        onChange={(e) => { if (isWorkType(e.target.value)) setWorkType(e.target.value); }}
      />
      <TypeEditor key={workType} workType={workType} />
    </>
  );
}
