import { createElement as h, useId, useState } from "react";

import { messagesHr as t } from "../../../locales/hr.ts";
import { OUTLINE_HR } from "../i18n/hr.ts";

import { outlineTree, type OutlineNode, type OutlineRow } from "./outline-tree";
import { activeRow, collapsedSet } from "./outline-view";
import styles from "./OutlinePanel.module.css";

export type OutlinePanelProps = {
  /** Headings in document order, with the numbers editor-core gave them. */
  rows: readonly OutlineRow[];
  /** Index into `rows` of the heading whose section holds the cursor (Ductus `currentHeading`); -1 for none. */
  active: number;
  /** Row indexes collapsed at first render; later changes are not read (keys for storage: DAN-979). */
  collapsed?: readonly number[];
};

type View = { base: string; closed: ReadonlySet<number>; marked: number; toggle: (index: number) => void };

function list(nodes: readonly OutlineNode[], depth: number, view: View, id?: string, hidden?: boolean): React.ReactNode {
  return h(
    "ol",
    { role: "list", className: styles.list, "data-depth": depth, id, hidden },
    // Keyed by position: ids may repeat or be null (977-1).
    nodes.map((node, i) => {
      const title = node.row.entry.text.trim() || t.outline.untitledHeading;
      const open = !view.closed.has(node.index);
      const childList = `${view.base}-${node.index}`;
      return h(
        "li",
        {
          key: i,
          "aria-current": view.marked === node.index ? "location" : undefined,
          className: styles.item,
          "data-node-id": node.row.entry.id ?? undefined,
        },
        h(
          "span",
          { className: styles.row, "data-level": node.row.entry.level },
          node.children.length > 0
            ? h("button", {
              type: "button",
              className: styles.toggle,
              "aria-label": `${OUTLINE_HR.subheadings}: ${node.number ? `${node.number} ` : ""}${title}`,
              "aria-expanded": open,
              "aria-controls": childList,
              onClick: () => view.toggle(node.index),
            })
            : null,
          node.number ? h("span", { className: styles.number, "data-number": "" }, node.number) : null,
          h("span", { className: styles.title }, title),
        ),
        node.children.length > 0 ? list(node.children, depth + 1, view, childList, !open) : null,
      );
    }),
  );
}

/**
 * DAN-977: the left panel's Popis layout, three heading levels with the
 * numbers from the input (977-2), collapsible branches and the active chapter
 * (977-3). A collapsed branch keeps its list in the DOM, hidden.
 */
export default function OutlinePanel({ rows, active, collapsed = [] }: OutlinePanelProps) {
  const base = useId();
  const tree = outlineTree(rows);
  const [shut, setShut] = useState<readonly number[]>(collapsed);
  const closed = collapsedSet(tree, shut);
  const toggle = (index: number) =>
    setShut((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  const view: View = { base, closed, marked: activeRow(tree, rows, active, closed), toggle };
  return h(
    "nav",
    { "aria-label": t.outline.label, className: styles.panel },
    tree.length > 0 ? list(tree, 1, view) : h("p", { className: styles.empty }, t.workspace.structureEmpty),
  );
}
