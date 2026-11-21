"use client";

import { useId } from "react";

import { InertButton } from "../assistant-states/InertButton";
import {
  matchIsConsistent, orderedShare, shareIsConsistent, splitBlock,
  type AiMatchRecord, type ProvenanceBlock, type ShareCategory, type ShareRecord,
} from "./provenance-logic";
import styles from "./ProvenanceShare.module.css";

export type ProvenanceShareLabels = {
  title: string;
  /** The notice that the record is not evidence of authorship. Always shown beside every percent and mark. */
  notice: string;
  categories: Readonly<Record<ShareCategory, string>>;
  /** For a category with text whose rounded percent is 0: „manje od 1 %”. */
  lessThanOne: string;
  /** The submitted version has no text (total 0): no percents are shown. */
  empty: string;
  textHeading: string;
  /** What a mark in the text means: „podudara se s odgovorom AI pomoćnika”. */
  matchLegend: string;
  noMarks: string;
  loading: string;
  /** The record is being computed after submission. */
  pending: string;
  /** No record for this submission. */
  none: string;
  /** The faculty has the record switched off. */
  disabled: string;
  error: string;
  retry: string;
};

export type ProvenanceShareState =
  | { readonly kind: "loading" | "pending" | "none" | "disabled" | "error" }
  | {
      readonly kind: "ready";
      readonly share: ShareRecord;
      /** Absent: no match marker for this submission. */
      readonly aiMatch?: AiMatchRecord;
      readonly blocks: readonly ProvenanceBlock[];
    };

export type ProvenanceShareProps = {
  labels: ProvenanceShareLabels;
  state: ProvenanceShareState;
  onRetry?: () => void;
};

const percentText = (percent: number, codePoints: number, labels: ProvenanceShareLabels) =>
  percent === 0 && codePoints > 0 ? labels.lessThanOne : `${percent} %`;

/**
 * How the text of a submitted version was entered, by category, and where it matches an answer
 * of the AI assistant (WEB-1220, N-AI-ATT variant U). The student and the teacher see the same
 * view: there is no viewer prop, no threshold, no colour per level, no sorting and no action on
 * the record. The notice stands in the same element as every percent and next to every mark, and
 * cannot be closed; without a notice text nothing of the record is shown.
 */
export function ProvenanceShare({ labels, state, onRetry }: ProvenanceShareProps) {
  const shareNoticeId = useId();
  const matchNoticeId = useId();
  const status = (text: string, role: "status" | "alert" = "status") => (
    <section className={styles.panel} aria-label={labels.title}>
      <h2 className={styles.title}>{labels.title}</h2>
      <p className={role === "alert" ? styles.alert : styles.note} role={role}>{text}</p>
      {role === "alert" && onRetry && <div className={styles.acts}><InertButton onClick={onRetry}>{labels.retry}</InertButton></div>}
    </section>
  );

  if (state.kind === "error") return status(labels.error, "alert");
  if (state.kind !== "ready") return status(labels[state.kind]);

  const { share, aiMatch, blocks } = state;
  const consistent = shareIsConsistent(share) && (!aiMatch || matchIsConsistent(aiMatch, blocks));
  if (labels.notice.trim() === "" || !consistent) return status(labels.error, "alert");

  return (
    <section className={styles.panel} aria-label={labels.title}>
      <h2 className={styles.title}>{labels.title}</h2>
      <div className={styles.group} data-part="share">
        <p className={styles.notice} id={shareNoticeId} data-notice="">{labels.notice}</p>
        {share.totalCodePoints === 0 ? (
          <p className={styles.note}>{labels.empty}</p>
        ) : (
          <dl className={styles.share} aria-describedby={shareNoticeId}>
            {orderedShare(share).map((e) => (
              <div className={styles.entry} key={e.category} data-category={e.category}>
                <dt className={styles.label}>{labels.categories[e.category]}</dt>
                <dd className={styles.value}>{percentText(e.percent, e.codePoints, labels)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {aiMatch && (
        <div className={styles.group} data-part="match">
          <h3 className={styles.subtitle}>{labels.textHeading}</h3>
          <p className={styles.notice} id={matchNoticeId} data-notice="">
            {labels.notice} <mark className={styles.mark}>{labels.matchLegend}</mark>
          </p>
          {aiMatch.spans.length === 0 && <p className={styles.note}>{labels.noMarks}</p>}
          <div className={styles.text}>
            {blocks.map((block) => (
              <p key={block.id} className={styles.block} data-block={block.id}>
                {splitBlock(block, aiMatch.spans)!.map((piece, i) =>
                  piece.matched
                    ? <mark key={i} className={styles.mark} aria-describedby={matchNoticeId}>{piece.text}</mark>
                    : <span key={i}>{piece.text}</span>,
                )}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
