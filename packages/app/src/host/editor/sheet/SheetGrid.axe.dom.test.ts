// @vitest-environment jsdom
// WEB-V14-SHEET-GRID: axe (WCAG A and AA rules) over the rendered grid, as the executable proof of accessibility until
// WEB-V14-SHEET-PAGE mounts the grid and brings the browser spec (e2e/sheet-grid.spec.ts.pending) with it. jsdom has no
// layout, so the colour-contrast and scroll rules cannot run here; the structure, names, roles and states are checked.
import axe from "axe-core";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { createSheetDocument, type SheetDocument } from "../../../../../editor-core/src/sheet/index.ts";
import { SheetGrid } from "./SheetGrid";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
let root: Root | undefined;
afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

const filled = (): SheetDocument => {
  const d = createSheetDocument({ id: "s1", name: "Proračun" });
  return {
    ...d,
    sheets: [{ ...d.sheets[0]!, rows: 4, columns: 3, cells: {
      A1: { value: 10 }, A2: { value: 0 }, B1: { value: null, formula: "=A1/A2" }, B2: { value: "Ukupno" }, C1: { value: null, formula: "=C1+1" },
    } }],
  };
};

async function violations(props: Parameters<typeof SheetGrid>[0]) {
  const host = document.createElement("div");
  host.setAttribute("lang", "hr");
  const main = document.createElement("main");
  host.append(main);
  document.body.append(host);
  root = createRoot(main);
  await act(async () => { root?.render(h(SheetGrid, props)); });
  const result = await axe.run(host, { runOnly: { type: "tag", values: TAGS }, rules: { "color-contrast": { enabled: false } } });
  return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 3) }));
}

describe("SheetGrid axe", () => {
  const noop = () => {};
  it("has no violation with values, formulas and error values", async () => {
    expect(await violations({ state: "ready", document: filled(), onChange: noop })).toEqual([]);
  });
  it("has no violation for the empty sheet and the read-only sheet", async () => {
    expect(await violations({ state: "ready", document: createSheetDocument(), onChange: noop })).toEqual([]);
    act(() => root?.unmount());
    expect(await violations({ state: "ready", document: filled(), onChange: noop, readOnly: true })).toEqual([]);
  });
  it("has no violation in the loading and failure states", async () => {
    expect(await violations({ state: "loading", document: null, onChange: noop })).toEqual([]);
    act(() => root?.unmount());
    expect(await violations({ state: "error", document: null, onChange: noop, onRetry: noop })).toEqual([]);
  });
});
