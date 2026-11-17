import { createElement as h } from "react";

import { messagesHr as t } from "../../../locales/hr.ts";

import { outlineTree, type OutlineNode, type OutlineRow } from "./outline-tree";
import styles from "./OutlinePanel.module.css";

export type OutlinePanelProps = {
  /** Headings in document order, with the numbers editor-core gave them. */
  rows: readonly OutlineRow[];
};

function list(nodes: readonly OutlineNode[], depth: number): React.ReactNode {
  return h(
    "ol",
    { role: "list", className: styles.list, "data-depth": depth },
    // Keyed by position: ids may repeat or be null (977-1).
    nodes.map((node, i) =>
      h(
        "li",
        { key: i, className: styles.item, "data-node-id": node.row.entry.id ?? undefined },
        h(
          "span",
          { className: styles.row, "data-level": node.row.entry.level },
          node.number ? h("span", { className: styles.number, "data-number": "" }, node.number) : null,
          h("span", { className: styles.title }, node.row.entry.text.trim() || t.outline.untitledHeading),
        ),
        node.children.length > 0 ? list(node.children, depth + 1) : null,
      ),
    ),
  );
}

/**
 * DAN-977 (977-2): the left panel's Popis layout, three heading levels with
 * the numbers from the input. Collapsing and the active chapter come in 977-3.
 */
export default function OutlinePanel({ rows }: OutlinePanelProps) {
  const tree = outlineTree(rows);
  return h(
    "nav",
    { "aria-label": t.outline.label, className: styles.panel },
    tree.length > 0 ? list(tree, 1) : h("p", { className: styles.empty }, t.workspace.structureEmpty),
  );
}
