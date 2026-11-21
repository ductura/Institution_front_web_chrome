"use client";

import { useId } from "react";

import { InertButton } from "../assistant-states/InertButton";
import styles from "./AssistantBudget.module.css";
import { budgetShare } from "./budget-logic";

export type AssistantBudgetLabels = {
  /** Row label for the per-assignment counter, „Danas na ovom zadatku”. */
  assignmentToday: string;
  /** Row label for the daily counter over all assignments. */
  allToday: string;
  smallerPart: string;
  largerPart: string;
  /** Count text once a limit is used up. */
  usedUp: string;
  /** Accessible names of the bar, one per band. */
  barSmaller: string;
  barLarger: string;
  barFull: string;
  /** Under the counter while there is room: when it resets and whom it concerns. */
  resets: string;
  /** Most of today's limit is used (status). */
  near: string;
  /** The per-assignment limit is used up for today (alert). */
  assignmentReached: string;
  /** The daily limit over all assignments is used up (alert). */
  dayReached: string;
  /** The service limit is reached for everyone (alert); never shown as the student's use. */
  serviceReached: string;
  serviceNote: string;
  /** The assistant is off for this assignment (ai_disabled). */
  disabled: string;
  /** Read out while the counter loads. */
  loading: string;
  /** The send action, shown inert when no request can go out. */
  send: string;
};

/**
 * What the parent knows about today's limit. Amounts are whole micro-euros as decimal strings
 * (bigint, ai-request-v1); `budget_exceeded` and `ai_disabled` are route outcomes.
 */
export type AssistantBudgetState =
  | { readonly kind: "loading" }
  | { readonly kind: "usage"; readonly usedMicro: string; readonly limitMicro: string }
  | { readonly kind: "budget_exceeded"; readonly scope: "assignment" | "day" | "service" }
  | { readonly kind: "ai_disabled" };

export type AssistantBudgetProps = {
  labels: AssistantBudgetLabels;
  state: AssistantBudgetState;
};

/**
 * The student's use of today's assistant limit (s16-bud, B1 to B6). Only the share of the limit
 * is shown, never money or a number of requests left; the server decides every request. The
 * counter is not in the focus order, and changes are announced through status or alert.
 */
export function AssistantBudget({ labels, state }: AssistantBudgetProps) {
  const alertId = `${useId()}-alert`;

  if (state.kind === "loading") {
    return (
      <div className={styles.budget} aria-busy="true">
        <div className={styles.skel} aria-hidden="true" />
        <div className={styles.skel} data-line="bar" aria-hidden="true" />
        <p className={styles.meta} role="status">
          {labels.loading}
        </p>
      </div>
    );
  }

  if (state.kind === "usage") {
    const share = budgetShare(state.usedMicro, state.limitMicro);
    if (share === null) {
      return (
        <div className={styles.budget}>
          <p className={styles.meta}>{labels.resets}</p>
        </div>
      );
    }
    if (share.band === "full") return <Blocked labels={labels} alertId={alertId} text={labels.assignmentReached} bar />;
    const large = share.band !== "small";
    return (
      <div className={styles.budget}>
        <p className={styles.row}>
          <span>{labels.assignmentToday}</span>
          <b className={styles.count}>{large ? labels.largerPart : labels.smallerPart}</b>
        </p>
        <div className={styles.bar} data-band={share.band} role="img" aria-label={large ? labels.barLarger : labels.barSmaller}>
          <span className={styles.fill} style={{ width: `${String(share.percent)}%` }} />
        </div>
        {share.band === "near" ? (
          <p className={styles.note} role="status">
            {labels.near}
          </p>
        ) : (
          <p className={styles.meta}>{labels.resets}</p>
        )}
      </div>
    );
  }

  if (state.kind === "ai_disabled") return <Blocked labels={labels} alertId={alertId} text={labels.disabled} />;
  if (state.scope === "assignment") return <Blocked labels={labels} alertId={alertId} text={labels.assignmentReached} bar />;
  if (state.scope === "day") return <Blocked labels={labels} alertId={alertId} text={labels.dayReached} day />;
  return <Blocked labels={labels} alertId={alertId} text={labels.serviceReached} note={labels.serviceNote} />;
}

function Blocked({ labels, alertId, text, bar = false, day = false, note }: { labels: AssistantBudgetLabels; alertId: string; text: string; bar?: boolean; day?: boolean; note?: string }) {
  return (
    <div className={styles.budget}>
      {day ? (
        <p className={styles.row}>
          <span>{labels.allToday}</span>
          <b className={styles.count}>{labels.usedUp}</b>
        </p>
      ) : null}
      {bar ? (
        <div className={styles.bar} data-band="full" role="img" aria-label={labels.barFull}>
          <span className={styles.fill} style={{ width: "100%" }} />
        </div>
      ) : null}
      <p id={alertId} className={styles.alert} role="alert">
        {text}
      </p>
      <InertButton inert describedBy={alertId}>
        {labels.send}
      </InertButton>
      {note === undefined ? null : <p className={styles.meta}>{note}</p>}
    </div>
  );
}
