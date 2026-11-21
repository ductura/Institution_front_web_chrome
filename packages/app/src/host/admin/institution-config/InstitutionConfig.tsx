"use client";

import { Button, Card, Checkbox, Details, Select } from "@ductura/ui";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { useHost } from "../../context";
import { publishRules, readConfig, type ConfigRead } from "./client";
import { institutionConfigMessages as t } from "./messages.hr";
import { changedFields, languages, ruleFields, validateRules, type Language, type Rules, type Version } from "./rules";
import styles from "./institution-config.module.css";

const firstRules: Rules = { citationStyle: "fpzg", workLanguages: ["hr"], defaultWorkLanguage: "hr" };
const dateFormat = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zagreb" });
type RuleField = (typeof ruleFields)[number];

function valueOf(rules: Rules, field: RuleField) {
  if (field === "citationStyle") return t[rules.citationStyle];
  if (field === "workLanguages") return languages.filter((language) => rules.workLanguages.includes(language)).map((language) => t.languages[language]).join(", ");
  return t.languages[rules.defaultWorkLanguage];
}

function VersionDetails({ version }: { version: Version }) {
  return (
    <dl className={styles.values}>
      <div><dt>{t.effectiveFrom}</dt><dd><time dateTime={version.effectiveFrom}>{dateFormat.format(new Date(version.effectiveFrom))}</time></dd></div>
      {ruleFields.map((field) => <div key={field}><dt>{t[field]}</dt><dd>{valueOf(version.rules, field)}</dd></div>)}
    </dl>
  );
}

