import { useId } from "react";

import { InertButton } from "../assistant-states/InertButton";
import styles from "./AssistantPurposePicker.module.css";

export type AssistantPurpose = {
  /** Contract key, for example "proofreading". */
  key: string;
  /** 1: on by default; 2: on only when the task's teacher switches it on. */
  level: 1 | 2;
  label: string;
  enabled: boolean;
  /** Why the purpose is off, read with it (aria-describedby). */
  note?: string;
};

export type AssistantPurposePickerLabels = {
  heading: string;
  levelOne: string;
  levelTwo: string;
  empty: string;
  busy: string;
  /** Text under the list, for example that level 2 is not switched on. */
  foot?: string;
};

export type AssistantPurposePickerProps = {
  purposes: readonly AssistantPurpose[];
  labels: AssistantPurposePickerLabels;
  onSelect: (key: string) => void;
  selectedKey?: string;
  /** Purposes are being loaded or checked: choices wait. */
  busy?: boolean;
  /** Loading or checking failed, announced as an alert. */
  error?: string;
  /** The whole picker is off; the reason is read with every choice. */
  disabledReason?: string;
};

/**
 * Purpose choice before the assistant is used (s16, picker; purpose catalogue v2, D-268).
 * Purposes that are off stay in the keyboard path and say why, instead of disappearing.
 */
export function AssistantPurposePicker({ purposes, labels, onSelect, selectedKey, busy = false, error, disabledReason }: AssistantPurposePickerProps) {
  const base = useId();
  const reasonId = `${base}-reason`;
  const groups = [
    { level: 1 as const, title: labels.levelOne },
    { level: 2 as const, title: labels.levelTwo },
  ].map((group) => ({ ...group, items: purposes.filter((purpose) => purpose.level === group.level) }))
    .filter((group) => group.items.length > 0);

  return (
    <section className={styles.picker} data-assistant-state="purpose" aria-busy={busy || undefined} aria-labelledby={`${base}-heading`}>
      <h2 className={styles.heading} id={`${base}-heading`}>{labels.heading}</h2>
      {error ? <p className={styles.alert} role="alert">{error}</p> : null}
      <p className={styles.meta} role="status">{busy ? labels.busy : ""}</p>
      {disabledReason ? <p className={styles.meta} id={reasonId}>{disabledReason}</p> : null}
      {purposes.length === 0 && !busy ? <p className={styles.meta}>{labels.empty}</p> : null}
      {groups.map((group) => (
        <div key={group.level} className={styles.group} role="group" aria-labelledby={`${base}-level-${group.level}`}>
          <h3 className={styles.level} id={`${base}-level-${group.level}`}>{group.title}</h3>
          <ul className={styles.list}>
            {group.items.map((purpose) => {
              const noteId = `${base}-note-${purpose.key}`;
              const off = !purpose.enabled || Boolean(disabledReason);
              const describedBy = [purpose.note && !purpose.enabled ? noteId : null, disabledReason ? reasonId : null].filter(Boolean).join(" ") || undefined;
              return (
                <li key={purpose.key} className={styles.item}>
                  <InertButton tone={selectedKey === purpose.key ? "primary" : "quiet"} inert={off} busy={busy}
                    describedBy={describedBy} pressed={selectedKey === purpose.key}
                    onClick={() => onSelect(purpose.key)}>
                    {purpose.label}
                  </InertButton>
                  {purpose.note && !purpose.enabled ? <span className={styles.note} id={noteId}>{purpose.note}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {labels.foot ? <p className={styles.meta}>{labels.foot}</p> : null}
    </section>
  );
}
