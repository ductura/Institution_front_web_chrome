/**
 * KaTeX for formulas (E§3.4), bundled locally: no CDN, no network. The output
 * is KaTeX's own HTML with MathML for screen readers; `trust` stays off, so
 * `\href`, `\url` and `\includegraphics` are refused, and `throwOnError` is
 * off so a half-typed formula shows its source in red instead of failing.
 */

import katex from "katex";

export type RenderedTex = { html: string; ok: boolean };

export function renderTex(tex: string, display: boolean): RenderedTex {
  const source = tex.trim();
  if (source === "") return { html: "", ok: false };
  const options = {
    displayMode: display, trust: false, strict: "ignore", output: "htmlAndMathml", maxSize: 20, maxExpand: 500,
  } as const;
  try {
    return { html: katex.renderToString(source, { ...options, throwOnError: true }), ok: true };
  } catch {
    return { html: katex.renderToString(source, { ...options, throwOnError: false }), ok: false };
  }
}
