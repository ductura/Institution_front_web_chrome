import { saveStateContent, type SaveStateName } from "./save-state";
import styles from "./SaveState.module.css";

export type SaveStateProps = { state: SaveStateName; blocked?: boolean; label?: string };

/** The save-state chip: a live status with a dot whose look follows the tone. */
export function SaveState({ state, blocked = false, label }: SaveStateProps) {
  const { text, tone } = saveStateContent(state, blocked);
  return (
    <span role="status" className={styles.chip} data-tone={tone}>
      <span className={styles.dot} aria-hidden="true" />
      {label ?? text}
    </span>
  );
}
