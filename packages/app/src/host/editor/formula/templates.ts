/**
 * Formula shapes for the host's formula dialog (WEB-V21-STEM-FORMULA-DIJALOG).
 * A template keeps its blanks as "□"; `nextHole` finds the next one so Tab can
 * walk through them, and `hasHoles` stops confirming while any is left. The
 * `example` of each shape is an invented, filled-in formula.
 */

export const HOLE = "□";

export type FormulaTemplate = { readonly id: string; readonly tex: string; readonly example: string };

export const FORMULA_TEMPLATES: readonly FormulaTemplate[] = [
  { id: "fraction", tex: "\\frac{□}{□}", example: "\\frac{a+b}{2}" },
  { id: "root", tex: "\\sqrt{□}", example: "\\sqrt{x^{2}+y^{2}}" },
  { id: "sum", tex: "\\sum_{i=1}^{□} □", example: "\\sum_{i=1}^{n} x_i" },
  { id: "integral", tex: "\\int_{□}^{□} □\\,dx", example: "\\int_{0}^{1} x^{2}\\,dx" },
  { id: "matrix", tex: "\\begin{pmatrix} □ & □ \\\\ □ & □ \\end{pmatrix}", example: "\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}" },
];

export const hasHoles = (tex: string): boolean => tex.includes(HOLE);

/** The index of the first blank at or after `from`, wrapping round; -1 when none. */
export function nextHole(tex: string, from: number): number {
  const at = tex.indexOf(HOLE, Math.max(0, from));
  return at !== -1 ? at : tex.indexOf(HOLE);
}

/**
 * `template` put into `tex` over the selection `[start, end)`: a selection that
 * is not empty fills the first blank. Returns the new text and where the
 * cursor goes (the first blank of the inserted shape, else its end).
 */
export function applyTemplate(tex: string, start: number, end: number, template: string): { tex: string; caret: number; caretEnd: number } {
  const from = Math.max(0, Math.min(start, tex.length));
  const to = Math.max(from, Math.min(end, tex.length));
  const selected = tex.slice(from, to);
  const filled = selected !== "" && template.includes(HOLE) ? template.replace(HOLE, selected) : template;
  const next = tex.slice(0, from) + filled + tex.slice(to);
  const hole = next.indexOf(HOLE, from);
  return hole !== -1 && hole < from + filled.length
    ? { tex: next, caret: hole, caretEnd: hole + HOLE.length }
    : { tex: next, caret: from + filled.length, caretEnd: from + filled.length };
}
