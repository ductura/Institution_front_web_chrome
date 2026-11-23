// VIZ alat: the gate of the comparison. A screen and width whose share of
// differing pixels is above the threshold is a failure. The threshold is off
// until the numbers settle (VIZ_PRAG unset: report only); when set it is a
// percentage, and the target is 2 (VIZ-PRAG, Daniel 22. 11. 2026.).
// No browser and no dependency, so node --test reads this file directly.

/** The target threshold: at most this share (%) of pixels may differ per screen and width. */
export const CILJ_PRAG = 2;

export type Mjerenje = { readonly ekran: string; readonly sirina: number; readonly posto: number };

/** The threshold from VIZ_PRAG: null (no gate) when unset or empty, an error for anything but a number from 0 to 100. */
export function procitajPrag(vrijednost: string | undefined): number | null {
  if (vrijednost === undefined || vrijednost.trim() === "") return null;
  const n = Number(vrijednost.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error(`VIZ_PRAG mora biti broj od 0 do 100, dobiveno: ${vrijednost}`);
  return n;
}

/** The measurements above the threshold, the worst first. A measurement equal to the threshold passes. */
export function prekoracenja(mjerenja: readonly Mjerenje[], prag: number): Mjerenje[] {
  return mjerenja.filter((m) => m.posto > prag).sort((a, b) => b.posto - a.posto);
}
