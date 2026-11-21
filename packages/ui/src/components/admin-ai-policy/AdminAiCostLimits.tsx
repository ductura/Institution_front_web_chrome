"use client";

import { useEffect, useId, useRef, useState } from "react";

import { InertButton } from "../assistant-states/InertButton";
import buttonStyles from "../Button.module.css";
import fieldStyles from "../TextField.module.css";
import styles from "./AdminAiCostLimits.module.css";
import { LIMIT_FIELDS, checkLimits, microToEur, type CostLimits, type LimitField } from "./cost-logic";

export type AdminAiCostLimitsLabels = {
  title: string;
  /** The operator's cap, with the period in its own words: (amount) => „Strop operatera: … dnevno”. */
  cap: (money: string) => string;
  /** No cap is published yet, so nothing can be published. */
  noCap: string;
  /** Formats an amount for display: (euros with a decimal comma) => „0,20 EUR”. */
  money: (eur: string) => string;
  /** The field labels, one per limit. */
  fields: Readonly<Record<LimitField, string>>;
  /** Under the fields: how to write an amount. */
  amountHint: string;
  invalid: string;
  aboveCap: (capMoney: string) => string;
  assignmentAboveDay: string;
  /** Empty or incomplete configuration: the assistant is off. */
  notConfigured: string;
  review: string;
  previewTitle: string;
  previewNote: string;
  /** Before the current value in the preview, „Sada”. */
  current: string;
  notSet: string;
  publish: string;
  back: string;
  publishing: string;
  published: (version: number) => string;
  /** The publish RPC answered `limit_above_cap`: nothing was published. */
  serverAboveCap: string;
  publishFailed: string;
  spentTitle: string;
  /** The institution's total, with the period in its own words. */
  spent: (money: string) => string;
  spentNote: string;
  historyTitle: string;
  historyEmpty: string;
  version: (version: number, publishedAt: string) => string;
  loading: string;
  loadFailed: string;
  retry: string;
};

/** One published version; values are micro-euro strings or null when not set, `publishedAt` is display text. */
export type CostConfigVersion = {
  readonly versionNo: number;
  readonly publishedAt: string;
  readonly studentDayMicro: string | null;
  readonly studentAssignmentDayMicro: string | null;
  readonly reserveMicro: string | null;
};

/** The institution's spend is one total; the type has no place for a student (OA-5). */
export type AdminAiCostLimitsState =
  | { readonly kind: "loading" }
  | { readonly kind: "load_failed" }
  | { readonly kind: "ready"; readonly capMicro: string | null; readonly spentMicro: string; readonly versions: readonly CostConfigVersion[] };

export type AdminAiCostLimitsProps = {
  labels: AdminAiCostLimitsLabels;
  state: AdminAiCostLimitsState;
  /** Called once with exactly the reviewed values; the parent calls publish_cost_config. */
  onPublish: (limits: CostLimits) => void;
  onRetry?: () => void;
  publishing?: boolean;
  publishError?: "limit_above_cap" | "failed";
};

/**
 * Institution administrator's cost limits for the assistant (A-AI-POL): the student limits and the
 * reservation amount are published as a new configuration version after a preview. Older versions
 * are read only, and spend is shown as the institution's total only.
 */