function RulesDiff({ previous, draft }: { previous: Rules | undefined; draft: Rules }) {
  const changes = changedFields(previous, draft);
  return (
    <Card title={previous === undefined ? t.firstVersion : t.diff}>
      <dl className={styles.values}>
        {changes.map((field) => (
          <div key={field}>
            <dt>{t[field]}</dt>
            {previous && <dd>{t.previous} · {valueOf(previous, field)}</dd>}
            <dd>{t.proposed} · {valueOf(draft, field)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function InstitutionConfig() {
  const { role, page } = useHost();
  return role === "admin" ? <RulesPage title={page.label} /> : null;
}

function RulesPage({ title }: { title: string }) {
  const [read, setRead] = useState<ConfigRead | null>(null);
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<Rules | null>(null);
  const [review, setReview] = useState(false);
  const [fieldError, setFieldError] = useState<ReturnType<typeof validateRules>>(null);
  const [notice, setNotice] = useState<"unchanged" | "invalid" | "conflict" | "unknown" | null>(null);
  const [published, setPublished] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const publishing = useRef(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const serverErrorId = useId();
  const languagesErrorId = useId();

  useEffect(() => {
    let active = true;
    void readConfig().then((result) => {
      if (!active) return;
      if (result.kind === "denied") setDraft(null);
      setRead(result);
    });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    if (review) reviewHeading.current?.focus();
  }, [review]);

  function reload() {
    setRead(null);
    setReview(false);
    setNotice(null);
    setRevision((previous) => previous + 1);
  }

  const config = read?.kind === "ready" ? read.data : null;
  const rules = draft ?? config?.current?.rules ?? firstRules;

  function update(next: Rules) {
    setDraft(next);
    setFieldError(null);
    setNotice(null);
    setPublished(null);
  }

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = validateRules(rules);
    setFieldError(invalid);
    setNotice(null);
    if (invalid !== null) return;
    if (changedFields(config?.current?.rules, rules).length === 0) {
      setNotice("unchanged");
      return;
    }
    setPublished(null);
    setReview(true);
  }

  async function publish() {
    if (config === null || !review || publishing.current || notice !== null) return;
    publishing.current = true;
    setBusy(true);
    const result = await publishRules(config.current?.version ?? 0, rules);
    publishing.current = false;
    setBusy(false);

    if (result.kind === "published") {
      setRead({ kind: "ready", data: { current: result.version, versions: [...config.versions, result.version] } });
      setDraft(null);
      setPublished(result.version.version);
    } else if (result.kind === "denied") {
      setDraft(null);
      setRead(result);
    } else {
      setNotice(result.kind);
    }
    setReview(false);
  }

  const stale = notice === "conflict" || notice === "unknown";
  return (
    <section className="page">
      <h1>{title}</h1>
      {read === null && <p role="status">{t.loading}</p>}
      {read?.kind === "denied" && <p role="alert">{t.denied}</p>}
      {read?.kind === "unavailable" && <><p role="alert">{t.unavailable}</p><Button onClick={reload}>{t.retry}</Button></>}
      {config && (
        <div className={styles.layout}>
          <section aria-labelledby="current-rules">
            <h2 id="current-rules">{t.current}</h2>
            {config.current ? <Card title={t.version(config.current.version)}><VersionDetails version={config.current} /></Card> : <p>{t.empty}</p>}
          </section>
          <section aria-labelledby="rule-history" className={styles.history}>
            <h2 id="rule-history">{t.history}</h2>
            {config.versions.length <= 1 && <p>{t.historyEmpty}</p>}
            {config.versions.slice(0, -1).reverse().map((version) => (
              <Details key={version.version} summary={t.version(version.version)}><VersionDetails version={version} /></Details>
            ))}
          </section>
          <section aria-labelledby="new-rules">
            <h2 id="new-rules" ref={reviewHeading} tabIndex={-1}>{t.newVersion}</h2>
            {published !== null && <p role="status">{t.published(published)}</p>}
            {stale ? (
              <><p role="alert">{notice === "conflict" ? t.conflict : t.publishUnknown}</p><Button onClick={reload}>{t.reload}</Button></>
            ) : review ? (
              <>
                <RulesDiff previous={config.current?.rules} draft={rules} />
                <div className={styles.actions}>
                  <Button busy={busy} onClick={() => { void publish(); }}>{busy ? t.publishing : t.publish}</Button>
                  <Button tone="quiet" disabled={busy} onClick={() => setReview(false)}>{t.edit}</Button>
                </div>
              </>
            ) : (
              <form onSubmit={verify} className={styles.form}>
                <fieldset className={styles.fields} aria-describedby={notice === "invalid" ? serverErrorId : undefined} aria-invalid={notice === "invalid" || undefined}>
                  <legend>{t.proposed}</legend>
                  <Select label={t.citationStyle} value={rules.citationStyle} options={[{ value: "fpzg", label: t.fpzg }]} />
                  <fieldset className={styles.fields} aria-describedby={fieldError === "workLanguages" ? languagesErrorId : undefined} aria-invalid={fieldError === "workLanguages" || undefined}>
                    <legend>{t.workLanguages}</legend>
                    {languages.map((language) => (
                      <Checkbox key={language} label={t.languages[language]} checked={rules.workLanguages.includes(language)} onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        update({ ...rules, workLanguages: languages.filter((item) => item === language ? checked : rules.workLanguages.includes(item)) });
                      }} />
                    ))}
                    {fieldError === "workLanguages" && <p id={languagesErrorId} role="alert">{t.selectLanguage}</p>}
                  </fieldset>
                  <Select label={t.defaultWorkLanguage} value={rules.defaultWorkLanguage} options={languages.map((language) => ({ value: language, label: t.languages[language] }))}
                    onChange={(event) => update({ ...rules, defaultWorkLanguage: event.currentTarget.value as Language })}
                    error={fieldError === "defaultWorkLanguage" ? t.invalidDefault : undefined} />
                  {notice === "invalid" && <p id={serverErrorId} role="alert">{t.invalidRules}</p>}
                </fieldset>
                {notice === "unchanged" && <p role="status">{t.noChange}</p>}
                <Button type="submit">{t.review}</Button>
              </form>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
