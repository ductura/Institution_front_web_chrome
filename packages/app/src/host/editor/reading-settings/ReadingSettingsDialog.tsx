"use client";

// WEB-V20-POSTAVKE-DIJALOG: "Prikaz i čitanje", one dialog for the personal reading settings: font of the work's text,
// reading mode (the controls of WEB-V20-NACIN-CITANJA) and the read-aloud speed. "Zadano" puts all of them back.
// Everything stays in this browser (localStorage); nothing here reads or writes the document or calls the server.
import { useSyncExternalStore } from "react";
import { Button, Dialog, SegmentedControl } from "@ductura/ui";

import { createReadingStore, DEFAULT_READING_PREFS, isStep, type ReadingPrefKey, type ReadingPrefs, type ReadingStore } from "../../shared/reading-prefs";
import { ReadingModeControls } from "../reading-mode/ReadingModeControls";
import type { ReadAloudRate } from "../read-aloud/controller";
import { readingSettingsHr as t } from "./messages.hr";
import {
  READ_ALOUD_RATE_STEPS, isRateStep, readAloudRate, resetReadAloudRateNow, setReadAloudRate, subscribeReadAloudRate,
} from "./rate-store";

let sharedStore: ReadingStore | null = null;
/** One store for the page: creating it also puts the saved choice on <html>, so it holds after a refresh. */
export const readingStore = (): ReadingStore => (sharedStore ??= createReadingStore());

const rateLabels: Record<(typeof READ_ALOUD_RATE_STEPS)[number], string> = { 0.75: t.rate.slow, 1: t.rate.standard, 1.25: t.rate.fast, 1.5: t.rate.faster };

export const FONT_OPTIONS = [
  { value: "standard", label: t.font.standard },
  { value: "dyslexia", label: t.font.dyslexia },
] as const;
export const RATE_OPTIONS = READ_ALOUD_RATE_STEPS.map((step) => ({ value: String(step), label: rateLabels[step] }));

/** A value chosen on screen: only a step of the closed set passes, anything else is refused (null). */
export const chosenRate = (value: string): ReadAloudRate | null => {
  const n = Number(value);
  return isRateStep(n) ? n : null;
};

/** The font, reading mode and speed are at their defaults. */
export const readingSettingsAreDefault = (prefs: ReadingPrefs, rate: ReadAloudRate): boolean =>
  (Object.keys(DEFAULT_READING_PREFS) as ReadingPrefKey[]).every((k) => prefs[k] === DEFAULT_READING_PREFS[k]) && rate === 1;

/** "Zadano": every reading preference and the speed back to their defaults, in the store and on <html>. */
export function resetReadingSettings(store: ReadingStore): void {
  store.reset();
  resetReadAloudRateNow();
}

export function ReadingSettingsDialog({ open, onClose, store = readingStore() }: { open: boolean; onClose: () => void; store?: ReadingStore }) {
  const prefs = useSyncExternalStore(store.subscribe, store.get, store.get);
  const rate = useSyncExternalStore(subscribeReadAloudRate, readAloudRate, readAloudRate);
  return (
    <Dialog open={open} title={t.title} onClose={onClose}
      actions={<>
        <Button tone="quiet" disabled={readingSettingsAreDefault(prefs, rate)} onClick={() => resetReadingSettings(store)}>{t.reset}</Button>
        <Button onClick={onClose}>{t.done}</Button>
      </>}>
      <p>{t.intro}</p>
      <h3>{t.font.label}</h3>
      <SegmentedControl label={t.font.label} options={FONT_OPTIONS} value={prefs.font}
        onChange={(value) => { if (isStep("font", value)) store.set("font", value); }} />
      <p>{t.font.help}</p>
      <ReadingModeControls prefs={prefs} onChange={(field, value) => store.set(field, value)} onReset={() => {
        for (const field of ["width", "lineHeight", "letterSpacing", "paragraphGap"] as const) store.set(field, DEFAULT_READING_PREFS[field]);
      }} />
      <h3>{t.rate.label}</h3>
      <SegmentedControl label={t.rate.label} options={RATE_OPTIONS} value={String(rate)}
        onChange={(value) => { const step = chosenRate(value); if (step !== null) setReadAloudRate(step); }} />
    </Dialog>
  );
}
