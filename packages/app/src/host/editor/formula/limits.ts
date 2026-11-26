/**
 * Formula size limits of the v4 document schema (server `schema.ts`:
 * MAX_FORMULA_TEX_CODE_POINTS = 4000, MAX_INLINE_FORMULA_TEX_CODE_POINTS = 1000).
 * Counted in Unicode code points, not UTF-16 units, as the server counts them.
 */

export const MAX_FORMULA_TEX_CODE_POINTS = 4000;
export const MAX_INLINE_FORMULA_TEX_CODE_POINTS = 1000;

export type FormulaKind = "block" | "inline";

export function codePointLength(tex: string): number {
  let n = 0;
  for (const _ of tex) n += 1;
  return n;
}

export function maxCodePoints(kind: FormulaKind): number {
  return kind === "inline" ? MAX_INLINE_FORMULA_TEX_CODE_POINTS : MAX_FORMULA_TEX_CODE_POINTS;
}

export type FormulaLimitCheck = { ok: boolean; length: number; max: number; reason: "empty" | "too-long" | null };

/** Empty (blank) input and input over the limit are not allowed to be confirmed. */
export function checkFormulaLimit(tex: string, kind: FormulaKind): FormulaLimitCheck {
  const length = codePointLength(tex);
  const max = maxCodePoints(kind);
  if (tex.trim() === "") return { ok: false, length, max, reason: "empty" };
  if (length > max) return { ok: false, length, max, reason: "too-long" };
  return { ok: true, length, max, reason: null };
}
