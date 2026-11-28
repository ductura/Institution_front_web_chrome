"use client";

import { Button, Checkbox, DataTable, Select, Tag, type DataTableColumn } from "@ductura/ui";
import { useCallback, useEffect, useId, useState } from "react";

import { configMessages as t } from "./messages.config.hr";
import {
  WORK_LANGUAGES, checkConfig, configChanges, draftOf, newestOf, publishConfig, readConfig,
  type ConfigChange, type ConfigDraft, type ConfigErrors, type ConfigRead, type ConfigVersion, type WorkLanguage,
} from "./config";
import styles from "./rules.module.css";

const date = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeZone: "Europe/Zagreb" });
const languagesText = (value: readonly WorkLanguage[] | WorkLanguage | null): string =>
  value === null ? t.diffNew : typeof value === "string" ? t.languages[value] : value.map((l) => t.languages[l]).join(", ");

const historyColumns: DataTableColumn<ConfigVersion>[] = [
  { id: "version", header: t.colVersion, cell: (v) => v.version, numeric: true, rowHeader: true },
  { id: "from", header: t.colEffective, cell: (v) => date.format(new Date(v.effectiveFrom)) },
  { id: "style", header: t.citationStyle, cell: () => t.citationStyleValue },
  { id: "languages", header: t.workLanguages, cell: (v) => languagesText(v.rules.workLanguages) },
  { id: "default", header: t.defaultWorkLanguage, cell: (v) => languagesText(v.rules.defaultWorkLanguage) },
];
const diffColumns: DataTableColumn<ConfigChange>[] = [
  { id: "field", header: t.diffField, cell: (c) => (c.field === "workLanguages" ? t.workLanguages : t.defaultWorkLanguage), rowHeader: true },
  { id: "before", header: t.diffBefore, cell: (c) => languagesText(c.before) },
  { id: "after", header: t.diffAfter, cell: (c) => languagesText(c.after) },
];

function ConfigForm({ current, versions, onPublished, onStale, onDenied }: {
  current: ConfigVersion | null; versions: readonly ConfigVersion[]; onPublished: (n: number) => void; onStale: () => void; onDenied: () => void;
}) {
  const ids = useId();
  const [draft, setDraft] = useState<ConfigDraft>(() => draftOf(current));
  const [errors, setErrors] = useState<ConfigErrors>({});
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const changes = configChanges(current, draft);
  const edit = (next: Partial<ConfigDraft>) => { setDraft((d) => ({ ...d, ...next })); setReviewed(false); setErrors({}); setFailure(null); };

  const review = () => {
    const found = checkConfig(draft, t);
    setErrors(found);
    setReviewed(Object.keys(found).length === 0);
  };
  const publish = async () => {
    setBusy(true);
    setFailure(null);
    const result = await publishConfig(current?.version ?? null, draft, t.invalid);
    setBusy(false);
    if (result.kind === "published") onPublished(result.version);
    else if (result.kind === "stale") onStale();
    else if (result.kind === "denied") onDenied();
    else if (result.kind === "invalid") { setErrors({ form: result.message }); setReviewed(false); }
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
              <span>{t.versionOf.replace("{n}", String(current.version)).replace("{date}", date.format(new Date(current.effectiveFrom)))}</span>
              <Tag>{t.readOnlyVersion}</Tag>
            </p>
            <dl className={styles.kv}>
              <dt>{t.citationStyle}</dt><dd>{t.citationStyleValue}</dd>
              <dt>{t.workLanguages}</dt><dd>{languagesText(current.rules.workLanguages)}</dd>
              <dt>{t.defaultWorkLanguage}</dt><dd>{languagesText(current.rules.defaultWorkLanguage)}</dd>
            </dl>
          </>
        )}
      </section>
      {versions.length > 0 && (
        <section className={styles.section} aria-labelledby={`${ids}-history`}>
          <h2 id={`${ids}-history`}>{t.historyHeading}</h2>
          <DataTable caption={t.historyCaption} columns={historyColumns} rows={[...versions].sort((a, b) => b.version - a.version)} rowKey={(v) => String(v.version)} empty={t.noVersion} />
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
          <fieldset className={styles.fieldset} aria-describedby={errors.workLanguages === undefined ? undefined : `${ids}-languages-error`}>
            <legend>{t.workLanguages}</legend>
            <p className={styles.hint}>{t.workLanguagesHint}</p>
            {WORK_LANGUAGES.map((language) => (
              <Checkbox
                key={language}
                label={t.languages[language]}
                checked={draft.workLanguages.includes(language)}
                onChange={(event) => edit({ workLanguages: event.target.checked ? [...draft.workLanguages, language] : draft.workLanguages.filter((l) => l !== language) })}
              />
            ))}
            {errors.workLanguages !== undefined && <p id={`${ids}-languages-error`} className={styles.error}>{errors.workLanguages}</p>}
          </fieldset>
          <Select
            label={t.defaultWorkLanguage}
            value={draft.defaultWorkLanguage}
            options={WORK_LANGUAGES.map((value) => ({ value, label: t.languages[value] }))}
            error={errors.defaultWorkLanguage}
            onChange={(event) => edit({ defaultWorkLanguage: event.target.value as WorkLanguage })}
          />
          <div className={styles.actions}>
            <Button tone="quiet" onClick={review}>{t.review}</Button>
            <Button tone="quiet" onClick={() => { setDraft(draftOf(current)); setErrors({}); setReviewed(false); setFailure(null); }}>{t.reset}</Button>
          </div>
        </div>
        {reviewed && (
          <section aria-labelledby={`${ids}-diff`} className={styles.diff}>
            <h3 id={`${ids}-diff`}>{current === null ? t.diffHeadingFirst : t.diffHeading.replace("{n}", String(current.version))}</h3>
            {changes.length === 0 ? <p role="status">{t.diffNone}</p> : (
              <>
                <DataTable caption={t.diffHeading.replace("{n}", String(current?.version ?? 0))} columns={diffColumns} rows={changes} rowKey={(c) => c.field} empty={t.diffNone} />
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

/** OPE-R08: the institution's citation style and work languages, versioned (OPE-16). Every call goes through src/client. */
export default function ConfigPage() {
  const [read, setRead] = useState<ConfigRead | { kind: "loading" }>({ kind: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    void readConfig().then((result) => { if (active) setRead(result); });
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
  const current = read.current ?? newestOf(read.versions);
  return (
    <section aria-label={t.title}>
      <h2>{t.title}</h2>
      <p>{t.lead}</p>
      {notice !== null && <p role="status" className={styles.notice}>{notice}</p>}
      {staleNotice && <p role="alert" className={styles.notice}>{t.stale}</p>}
      {/* keyed by the version in force, so a published or reloaded configuration resets the form */}
      <ConfigForm
        key={current?.version ?? 0}
        current={current}
        versions={read.versions}
        onPublished={(n) => { setNotice(t.published.replace("{n}", String(n))); setStaleNotice(false); load(); }}
        onStale={() => { setNotice(null); setStaleNotice(true); load(); }}
        onDenied={() => setRead({ kind: "denied" })}
      />
    </section>
  );
}
