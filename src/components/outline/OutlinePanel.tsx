import { createElement as h, useId, useState } from "react";

import { messagesHr as t } from "../../../locales/hr.ts";
import { OUTLINE_HR } from "../i18n/hr.ts";

import { outlineTree, type OutlineNode, type OutlineRow } from "./outline-tree";
import { activeRow, branchIndexes, collapsedSet, filterTree, openBranchShown, searchQuery } from "./outline-view";
import styles from "./OutlinePanel.module.css";

export type OutlinePanelProps = {
  /** Headings in document order, with the numbers editor-core gave them. */
  rows: readonly OutlineRow[];
  /** Index into `rows` of the heading whose section holds the cursor (Ductus `currentHeading`); -1 for none. */
  active: number;
  /** Row indexes collapsed at first render; later changes are not read (keys for storage: DAN-979). */
  collapsed?: readonly number[];
  /** Title search at first render (DAN-978); later changes are not read. */
  query?: string;
};

type View = {
  base: string; closed: ReadonlySet<number>; marked: number; searching: boolean; toggle: (index: number) => void;
};

function list(nodes: readonly OutlineNode[], depth: number, view: View, id?: string, hidden?: boolean): React.ReactNode {
  return h(
    "ol",
    { role: "list", className: styles.list, "data-depth": depth, id, hidden },
    nodes.map((node) => {
      const title = node.row.entry.text.trim() || t.outline.untitledHeading;
      const open = !view.closed.has(node.index);
      const childList = `${view.base}-${node.index}`;
      return h(
        "li",
        {
          // Keyed by row index: unique, and stable when a search cuts the tree (978-1).
          key: node.index,
          "aria-current": view.marked === node.index ? "location" : undefined,
          className: styles.item,
          "data-node-id": node.row.entry.id ?? undefined,
        },
        h(
          "span",
          { className: styles.row, "data-level": node.row.entry.level },
          node.children.length > 0 && !view.searching
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
export default function OutlinePanel({ rows, active, collapsed = [], query = "" }: OutlinePanelProps) {
  const base = useId();
  const tree = outlineTree(rows);
  const [shut, setShut] = useState<readonly number[]>(collapsed);
  const [typed, setTyped] = useState(query);
  const q = searchQuery(typed);
  const searching = q !== "";
  const shown = filterTree(tree, q);
  // While searching every branch is open and has no toggle; the collapsed set comes back when the query is cleared.
  const closed = searching ? new Set<number>() : collapsedSet(tree, shut);
  const toggle = (index: number) =>
    setShut((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  const branches = branchIndexes(tree);
  const anyOpen = openBranchShown(tree, closed);
  const view: View = { base, closed, marked: activeRow(shown, rows, active, closed, tree), searching, toggle };
  return h(
    "div",
    { className: styles.panel },
    tree.length > 0
      ? h(
        "p",
        { className: styles.search },
        h("label", { htmlFor: `${base}-q` }, OUTLINE_HR.search),
        h("input", { id: `${base}-q`, type: "search", value: typed, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTyped(e.target.value) }),
        // 978-2: one plain button whose text is its name; hidden while searching, when every branch is open anyway.
        branches.length > 0 && !searching
          ? h(
            "button",
            { type: "button", className: styles.all, onClick: () => setShut(anyOpen ? branches : []) },
            anyOpen ? OUTLINE_HR.collapseAll : OUTLINE_HR.expandAll,
          )
          : null,
      )
      : null,
    // Always in the DOM, so a screen reader hears it when the text appears.
    h("p", { role: "status", className: styles.empty }, searching && shown.length === 0 ? OUTLINE_HR.noMatch : null),
    h(
      "nav",
      { "aria-label": t.outline.label },
      tree.length === 0 ? h("p", { className: styles.empty }, t.workspace.structureEmpty) : shown.length > 0 ? list(shown, 1, view) : null,
    ),
  );
}