export function AdminAiCostLimits({ labels, state, onPublish, onRetry, publishing = false, publishError }: AdminAiCostLimitsProps) {
  const [sentFrom, setSentFrom] = useState<number | null>(null);

  if (state.kind === "loading") {
    return (
      <div className={styles.limits} aria-busy="true">
        <div className={styles.skel} aria-hidden="true" />
        <div className={styles.skel} aria-hidden="true" />
        <p className={styles.meta} role="status">{labels.loading}</p>
      </div>
    );
  }
  if (state.kind === "load_failed") {
    return (
      <div className={styles.limits}>
        <p className={styles.alert} role="alert">{labels.loadFailed}</p>
        {onRetry === undefined ? null : <InertButton tone="quiet" onClick={onRetry}>{labels.retry}</InertButton>}
      </div>
    );
  }

  const versions = [...state.versions].sort((a, b) => b.versionNo - a.versionNo);
  const latest = versions[0];
  const latestNo = latest?.versionNo ?? 0;
  const money = (micro: string | null) => {
    const eur = micro === null ? null : microToEur(micro);
    return eur === null ? labels.notSet : labels.money(eur);
  };
  const configured = latest !== undefined && LIMIT_FIELDS.every((field) => latest[field] !== null);
  const note = sentFrom !== null && latestNo > sentFrom ? labels.published(latestNo) : publishing ? labels.publishing : "";

  return (
    <div className={styles.limits}>
      <h2 className={styles.title}>{labels.title}</h2>
      {configured ? null : <p className={styles.note}>{labels.notConfigured}</p>}
      <p className={styles.meta} role="status">{note}</p>
      <Editor
        key={latestNo}
        labels={labels}
        latest={latest}
        capMicro={state.capMicro}
        money={money}
        publishing={publishing}
        publishError={publishError}
        onPublish={(limits) => {
          setSentFrom(latestNo);
          onPublish(limits);
        }}
      />
      <section className={styles.section} aria-label={labels.spentTitle}>
        <h3 className={styles.heading}>{labels.spentTitle}</h3>
        <p className={styles.total}>{labels.spent(money(state.spentMicro))}</p>
        <p className={styles.meta}>{labels.spentNote}</p>
      </section>
      <section className={styles.section} aria-label={labels.historyTitle}>
        <h3 className={styles.heading}>{labels.historyTitle}</h3>
        {versions.length === 0 ? (
          <p className={styles.meta}>{labels.historyEmpty}</p>
        ) : (
          <ol className={styles.history}>
            {versions.map((version) => (
              <li key={version.versionNo}>
                <p className={styles.label}>{labels.version(version.versionNo, version.publishedAt)}</p>
                <Values labels={labels} money={money} values={version} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

type EditorProps = {
  labels: AdminAiCostLimitsLabels;
  latest: CostConfigVersion | undefined;
  capMicro: string | null;
  money: (micro: string | null) => string;
  publishing: boolean;
  publishError: "limit_above_cap" | "failed" | undefined;
  onPublish: (limits: CostLimits) => void;
};

function Editor({ labels, latest, capMicro, money, publishing, publishError, onPublish }: EditorProps) {
  const id = useId();
  const [draft, setDraft] = useState<Record<LimitField, string>>(() => {
    const value = (micro: string | null | undefined) => (micro == null ? "" : (microToEur(micro) ?? ""));
    return { studentDayMicro: value(latest?.studentDayMicro), studentAssignmentDayMicro: value(latest?.studentAssignmentDayMicro), reserveMicro: value(latest?.reserveMicro) };
  });
  const [attempted, setAttempted] = useState(false);
  const [reviewed, setReviewed] = useState<CostLimits | null>(null);
  const previewTitle = useRef<HTMLHeadingElement>(null);
  const wasReviewing = useRef(false);

  useEffect(() => {
    if (reviewed !== null) previewTitle.current?.focus();
    else if (wasReviewing.current) document.getElementById(`${id}-review`)?.querySelector("button")?.focus();
    wasReviewing.current = reviewed !== null;
  }, [reviewed, id]);

  const { limits, errors } = checkLimits(draft, capMicro);
  const shown = LIMIT_FIELDS.filter((field) => errors[field] !== undefined && (attempted || draft[field] !== ""));
  const capMoney = capMicro === null ? "" : money(capMicro);
  const errorText = (field: LimitField) => {
    const error = errors[field];
    return error === "limit_above_cap" ? labels.aboveCap(capMoney) : error === "assignment_above_day" ? labels.assignmentAboveDay : labels.invalid;
  };
  const blockedBy = capMicro === null ? `${id}-cap` : shown.length > 0 ? `${id}-${shown[0]!}-error` : undefined;
  const serverError = publishError === undefined ? null : (
    <p id={`${id}-server`} className={styles.alert} role="alert">
      {publishError === "limit_above_cap" ? labels.serverAboveCap : labels.publishFailed}
    </p>
  );

  if (reviewed !== null) {
    return (
      <section className={styles.preview} aria-labelledby={`${id}-preview`}>
        <h3 id={`${id}-preview`} ref={previewTitle} className={styles.heading} tabIndex={-1}>{labels.previewTitle}</h3>
        <p className={styles.meta}>{labels.previewNote}</p>
        <Values labels={labels} money={money} values={reviewed} previous={latest} />
        {serverError}
        <div className={styles.actions}>
          <InertButton
            inert={publishError === "limit_above_cap"}
            busy={publishing}
            describedBy={publishError === undefined ? undefined : `${id}-server`}
            onClick={() => onPublish(reviewed)}
          >
            {labels.publish}
          </InertButton>
          <InertButton tone="quiet" inert={publishing} onClick={() => setReviewed(null)}>{labels.back}</InertButton>
        </div>
      </section>
    );
  }

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setAttempted(true);
        if (blockedBy === undefined && limits !== null) setReviewed(limits);
      }}
    >
      <p id={`${id}-cap`} className={styles.meta}>{capMicro === null ? labels.noCap : labels.cap(capMoney)}</p>
      {LIMIT_FIELDS.map((field) => {
        const error = shown.includes(field);
        return (
          <div key={field} className={fieldStyles.field}>
            <label htmlFor={`${id}-${field}`} className={fieldStyles.label}>{labels.fields[field]}</label>
            <input
              id={`${id}-${field}`}
              className={fieldStyles.input}
              inputMode="decimal"
              autoComplete="off"
              value={draft[field]}
              readOnly={capMicro === null}
              aria-invalid={error || undefined}
              aria-describedby={error ? `${id}-${field}-error` : `${id}-hint`}
              onChange={(event) => {
                const value = event.target.value;
                setDraft((old) => ({ ...old, [field]: value }));
              }}
            />
            {error ? <p id={`${id}-${field}-error`} className={styles.alert} role="alert">{errorText(field)}</p> : null}
          </div>
        );
      })}
      <p id={`${id}-hint`} className={styles.meta}>{labels.amountHint}</p>
      {serverError}
      <div id={`${id}-review`} className={styles.actions}>
        {/* A submit button that stays focusable when blocked (aria-disabled); the submit handler checks again. */}
        <button type="submit" className={buttonStyles.button} data-tone="primary" aria-disabled={blockedBy === undefined ? undefined : true} aria-describedby={blockedBy}>
          {labels.review}
        </button>
      </div>
    </form>
  );
}

function Values({ labels, money, values, previous }: {
  labels: AdminAiCostLimitsLabels;
  money: (micro: string | null) => string;
  values: Readonly<Record<LimitField, string | null>>;
  previous?: CostConfigVersion | undefined;
}) {
  return (
    <dl className={styles.values}>
      {LIMIT_FIELDS.map((field) => (
        <div key={field} className={styles.value}>
          <dt>{labels.fields[field]}</dt>
          <dd>
            <b>{money(values[field])}</b>
            {previous === undefined ? null : <span className={styles.meta}> {labels.current}: {money(previous[field])}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
