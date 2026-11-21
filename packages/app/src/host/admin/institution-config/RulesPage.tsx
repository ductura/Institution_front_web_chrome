"use client";

import { Button, Checkbox, DataTable, Select, type DataTableColumn } from "@ductura/ui";
import { useCallback, useEffect, useId, useState } from "react";

import { messagesHr } from "@/lib/i18n/messages.hr";

import { rulesMessages as t } from "./messages.hr";
import {
  AI_POLICIES, AI_PURPOSES, PROFILES, changesOf, checkDraft, currentOf, draftOf, publishRule, readRules,
  type AiPurpose, type DraftChange, type FieldErrors, type RuleDraft, type RuleRow, type RuleVersion, type RulesRead, type WorkType,
} from "./rules";
import styles from "./rules.module.css";

const copy = messagesHr.facultyRuleVersions;
const workTypes = messagesHr.teacher.assignment.workTypes;
const date = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeZone: "Europe/Zagreb" });

const purposesText = (purposes: readonly AiPurpose[]) =>
  purposes.length === 0 ? t.diffNoPurposes : AI_PURPOSES.filter((p) => purposes.includes(p)).map((p) => copy.purposeLabels[p]).join(", ");

/** The label of a field's value, as the administrator reads it. */
function valueText(change: Pick<DraftChange, "field">, value: DraftChange["after"] | null): string {
  if (value === null) return t.diffNew;
  switch (change.field) {
    case "aiPolicy": return copy.policies[value as RuleDraft["aiPolicy"]];
    case "aiPurposes": return purposesText(value as readonly AiPurpose[]);
    case "evidenceProfile": return copy.profiles[value as RuleDraft["evidenceProfile"]];
    case "importAllowed": return value ? t.yes : t.no;
  }
}

const fieldLabel = { aiPolicy: t.aiPolicy, aiPurposes: t.aiPurposes, evidenceProfile: t.evidenceProfile, importAllowed: t.importAllowed } as const;
const sayFor = { invalid: t.invalid, fields: t.invalidFields };

const historyColumns: DataTableColumn<RuleVersion>[] = [
  { id: "version", header: copy.colVersion, cell: (v) => v.versionNo, numeric: true, rowHeader: true },
  { id: "published", header: copy.colPublished, cell: (v) => date.format(new Date(v.publishedAt)) },
  { id: "origin", header: copy.colOrigin, cell: (v) => copy.origins[v.origin] },
  { id: "ai", header: copy.colAi, cell: (v) => copy.policies[v.aiPolicy] },
  { id: "purposes", header: copy.purposes, cell: (v) => purposesText(v.aiPurposes) },
  { id: "profile", header: copy.profile, cell: (v) => copy.profiles[v.evidenceProfile] },
  { id: "uvoz", header: copy.importLabel, cell: (v) => (v.importAllowed ? copy.importValues.yes : copy.importValues.no) },
];

const diffColumns: DataTableColumn<DraftChange>[] = [
  { id: "field", header: t.diffField, cell: (c) => fieldLabel[c.field], rowHeader: true },
  { id: "before", header: t.diffBefore, cell: (c) => valueText(c, c.before) },
  { id: "after", header: t.diffAfter, cell: (c) => valueText(c, c.after) },
];

