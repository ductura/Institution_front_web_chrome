// WEB-V21-STEM-FORMULA-UREDNIK: what the editor shows and allows for formulas. Pure TypeScript over the
// ProseMirror schema: availability of "Formula…" (schema v4 and a field with the `formula` tool), and the
// ProseMirror plugin that draws `formula` and `inlineFormula` with the KaTeX core. A double click on a
// drawn formula asks the host to open the dialog; the plugin never changes the document.
import type { Node as PmNode, Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { NodeView } from "@tiptap/pm/view";

import type { ToolKey } from "../rules/profiles.ts";
import type { FormulaKind } from "./limits.ts";
import { formulaHostHr as t } from "./messages.hr.ts";
import { renderTex } from "./render.ts";

export type FormulaAvailability = { enabled: true } | { enabled: false; reason: string };

export const FORMULA_NODE: Record<FormulaKind, string> = { block: "formula", inline: "inlineFormula" };

/** Schema v4: both formula nodes are atoms, the block one at block level and the other inline. */
export function supportsFormulas(schema: Schema, schemaVersion: number | undefined): boolean {
  const block = schema.nodes[FORMULA_NODE.block];
  const inline = schema.nodes[FORMULA_NODE.inline];
  return schemaVersion === 4 && !!block?.isAtom && !block.isInline && !!inline?.isAtom && !!inline.isInline;
}

/** On only for a v4 work whose field offers the tool, and only while the work can be edited. */
export function formulaAvailability(
  schema: Schema, schemaVersion: number | undefined, tools: readonly ToolKey[], editable: boolean,
): FormulaAvailability {
  if (!supportsFormulas(schema, schemaVersion)) return { enabled: false, reason: t.disabledSchema };
  if (!tools.includes("formula")) return { enabled: false, reason: t.disabledTool };
  if (!editable) return { enabled: false, reason: t.disabledReadOnly };
  return { enabled: true };
}

/** ED-128: "Kemijska formula", an inline formula in \ce{...}; on for a v4 work whose field offers the `chem` tool. */
export function chemAvailability(
  schema: Schema, schemaVersion: number | undefined, tools: readonly ToolKey[], editable: boolean,
): FormulaAvailability {
  if (!supportsFormulas(schema, schemaVersion)) return { enabled: false, reason: t.disabledSchema };
  if (!tools.includes("chem")) return { enabled: false, reason: t.disabledChem };
  if (!editable) return { enabled: false, reason: t.disabledReadOnly };
  return { enabled: true };
}

/** The example the chemistry dialog opens with, as in the prototype (acChem). */
export const CHEM_EXAMPLE = "\\ce{H2SO4}";

export type FormulaTarget = { readonly pos: number; readonly kind: FormulaKind; readonly tex: string };

/** The formula node at `pos`, or null when none stands there. */
export function formulaAt(doc: PmNode, pos: number): FormulaTarget | null {
  const node = pos >= 0 && pos <= doc.content.size ? doc.nodeAt(pos) : null;
  if (!node) return null;
  const kind = (Object.keys(FORMULA_NODE) as FormulaKind[]).find((k) => FORMULA_NODE[k] === node.type.name);
  return kind ? { pos, kind, tex: String(node.attrs.tex ?? "") } : null;
}

export const formulaViewKey = new PluginKey("ductura-formula-view");

function drawFormula(node: PmNode, kind: FormulaKind): NodeView {
  const dom = document.createElement(kind === "block" ? "div" : "span");
  dom.setAttribute(kind === "block" ? "data-formula" : "data-inline-formula", "");
  dom.setAttribute("data-tex", String(node.attrs.tex));
  dom.setAttribute("title", t.editHint);
  const paint = (tex: string) => {
    const shown = renderTex(tex, kind === "block");
    if (shown.html) dom.innerHTML = shown.html; // KaTeX output only; trust is off in renderTex
    else dom.textContent = tex; // refused or empty: show the source, never a blank
    dom.setAttribute("data-tex", tex);
  };
  paint(String(node.attrs.tex));
  return {
    dom,
    update: (next) => {
      if (next.type !== node.type) return false;
      node = next;
      paint(String(next.attrs.tex));
      return true;
    },
    ignoreMutation: () => true,
  };
}

/** Draws the formula atoms with KaTeX; `onOpen` runs on a double click of one (never in a read-only editor). */
export function formulaViewPlugin(onOpen: (target: FormulaTarget) => void, canEdit: () => boolean): Plugin {
  return new Plugin({
    key: formulaViewKey,
    props: {
      nodeViews: {
        [FORMULA_NODE.block]: (node) => drawFormula(node, "block"),
        [FORMULA_NODE.inline]: (node) => drawFormula(node, "inline"),
      },
      handleDoubleClickOn: (view, _pos, node, nodePos) => {
        if (!canEdit() || !view.editable) return false;
        const target = formulaAt(view.state.doc, nodePos);
        if (!target || target.tex !== String(node.attrs.tex)) return false;
        onOpen(target);
        return true;
      },
    },
  });
}
