/**
 * Rhythm-of-entry preference ("Bilježi ritam tipkanja"). Until SRV-0910 exists
 * this is a local fake adapter: one boolean in localStorage, default on.
 * Only gaps between entries are recorded, never which keys are pressed.
 */
export const rhythmKey = "ductura:record-rhythm";

export function readRhythm(read: () => string | null): boolean {
  try { return read() !== "off"; } catch { return true; }
}

export function writeRhythm(value: boolean, write: (v: string) => void): void {
  try { write(value ? "on" : "off"); } catch { /* The choice works for this page. */ }
}
