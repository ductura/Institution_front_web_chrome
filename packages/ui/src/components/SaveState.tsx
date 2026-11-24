import { saveStateContent, type SaveStateName } from "./save-state";
import styles from "./SaveState.module.css";

/**
 * `live` (default true): the chip is a live status. False leaves the same
 * chip without one, for a page that announces only a change of level itself.
 */
export type SaveStateProps = { state: SaveStateName; blocked?: boolean; label?: string; live?: boolean };

/** The save-state chip: a live status with a dot whose look follows the tone. */
export function SaveState({ state, blocked = false, label, live = true }: SaveStateProps) {
  const { text, tone } = saveStateContent(state, blocked);
  return (
    <span role={live ? "status" : undefined} className={styles.chip} data-tone={tone}>
      <span className={styles.dot} aria-hidden="true" />
      {label ?? text}
    </span>
  );
}
