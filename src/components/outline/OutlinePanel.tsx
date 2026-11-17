import { createElement as h, useId, useState } from "react";

import { messagesHr as t } from "../../../locales/hr.ts";
import { OUTLINE_HR } from "../i18n/hr.ts";

import { outlineTree, type OutlineNode, type OutlineRow } from "./outline-tree";
import { activeRow, branchIndexes, collapsedSet, filterTree, limitLevels, openBranchShown, searchQuery } from "./outline-view";
import {
  PANEL_DEFAULTS, readStoredSettings, settingsFor, settingsKey, uniqueIds, writeSettings, type SettingsStore,
} from "./panel-settings";
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
  /** "Samo naslovi" at first render (DAN-978, 978-3); later changes are not read. */
  headingsOnly?: boolean;
  /** Told the new state once per press; the editor's headings-only view listens (E-0.3). */
  onHeadingsOnlyChange?: (on: boolean) => void;
  /**
   * Browser store for the panel settings (979-2), given only in the browser, never in SSR.
   * With a usable `scope` and a stored record, the record wins over `collapsed` and `headingsOnly`.
   */
  store?: SettingsStore;
  /** Whose settings: the editor gives a digest of the document id. */
  scope?: string;
  /** Headings shown, up to level 1, 2 or 3 (979-3), at first render; anything else is 3. A stored record wins. */
  levels?: number;
};

type Levels = 1 | 2 | 3;
const asLevels = (n: number): Levels => (Number.isInteger(n) && n >= 1 && n <= 3 ? (n as Levels) : 3);

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
export default function OutlinePanel(
  {
    rows, active, collapsed = [], query = "", headingsOnly = false, onHeadingsOnlyChange, store, scope = "", levels = 3,
  }: OutlinePanelProps,
) {
  const base = useId();
  const tree = outlineTree(rows);
  // Read once (979-2): a stored record wins over the props; ids map back to rows only when unique.
  const [saved] = useState(() => {
    const key = store ? settingsKey(scope) : null;
    const record = key ? readStoredSettings(store, key) : null;
    const unique = uniqueIds(rows);
    return {
      key,
      base: record ?? PANEL_DEFAULTS,
      shut: record ? record.collapsed.flatMap((id) => unique.get(id) ?? []) : collapsed,
      only: record ? record.headingsOnly : headingsOnly,
      levels: record ? record.levels : asLevels(levels),
    };
  });
  const [shut, setShut] = useState<readonly number[]>(saved.shut);
  const [typed, setTyped] = useState(query);
  const [only, setOnly] = useState(saved.only);
  const [lv, setLv] = useState<Levels>(saved.levels);
  // Called in the click handler, never inside a state updater, which StrictMode runs twice.
  const pressOnly = () => {
    const next = !only;
    setOnly(next);
    save(shut, next);
    onHeadingsOnlyChange?.(next);
  };
  const q = searchQuery(typed);
  const searching = q !== "";
  // While searching every branch is open and has no toggle, and every level shows; the collapsed set and the
  // levels choice come back when the query is cleared. `shut` stays indexes over the whole tree (979-3).
  const limited = limitLevels(tree, lv);
  const shown = searching ? filterTree(tree, q) : limited;
  const closed = searching ? new Set<number>() : collapsedSet(tree, shut);
  // Writes in the handlers, from the current state, never inside a state updater; a failed write changes nothing on screen.
  // Always the whole tree, so a collapsed branch the levels choice hides is not dropped from the record.
  function save(nextShut: readonly number[], nextOnly: boolean, nextLevels: Levels = lv) {
    if (saved.key) writeSettings(store, saved.key, settingsFor(tree, rows, nextShut, nextOnly, { ...saved.base, levels: nextLevels }));
  }
  const chooseLevels = (value: string) => {
    const next = asLevels(Number(value));
    setLv(next);
    save(shut, only, next);
  };
  const setAndSave = (next: readonly number[]) => {
    setShut(next);
    save(next, only);
  };
  const toggle = (index: number) => setAndSave(shut.includes(index) ? shut.filter((i) => i !== index) : [...shut, index]);
  // Shown and labelled from what is on screen; acting on every branch of the whole tree.
  const branches = branchIndexes(limited);
  const anyOpen = openBranchShown(limited, closed);
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
            { type: "button", className: styles.all, onClick: () => setAndSave(anyOpen ? branchIndexes(tree) : []) },
            anyOpen ? OUTLINE_HR.collapseAll : OUTLINE_HR.expandAll,
          )
          : null,
        // 979-3: a native select; it stays usable while searching and applies when the query is cleared.
        h("label", { htmlFor: `${base}-l` }, OUTLINE_HR.levels),
        h(
          "select",
          { id: `${base}-l`, value: String(lv), onChange: (e: React.ChangeEvent<HTMLSelectElement>) => chooseLevels(e.target.value) },
          ([1, 2, 3] as const).map((n) => h("option", { key: n, value: String(n) }, OUTLINE_HR.levelOptions[n])),
        ),
        // 978-3: a toggle with a constant label; the state is aria-pressed only.
        h("button", { type: "button", className: styles.only, "aria-pressed": only, onClick: pressOnly }, OUTLINE_HR.headingsOnly),
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
