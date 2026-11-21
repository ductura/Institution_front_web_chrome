"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { InertButton } from "../assistant-states/InertButton";
import { Checkbox } from "../Checkbox";
import styles from "./DeclarationAi.module.css";
import {
  attachedConversations,
  confirmPayload,
  isRequired,
  reviewKey,
  visibleTurns,
  type DeclarationAttachment,
  type DeclarationConversation,
} from "./declaration-logic";

export type DeclarationAiLabels = {
  title: string;
  /** No recorded use of the assistant on this work; nothing is attached. */
  noUse: string;
  /** The assignment does not allow the built-in assistant. */
  aiDisabled: string;
  loading: string;
  error: string;
  /** Under the error: submitting does not depend on the declaration. */
  errorNote: string;
  retry: string;
  usesCaption: string;
  colPurpose: string;
  colProvider: string;
  colPhase: string;
  /** Heading of the required list; the count is appended. */
  requiredHeading: string;
  /** Why required conversations cannot be left out, even after the text is deleted. */
  requiredNote: string;
  othersLegend: string;
  /** Others stay the student's unless attached (D-41). */
  othersNote: string;
  /** Opens the exact versions of everything attached; the count is appended. */
  review: string;
  /** Why the confirmation waits for the review. */
  reviewFirst: string;
  /** Heading of the review; the count is appended. */
  reviewTitle: string;
  reviewNote: string;
  reviewDone: string;
  requiredTag: string;
  chosenTag: string;
  /** Foot of a picked conversation in the review. */
  chosenFoot: string;
  student: string;
  /** attachment_stale: „Razgovor se promijenio, pregledaj ponovno.” */
  stale: string;
  confirm: string;
};

export type DeclarationUse = { readonly purpose: string; readonly provider: string; readonly phase: string };

export type DeclarationAiState =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "no_use" }
  | { readonly kind: "ai_disabled" }
  | { readonly kind: "ready"; readonly uses: readonly DeclarationUse[]; readonly conversations: readonly DeclarationConversation[] };

export type DeclarationAiProps = {
  labels: DeclarationAiLabels;
  state: DeclarationAiState;
  /** Sends exactly the versions shown in the review. */
  onConfirm: (attachments: DeclarationAttachment[]) => void;
  onRetry?: () => void;
};

/**
 * The AI part of the student's declaration (S31-AI, states 1 to 6). Required conversations are
 * locked with their reason; others go only by the student's pick (student_added). Confirming
 * waits for a review of the exact versions and is blocked while any of them is stale.
 */
export function DeclarationAi({ labels, state, onConfirm, onRetry }: DeclarationAiProps) {
  const titleId = useId();
  const body = (() => {
    switch (state.kind) {
      case "loading":
        return (
          <div aria-busy="true">
            <div className={styles.skel} aria-hidden="true" />
            <div className={styles.skel} aria-hidden="true" />
            <p className={styles.note} role="status">{labels.loading}</p>
          </div>
        );
      case "error":
        return (
          <>
            <p className={styles.alert} role="alert">{labels.error}</p>
            <p className={styles.note}>{labels.errorNote}</p>
            {onRetry && <div className={styles.acts}><InertButton onClick={onRetry}>{labels.retry}</InertButton></div>}
          </>
        );
      case "no_use":
      case "ai_disabled":
        return (
          <>
            <p className={styles.text}>{state.kind === "no_use" ? labels.noUse : labels.aiDisabled}</p>
            <div className={styles.acts}><InertButton onClick={() => onConfirm([])}>{labels.confirm}</InertButton></div>
          </>
        );
      case "ready":
        return <Ready labels={labels} uses={state.uses} conversations={state.conversations} onConfirm={onConfirm} />;
    }
  })();
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>{labels.title}</h2>
      {body}
    </section>
  );
}

type ReadyProps = {
  labels: DeclarationAiLabels;
  uses: readonly DeclarationUse[];
  conversations: readonly DeclarationConversation[];
  onConfirm: (attachments: DeclarationAttachment[]) => void;
};

