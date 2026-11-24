"use client";

// WEB-V20-NACIN-CITANJA: the reading-mode controls: one choice of steps per field and "Vrati na zadano". Controlled: the
// caller hands in the preferences and the store's `set`/`reset` (WEB-V20-POSTAVKE-DIJALOG mounts it in the settings dialog).
// Nothing here reads or writes the document, and nothing goes to the server.
import { Button, SegmentedControl } from "@ductura/ui";

import type { ReadingPrefs } from "../../shared/reading-prefs";
import { chosenStep, readingModeGroups, readingModeIsDefault, type ReadingModeField } from "./reading-mode-model";
import { readingModeHr as t } from "./messages.hr";
import styles from "./reading-mode.module.css";

export interface ReadingModeControlsProps {
  readonly prefs: ReadingPrefs;
  readonly onChange: <K extends ReadingModeField>(field: K, value: ReadingPrefs[K]) => void;
  readonly onReset: () => void;
}

export function ReadingModeControls({ prefs, onChange, onReset }: ReadingModeControlsProps) {
  const groups = readingModeGroups();
  return (
    <section className={styles.controls} aria-label={t.title}>
      <p className={styles.help}>{t.help}</p>
      {groups.map((group) => (
        <div key={group.field} className={styles.group}>
          <SegmentedControl
            label={group.label}
            options={group.options}
            value={prefs[group.field]}
            onChange={(value) => {
              const step = chosenStep(group.field, value);
              if (step !== null) onChange(group.field, step as never);
            }}
          />
        </div>
      ))}
      <Button type="button" tone="ghost" disabled={readingModeIsDefault(prefs)} onClick={onReset}>{t.reset}</Button>
    </section>
  );
}
