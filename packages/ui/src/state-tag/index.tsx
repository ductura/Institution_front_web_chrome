import styles from "./state-tag.module.css";
import { stateTagMessages } from "./messages.hr";

/** The states a submission row can show (WEB-29); the list is closed. */
export const SUBMISSION_STATES = ["submitted", "not_submitted", "late", "pending", "gap"] as const;
export type SubmissionState = (typeof SUBMISSION_STATES)[number];

/** A mark beside the text, so the state never rests on colour alone. */
const MARKS: Record<SubmissionState, string> = {
  submitted: "✓",
  not_submitted: "○",
  late: "!",
  pending: "…",
  gap: "◌",
};

export type StateTagProps = { state: SubmissionState };

/**
 * The state of a submission as a tag (WEB-29): the Croatian text always
 * stands beside the colour and a mark; a record gap is a warning, never an
 * error colour (D-62).
 */
export function StateTag({ state }: StateTagProps) {
  return (
    <span className={styles.tag} data-state={state}>
      <span aria-hidden="true" className={styles.mark}>{MARKS[state]}</span>
      {stateTagMessages[state]}
    </span>
  );
}