/** One work type: the version in force, its history (read only) and the form for the next version. */
function WorkTypeRules({ row, onPublished, onStale, onDenied }: {
  row: RuleRow; onPublished: (n: number) => void; onStale: () => void; onDenied: () => void;
}) {
  const current = currentOf(row);
  const ids = useId();
  const [draft, setDraft] = useState<RuleDraft>(() => draftOf(current));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const changes = changesOf(current, draft);
  const edit = (next: Partial<RuleDraft>) => {
    setDraft((d) => ({ ...d, ...next }));
    setReviewed(false);
    setErrors({});
    setFailure(null);
  };

  const review = () => {
    const found = checkDraft(draft, t);
    setErrors(found);
    setReviewed(Object.keys(found).length === 0);
  };
  const publish = async () => {
    setBusy(true);
    setFailure(null);
    const result = await publishRule(row.workType, current?.versionNo ?? null, draft, sayFor);
    setBusy(false);
    if (result.kind === "published") onPublished(result.versionNo);
    else if (result.kind === "stale") onStale();
    else if (result.kind === "denied") onDenied();
    else if (result.kind === "invalid") { setErrors(result.errors); setReviewed(false); }
    else setFailure(t.formUnavailable);
  };

  const messages = Object.values(errors);
  return (
    <>
      <section className={styles.section} aria-labelledby={`${ids}-now`}>
        <h2 id={`${ids}-now`}>{t.currentHeading}</h2>
        {current === null ? <p>{t.noVersion}</p> : (
          <>
            <p className={styles.meta}>
              {copy.versionOf.replace("{n}", String(current.versionNo)).replace("{date}", date.format(new Date(current.publishedAt)))}
              {" · "}{t.readOnlyVersion}
            </p>
            <dl className={styles.kv}>
              <dt>{copy.aiPolicy}</dt><dd>{copy.policies[current.aiPolicy]}</dd>
              <dt>{copy.purposes}</dt><dd>{purposesText(current.aiPurposes)}</dd>
              <dt>{copy.profile}</dt><dd>{copy.profiles[current.evidenceProfile]}</dd>
              <dt>{copy.importLabel}</dt><dd>{current.importAllowed ? copy.importValues.yes : copy.importValues.no}</dd>
            </dl>
          </>
        )}
      </section>

      {row.versions.length > 0 && (
        <section className={styles.section} aria-labelledby={`${ids}-history`}>
          <h2 id={`${ids}-history`}>{t.historyHeading}</h2>
          <DataTable
            caption={t.historyLabel.replace("{workType}", workTypes[row.workType])}
            columns={historyColumns}
            rows={[...row.versions].sort((a, b) => b.versionNo - a.versionNo)}
            rowKey={(v) => String(v.versionNo)}
            empty={t.noVersion}
          />
        </section>
      )}

      <section className={styles.section} aria-labelledby={`${ids}-form`}>
        <h2 id={`${ids}-form`}>{t.formHeading}</h2>
        <p>{t.formLead}</p>
        <div role="group" aria-label={t.formHeading} className={styles.form}>
          {messages.length > 0 && (
            <div role="alert" className={styles.summary}>
              <p>{t.errorSummary}</p>
              <ul>{messages.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          )}
          <Select
            label={t.aiPolicy}
            value={draft.aiPolicy}
            options={AI_POLICIES.map((value) => ({ value, label: copy.policies[value] }))}
            error={errors.aiPolicy}
            onChange={(event) => edit({ aiPolicy: event.target.value as RuleDraft["aiPolicy"] })}
          />
          <fieldset className={styles.fieldset} aria-describedby={errors.aiPurposes === undefined ? undefined : `${ids}-purposes-error`}>
            <legend>{t.aiPurposes}</legend>
            <p className={styles.hint}>{t.aiPurposesHint}</p>
            {AI_PURPOSES.map((purpose) => (
              <Checkbox
                key={purpose}
                label={copy.purposeLabels[purpose]}
                checked={draft.aiPurposes.includes(purpose)}
                onChange={(event) => edit({
                  aiPurposes: event.target.checked ? [...draft.aiPurposes, purpose] : draft.aiPurposes.filter((p) => p !== purpose),
                })}
              />
            ))}
            {errors.aiPurposes !== undefined && <p id={`${ids}-purposes-error`} className={styles.error}>{errors.aiPurposes}</p>}
          </fieldset>
          <Select
            label={t.evidenceProfile}
            value={draft.evidenceProfile}
            options={PROFILES.map((value) => ({ value, label: copy.profiles[value] }))}
            error={errors.evidenceProfile}
            onChange={(event) => edit({ evidenceProfile: event.target.value as RuleDraft["evidenceProfile"] })}
          />
          <Checkbox label={t.importAllowed} checked={draft.importAllowed} onChange={(event) => edit({ importAllowed: event.target.checked })} />
          <div className={styles.actions}>
            <Button tone="quiet" onClick={review}>{t.review}</Button>
            <Button tone="quiet" onClick={() => { setDraft(draftOf(current)); setErrors({}); setReviewed(false); setFailure(null); }}>{t.reset}</Button>
          </div>
        </div>

        {reviewed && (
          <section aria-labelledby={`${ids}-diff`} className={styles.diff}>
            <h3 id={`${ids}-diff`}>{current === null ? t.diffHeadingFirst : t.diffHeading.replace("{n}", String(current.versionNo))}</h3>
            {changes.length === 0 ? <p role="status">{t.diffNone}</p> : (
              <>
                <DataTable caption={t.diffHeading.replace("{n}", String(current?.versionNo ?? 0))} columns={diffColumns} rows={changes} rowKey={(c) => c.field} empty={t.diffNone} />
                <Button busy={busy} onClick={() => void publish()}>{busy ? t.publishing : t.publish}</Button>
              </>
            )}
          </section>
        )}
        {failure !== null && <p role="alert" className={styles.error}>{failure}</p>}
        {errors.form !== undefined && <p role="alert" className={styles.error}>{errors.form}</p>}
      </section>
    </>
  );
}

/** A-04: the faculty rule versions and the form for a new one. Every call goes through src/client. */
export default function RulesPage() {
  const [read, setRead] = useState<RulesRead | { kind: "loading" }>({ kind: "loading" });
  const [workType, setWorkType] = useState<WorkType>("seminar_paper");
  const [notice, setNotice] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    void readRules().then((result) => { if (active) setRead(result); });
    return () => { active = false; };
  }, [attempt]);

  if (read.kind === "loading") return <p role="status">{t.loading}</p>;
  if (read.kind === "denied") return <p role="alert">{t.denied}</p>;
  if (read.kind !== "ready") {
    return (
      <div>
        <p role="alert">{t.unavailable}</p>
        <Button onClick={() => { setRead({ kind: "loading" }); load(); }}>{t.retry}</Button>
      </div>
    );
  }
  const row = read.rules.find((r) => r.workType === workType) ?? { workType, versions: [] };
  return (
    <>
      <p>{t.lead}</p>
      {notice !== null && <p role="status" className={styles.notice}>{notice}</p>}
      {staleNotice && <p role="alert" className={styles.notice}>{t.stale}</p>}
      <Select
        label={t.workType}
        value={workType}
        options={Object.entries(workTypes).map(([value, label]) => ({ value, label }))}
        onChange={(event) => { setWorkType(event.target.value as WorkType); setNotice(null); setStaleNotice(false); }}
      />
      {/* keyed by the newest version, so a published or reloaded rule resets the form to the version in force */}
      <WorkTypeRules
        key={`${row.workType}:${currentOf(row)?.versionNo ?? 0}`}
        row={row}
        onPublished={(n) => { setNotice(t.published.replace("{n}", String(n))); setStaleNotice(false); load(); }}
        onStale={() => { setNotice(null); setStaleNotice(true); load(); }}
        onDenied={() => setRead({ kind: "denied" })}
      />
    </>
  );
}