function Ready({ labels, uses, conversations, onConfirm }: ReadyProps) {
  const reasonId = `${useId()}-reason`;
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set());
  const [reviewing, setReviewing] = useState(false);
  const [reviewed, setReviewed] = useState<string | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const reviewButton = useRef<HTMLDivElement>(null);
  const returning = useRef(false);

  const attached = useMemo(() => attachedConversations(conversations, chosen), [conversations, chosen]);
  const key = reviewKey(attached);
  const stale = attached.filter((c) => c.stale);
  const canConfirm = stale.length === 0 && (attached.length === 0 || reviewed === key);
  const required = conversations.filter(isRequired);
  const others = conversations.filter((c) => !isRequired(c));

  useEffect(() => {
    if (reviewing) reviewHeading.current?.focus();
    else if (returning.current) reviewButton.current?.querySelector("button")?.focus();
    returning.current = false;
  }, [reviewing]);

  const toggle = (id: string) =>
    setChosen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (reviewing) {
    return (
      <div className={styles.review}>
        <h3 ref={reviewHeading} tabIndex={-1} className={styles.subtitle}>{`${labels.reviewTitle} (${attached.length})`}</h3>
        <p className={styles.note}>{labels.reviewNote}</p>
        {attached.map((c) => (
          <article key={c.conversationId} className={styles.conversation} aria-label={c.title}>
            <h4 className={styles.conversationTitle}>
              {c.title} <span className={styles.tag}>{isRequired(c) ? labels.requiredTag : labels.chosenTag}</span>
            </h4>
            <ol className={styles.turns}>
              {visibleTurns(c).map((turn) => (
                <li key={turn.seq} className={styles.turn} data-author={turn.author}>
                  <span className={styles.who}>{turn.author === "student" ? labels.student : c.assistantName}</span>
                  <span>{turn.text}</span>
                </li>
              ))}
            </ol>
            <p className={styles.meta}>{c.requiredBecause ?? labels.chosenFoot}</p>
            {c.stale && <p className={styles.alert} role="alert">{labels.stale}</p>}
          </article>
        ))}
        <div className={styles.acts}>
          <InertButton onClick={() => { setReviewed(key); returning.current = true; setReviewing(false); }}>{labels.reviewDone}</InertButton>
        </div>
      </div>
    );
  }

  return (
    <>
      {uses.length > 0 && (
        <table className={styles.uses}>
          <caption className={styles.caption}>{labels.usesCaption}</caption>
          <thead><tr><th scope="col">{labels.colPurpose}</th><th scope="col">{labels.colProvider}</th><th scope="col">{labels.colPhase}</th></tr></thead>
          <tbody>
            {uses.map((use, index) => (
              <tr key={index}><td>{use.purpose}</td><td>{use.provider}</td><td>{use.phase}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {required.length > 0 && (
        <fieldset className={styles.group}>
          <legend className={styles.subtitle}>{`${labels.requiredHeading} (${required.length})`}</legend>
          {required.map((c) => (
            <div key={c.conversationId}>
              <Checkbox label={c.title} hint={c.requiredBecause} checked aria-disabled="true" onChange={() => undefined} />
              {c.stale && <p className={styles.alert} role="alert">{labels.stale}</p>}
            </div>
          ))}
          <p className={styles.note}>{labels.requiredNote}</p>
        </fieldset>
      )}
      {others.length > 0 && (
        <fieldset className={styles.group}>
          <legend className={styles.subtitle}>{labels.othersLegend}</legend>
          {others.map((c) => (
            <div key={c.conversationId}>
              <Checkbox label={c.title} checked={chosen.has(c.conversationId)} onChange={() => toggle(c.conversationId)} />
              {c.stale && chosen.has(c.conversationId) && <p className={styles.alert} role="alert">{labels.stale}</p>}
            </div>
          ))}
          <p className={styles.note}>{labels.othersNote}</p>
        </fieldset>
      )}
      {!canConfirm && <p id={reasonId} className={styles.meta}>{stale.length > 0 ? labels.stale : labels.reviewFirst}</p>}
      <div className={styles.acts}>
        {attached.length > 0 && (
          <div ref={reviewButton}>
            <InertButton tone="quiet" onClick={() => setReviewing(true)}>{`${labels.review} (${attached.length})`}</InertButton>
          </div>
        )}
        <InertButton inert={!canConfirm} describedBy={canConfirm ? undefined : reasonId} onClick={() => onConfirm(confirmPayload(attached))}>
          {labels.confirm}
        </InertButton>
      </div>
    </>
  );
}
