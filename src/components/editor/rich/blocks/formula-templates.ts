/**
 * The shapes of the formula dialog (stem.js, "Dijalog formule"). A template
 * keeps its blanks as "□"; `nextHole` finds the next one so Tab can walk
 * through them, and `hasHoles` stops saving while any is left.
 */

import { richBlocksMessages as m } from "./messages.hr";

export const HOLE = "□";

export type FormulaTemplate = { label: string; tex: string; short?: boolean };
export type FormulaGroup = { key: keyof typeof m.groups; items: readonly FormulaTemplate[] };

export const FORMULA_GROUPS: readonly FormulaGroup[] = [
  { key: "basic", items: [
    { label: "razlomak", tex: "\\frac{□}{□}" },
    { label: "potencija", tex: "□^{□}" },
    { label: "indeks", tex: "□_{□}" },
    { label: "korijen", tex: "\\sqrt{□}" },
    { label: "n-ti korijen", tex: "\\sqrt[□]{□}" },
    { label: "zagrade", tex: "\\left(□\\right)" },
    { label: "apsolutna vrijednost", tex: "\\left|□\\right|" },
  ] },
  { key: "sums", items: [
    { label: "zbroj", tex: "\\sum_{i=1}^{□} □" },
    { label: "umnožak", tex: "\\prod_{i=1}^{□} □" },
    { label: "integral", tex: "\\int_{□}^{□} □\\,dx" },
    { label: "limes", tex: "\\lim_{x \\to □} □" },
    { label: "derivacija", tex: "\\frac{d□}{dx}" },
    { label: "parcijalna derivacija", tex: "\\frac{\\partial □}{\\partial x}" },
  ] },
  { key: "structures", items: [
    { label: "matrica 2×2", tex: "\\begin{pmatrix} □ & □ \\\\ □ & □ \\end{pmatrix}" },
    { label: "sustav", tex: "\\begin{cases} □ \\\\ □ \\end{cases}" },
    { label: "vektor", tex: "\\vec{□}" },
    { label: "prosjek", tex: "\\bar{□}" },
    { label: "procjena", tex: "\\hat{□}" },
    { label: "binomni koeficijent", tex: "\\binom{□}{□}" },
  ] },
  { key: "signs", items: ["≤:\\le", "≥:\\ge", "≠:\\ne", "≈:\\approx", "±:\\pm", "·:\\cdot", "×:\\times", "∞:\\infty", "→:\\to", "∈:\\in", "∀:\\forall", "∃:\\exists"]
    .map((pair) => { const [label, tex] = pair.split(":") as [string, string]; return { label, tex, short: true }; }) },
  { key: "greek", items: ["α:\\alpha", "β:\\beta", "γ:\\gamma", "δ:\\delta", "ε:\\varepsilon", "θ:\\theta", "λ:\\lambda", "μ:\\mu", "π:\\pi", "ρ:\\rho", "σ:\\sigma", "φ:\\varphi", "ω:\\omega", "Δ:\\Delta", "Σ:\\Sigma", "Ω:\\Omega"]
    .map((pair) => { const [label, tex] = pair.split(":") as [string, string]; return { label, tex, short: true }; }) },
];

export const hasHoles = (tex: string): boolean => tex.includes(HOLE);

/** The index of the first blank at or after `from`, wrapping round; -1 when none. */
export function nextHole(tex: string, from: number): number {
  const at = tex.indexOf(HOLE, Math.max(0, from));
  return at !== -1 ? at : tex.indexOf(HOLE);
}

/**
 * `template` put into `tex` over the selection `[start, end)`: blanks left
 * in the template stay; a selection that is not empty fills the first blank.
 * Returns the new text and where the cursor goes (the first blank, else the end).
 */
export function applyTemplate(tex: string, start: number, end: number, template: string): { tex: string; caret: number; caretEnd: number } {
  const selected = tex.slice(start, end);
  const filled = selected !== "" && template.includes(HOLE) ? template.replace(HOLE, selected) : template;
  const next = tex.slice(0, start) + filled + tex.slice(end);
  const hole = next.indexOf(HOLE, start);
  return hole !== -1 && hole < start + filled.length
    ? { tex: next, caret: hole, caretEnd: hole + HOLE.length }
    : { tex: next, caret: start + filled.length, caretEnd: start + filled.length };
}
