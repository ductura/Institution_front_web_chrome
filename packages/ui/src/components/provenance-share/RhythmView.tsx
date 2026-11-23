"use client";

import { useId } from "react";

import { barHeights, rhythmIsConsistent, secondsText, type RhythmRecord } from "./rhythm-logic";
import styles from "./ProvenanceShare.module.css";

export type RhythmViewLabels = {
  title: string;
  /** Always beside every number: the rhythm shows how text was entered, never who wrote it. */
  notice: string;
  /** The task teacher switched the recording of rhythm off. */
  off: string;
  /** Recorded, but no burst of typing. */
  empty: string;
  /** "Nalet {n}" with {n} the burst's number. */
  burst: string;
  duration: string;
  chars: string;
  longestPause: string;
  /** Unit after seconds: "s". */
  seconds: string;
  /** Accessible name of a graph: "Razmaci između unosa u naletu {n}". */
  graph: string;
  loading: string;
  none: string;
  error: string;
};

export type RhythmViewState =
  | { readonly kind: "loading" | "none" | "error" }
  | { readonly kind: "ready"; readonly rhythm: RhythmRecord };

/**
 * The rhythm of input of a submitted version (P-1, PRIJEDLOG), for the student and the task teacher
 * alike: per burst a graph of the gaps, its duration, characters and longest pause. No speed, no
 * score, no comparison, no threshold and no flag; the notice stands beside every burst.
 */
export function RhythmView({ labels, state }: { labels: RhythmViewLabels; state: RhythmViewState }) {
  const noticeId = useId();
  const status = (text: string, role: "status" | "alert" = "status") => (
    <section className={styles.panel} aria-label={labels.title}>
      <h2 className={styles.title}>{labels.title}</h2>
      <p className={role === "alert" ? styles.alert : styles.note} role={role}>{text}</p>
    </section>
  );
  if (state.kind === "error") return status(labels.error, "alert");
  if (state.kind !== "ready") return status(labels[state.kind]);
  const { rhythm } = state;
  if (labels.notice.trim() === "" || !rhythmIsConsistent(rhythm)) return status(labels.error, "alert");
  if (!rhythm.recorded) return status(labels.off);

  return (
    <section className={styles.panel} aria-label={labels.title}>
      <h2 className={styles.title}>{labels.title}</h2>
      <p className={styles.notice} id={noticeId} data-notice="">{labels.notice}</p>
      {rhythm.bursts.length === 0 && <p className={styles.note}>{labels.empty}</p>}
      {rhythm.bursts.map((burst, index) => {
        const n = String(index + 1);
        const heights = barHeights(burst);
        return (
          <div className={styles.group} key={index} data-part="burst" aria-describedby={noticeId}>
            <h3 className={styles.subtitle}>{labels.burst.replace("{n}", n)}</h3>
            <dl className={styles.share}>
              <div className={styles.entry}><dt className={styles.label}>{labels.duration}</dt><dd className={styles.value}>{secondsText(burst.durationMs)} {labels.seconds}</dd></div>
              <div className={styles.entry}><dt className={styles.label}>{labels.chars}</dt><dd className={styles.value}>{burst.chars}</dd></div>
              <div className={styles.entry}><dt className={styles.label}>{labels.longestPause}</dt><dd className={styles.value}>{secondsText(burst.longestPauseMs)} {labels.seconds}</dd></div>
            </dl>
            {heights.length > 0 && (
              <svg role="img" aria-label={labels.graph.replace("{n}", n)} viewBox={`0 0 ${heights.length * 4} 40`} preserveAspectRatio="none" width="100%" height="48" data-part="gaps">
                {heights.map((h, i) => (
                  <rect key={i} x={i * 4} y={40 - Math.max(1, h * 40)} width={3} height={Math.max(1, h * 40)} fill="currentColor" />
                ))}
              </svg>
            )}
          </div>
        );
      })}
    </section>
  );
}
