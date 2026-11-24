// WEB-V20-NACIN-CITANJA: what the controls show. The four fields of the reading preferences that change the look of the
// sheet (the font belongs to WEB-V20-FONT-DISLEKSIJA); each is a closed set of steps taken from the preferences model.
import { DEFAULT_READING_PREFS, READING_STEPS, isStep, type ReadingPrefKey, type ReadingPrefs } from "../../shared/reading-prefs";
import { readingModeHr } from "./messages.hr";

export const READING_MODE_FIELDS = ["width", "lineHeight", "letterSpacing", "paragraphGap"] as const satisfies readonly ReadingPrefKey[];
export type ReadingModeField = (typeof READING_MODE_FIELDS)[number];

export interface ReadingModeGroup {
  readonly field: ReadingModeField;
  readonly label: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

/** One group per field, in the order of the screen; every step of the model has a label. */
export function readingModeGroups(): readonly ReadingModeGroup[] {
  return READING_MODE_FIELDS.map((field) => {
    const text = readingModeHr[field] as Record<string, string>;
    return { field, label: text.label ?? field, options: READING_STEPS[field].map((value) => ({ value, label: text[value] ?? value })) };
  });
}

/** A step chosen on screen: only a value of the closed set of that field passes, anything else is refused (null). */
export function chosenStep<K extends ReadingModeField>(field: K, value: string): ReadingPrefs[K] | null {
  return isStep(field, value) ? value : null;
}

/** Hands a chosen step to `onChange`, typed per field; a value outside the field's set is dropped. */
export function emitStep<K extends ReadingModeField>(field: K, value: string, onChange: (field: K, value: ReadingPrefs[K]) => void): void {
  const step = chosenStep(field, value);
  if (step !== null) onChange(field, step);
}

/** True when the four sheet fields are at their default (the font is not this task's and does not count). */
export const readingModeIsDefault = (prefs: ReadingPrefs): boolean => READING_MODE_FIELDS.every((f) => prefs[f] === DEFAULT_READING_PREFS[f]);
