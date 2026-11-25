/**
 * Local formula rendering for the host (KaTeX 0.16.22, same version as the old
 * package, bundled: no CDN, no network). Output is KaTeX HTML plus MathML for
 * screen readers. `trust` stays off, so `\href`, `\url` and `\includegraphics`
 * are refused; `throwOnError` is off for the fallback so a half-typed formula
 * shows its source instead of throwing. Inputs over the v4 schema limits are
 * refused before KaTeX sees them.
 *
 * The stylesheet and fonts come from `katex/dist/katex.min.css` (relative
 * font URLs only); import it where the formula is mounted.
 */

import katex from "katex";
import { checkFormulaLimit, type FormulaKind } from "./limits.ts";

export type RenderedTex = { html: string; ok: boolean };

export function renderTex(tex: string, display: boolean): RenderedTex {
  const source = tex.trim();
  if (source === "") return { html: "", ok: false };
  const kind: FormulaKind = display ? "block" : "inline";
  if (!checkFormulaLimit(source, kind).ok) return { html: "", ok: false };
  // trust stays off; the callback only records that an untrusted command
  // (\href, \url, \includegraphics, ...) was attempted, because KaTeX
  // renders it as plain error-coloured text instead of throwing.
  let refused = false;
  const options = {
    displayMode: display, trust: () => { refused = true; return false; },
    strict: "ignore", output: "htmlAndMathml", maxSize: 20, maxExpand: 500,
  } as const;
  try {
    const html = katex.renderToString(source, { ...options, throwOnError: true });
    return { html, ok: !refused };
  } catch {
    try {
      return { html: katex.renderToString(source, { ...options, throwOnError: false }), ok: false };
    } catch {
      return { html: "", ok: false };
    }
  }
}
