// @vitest-environment jsdom
// WEB-V14-SHEET-GRID: the grid as a user drives it by keyboard. The page that stores the document is a stateful fake;
// every sheet, cell and text is invented.
import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { createSheetDocument, type SheetDocument } from "../../../../../editor-core/src/sheet/index.ts";
import { SheetGrid, type SheetGridState } from "./SheetGrid";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const start = (): SheetDocument => {
  const d = createSheetDocument({ id: "s1", name: "Proračun" });
  return { ...d, sheets: [{ ...d.sheets[0]!, rows: 4, columns: 3 }] };
};

let root: Root | undefined;
let latest: SheetDocument | null = null;
afterEach(() => { act(() => root?.unmount()); root = undefined; latest = null; document.body.innerHTML = ""; });

function Page(props: { initial: SheetDocument | null; state?: SheetGridState; readOnly?: boolean; retries?: { n: number } }) {
  const [doc, setDoc] = useState(props.initial);
  latest = doc;
  return h(SheetGrid, {
    state: props.state ?? "ready", document: doc, readOnly: props.readOnly,
    onChange: (next: SheetDocument) => { latest = next; setDoc(next); },
    onRetry: () => { if (props.retries) props.retries.n += 1; },
  });
}

const mount = async (props: Parameters<typeof Page>[0]) => {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root?.render(h(Page, props)); });
  return host;
};
const cell = (ref: string) => document.querySelector<HTMLElement>(`[data-cell="${ref}"]`)!;
const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  act(() => { el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init })); });
const type = (input: HTMLInputElement, text: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const focus = (ref: string) => act(() => { cell(ref).focus(); });
const editor = () => document.querySelector<HTMLInputElement>("td input")!;
const bar = () => document.querySelector<HTMLInputElement>('input[aria-label="Traka formule"]')!;
/** Types a text into the active cell the way a person does: starts with the first key, finishes with Enter. */
async function enter(ref: string, text: string, finish = "Enter") {
  await focus(ref);
  await key(cell(ref), "F2");
  await type(editor(), text);
  await key(editor(), finish);
}

describe("SheetGrid states", () => {
  it("shows loading, failure and empty as three different things", async () => {
    let host = await mount({ initial: null, state: "loading" });
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Učitavam tablicu…");
    expect(host.querySelector('[role="grid"]')).toBeNull();
    act(() => root?.unmount());
    const retries = { n: 0 };
    host = await mount({ initial: null, state: "error", retries });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Tablica nije dostupna");
    expect(host.querySelector('[role="grid"]')).toBeNull();
    await act(async () => { host.querySelector("button")!.click(); });
    expect(retries.n).toBe(1);
    act(() => root?.unmount());
    host = await mount({ initial: start() });
    expect(host.textContent).toContain("Tablica je prazna");
    expect(host.querySelector('[role="grid"]')).not.toBeNull();
    expect(host.querySelector('[data-sheet-state="error"]')).toBeNull();
  });

  it("treats a missing document on a ready state as a failure, never as an empty sheet", async () => {
    const host = await mount({ initial: null, state: "ready" });
    expect(host.querySelector('[data-sheet-state="error"]')).not.toBeNull();
  });
});

describe("SheetGrid structure", () => {
  it("is a grid with column and row headers and one tab stop", async () => {
    const host = await mount({ initial: start() });
    const grid = host.querySelector('[role="grid"]')!;
    expect(grid.getAttribute("aria-rowcount")).toBe("5");
    expect(grid.getAttribute("aria-colcount")).toBe("4");
    expect(host.querySelectorAll('th[scope="col"]')).toHaveLength(3);
    expect(host.querySelectorAll('th[scope="row"]')).toHaveLength(4);
    const stops = [...host.querySelectorAll('[role="gridcell"]')].filter((c) => c.getAttribute("tabindex") === "0");
    expect(stops.map((c) => c.getAttribute("data-cell"))).toEqual(["A1"]);
  });
});

describe("SheetGrid keyboard", () => {
  it("moves with the arrows, with focus following", async () => {
    await mount({ initial: start() });
    await focus("A1");
    await key(cell("A1"), "ArrowDown");
    await key(cell("A2"), "ArrowRight");
    expect(document.activeElement).toBe(cell("B2"));
    expect(cell("B2").getAttribute("tabindex")).toBe("0");
    expect(cell("A1").getAttribute("tabindex")).toBe("-1");
  });

  it("edits with F2 and commits with Enter, moving down; a formula shows its result", async () => {
    await mount({ initial: start() });
    await enter("A1", "10");
    await enter("A2", "5");
    await enter("A3", "=SUM(A1:A2)");
    expect(cell("A3").textContent).toBe("15");
    expect(latest!.sheets[0]!.cells.A3).toEqual({ value: null, formula: "=SUM(A1:A2)" });
    expect(document.activeElement).toBe(cell("A4"));
  });

  it("starts typing on a printable key and commits with Tab to the right", async () => {
    await mount({ initial: start() });
    await focus("A1");
    await key(cell("A1"), "x");
    expect(editor().value).toBe("x");
    await type(editor(), "Zbroj");
    await key(editor(), "Tab");
    expect(latest!.sheets[0]!.cells.A1).toEqual({ value: "Zbroj" });
    expect(document.activeElement).toBe(cell("B1"));
  });

  it("cancels an edit with Escape and leaves the cell as it was", async () => {
    await mount({ initial: start() });
    await enter("A1", "7");
    await focus("A1");
    await key(cell("A1"), "F2");
    await type(editor(), "999");
    await key(editor(), "Escape");
    expect(cell("A1").textContent).toBe("7");
    expect(latest!.sheets[0]!.cells.A1).toEqual({ value: 7 });
    expect(document.activeElement).toBe(cell("A1"));
  });

  it("undoes and redoes with Ctrl+Z / Ctrl+Y and clears a range with Delete", async () => {
    await mount({ initial: start() });
    await enter("A1", "1");
    await enter("A2", "2");
    await focus("A1");
    await key(cell("A1"), "ArrowDown", { shiftKey: true });
    await key(cell("A1"), "Delete");
    expect(latest!.sheets[0]!.cells).toEqual({});
    await key(cell("A1"), "z", { ctrlKey: true });
    expect(Object.keys(latest!.sheets[0]!.cells)).toEqual(["A1", "A2"]);
    await key(cell("A1"), "z", { ctrlKey: true });
    expect(Object.keys(latest!.sheets[0]!.cells)).toEqual(["A1"]);
    await key(cell("A1"), "y", { ctrlKey: true });
    expect(Object.keys(latest!.sheets[0]!.cells)).toEqual(["A1", "A2"]);
  });

  it("marks a range selected for assistive technology", async () => {
    await mount({ initial: start() });
    await focus("A1");
    await key(cell("A1"), "ArrowRight", { shiftKey: true });
    await key(cell("A1"), "ArrowDown", { shiftKey: true });
    const selected = [...document.querySelectorAll('[role="gridcell"][aria-selected="true"]')].map((c) => c.getAttribute("data-cell"));
    expect(selected).toEqual(["A1", "B1", "A2", "B2"]);
    expect(document.querySelector('p[role="status"]')?.textContent).toBe("Odabrano: A1:B2");
  });
});

describe("SheetGrid errors and refusals", () => {
  it("shows a formula error as its code, with a text reading, and a bad input as an alert without storing it", async () => {
    await mount({ initial: start() });
    await enter("A1", "0");
    await enter("B1", "=1/A1");
    expect(cell("B1").textContent).toBe("#DIV/0!");
    expect(cell("B1").getAttribute("aria-label")).toContain("dijeljenje nulom");
    await enter("C1", "=C1+1");
    expect(cell("C1").textContent).toBe("#CIRC!");
    await focus("A2");
    await key(cell("A2"), "F2");
    await type(editor(), "=");
    await key(editor(), "Enter");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("mora imati sadržaj");
    expect(editor()).not.toBeNull();
    expect(latest!.sheets[0]!.cells.A2).toBeUndefined();
  });

  it("writes through the formula bar for the active cell", async () => {
    await mount({ initial: start() });
    await focus("B2");
    await key(cell("B2"), "ArrowLeft");
    await type(bar(), "Naslov");
    await key(bar(), "Enter");
    expect(latest!.sheets[0]!.cells.A2).toEqual({ value: "Naslov" });
    expect(bar().value).toBe("Naslov");
  });

  it("does not edit a read-only sheet", async () => {
    await mount({ initial: start(), readOnly: true });
    await focus("A1");
    await key(cell("A1"), "x");
    expect(document.querySelector("td input")).toBeNull();
    await key(cell("A1"), "Delete");
    expect(latest).toEqual(start());
  });
});

describe("SheetGrid sheets", () => {
  it("adds a sheet as a tab, switches by arrow key and caps at five", async () => {
    await mount({ initial: start() });
    const add = () => [...document.querySelectorAll("button")].find((b) => b.textContent === "Dodaj list")!;
    await act(async () => { add().click(); });
    expect(latest!.sheets.map((s) => s.name)).toEqual(["Proračun", "List2"]);
    expect(document.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe("List2");
    await key(document.querySelector('[role="tab"][aria-selected="true"]')!, "ArrowLeft");
    expect(document.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe("Proračun");
    for (let i = 0; i < 5; i += 1) await act(async () => { add().click(); });
    expect(latest!.sheets).toHaveLength(5);
    expect(add().hasAttribute("disabled")).toBe(true);
  });
});

describe("SheetGrid review findings", () => {
  it("keeps a pending formula-bar edit when a sheet is added", async () => {
    await mount({ initial: start() });
    await focus("A1");
    await type(bar(), "Zadržano");
    const add = [...document.querySelectorAll("button")].find((b) => b.textContent === "Dodaj list")!;
    await act(async () => { add.click(); });
    expect(latest!.sheets).toHaveLength(2);
    expect(latest!.sheets[0]!.cells.A1).toEqual({ value: "Zadržano" });
  });

  it("does not redo through Ctrl+Shift+Z once the grid is read-only", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    let setRead: (v: boolean) => void = () => {};
    function Wrap() {
      const [ro, setRo] = useState(false);
      setRead = setRo;
      return h(Page, { initial: start(), readOnly: ro });
    }
    await act(async () => { root?.render(h(Wrap)); });
    await enter("A1", "1");
    await focus("A1");
    await key(cell("A1"), "z", { ctrlKey: true });
    const afterUndo = JSON.stringify(latest);
    await act(async () => { setRead(true); });
    await key(cell("A1"), "z", { ctrlKey: true, shiftKey: true });
    expect(JSON.stringify(latest)).toBe(afterUndo);
  });

  it("does not commit when the mouse is pressed inside the open editor", async () => {
    await mount({ initial: start() });
    await focus("A1");
    await key(cell("A1"), "F2");
    await type(editor(), "pola");
    await act(async () => { editor().dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); });
    expect(editor()).not.toBeNull();
    expect(editor().value).toBe("pola");
  });
});

describe("SheetGrid size", () => {
  const btn = (name: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === name)!;
  it("grows by a row or a column, keeps a pending edit, and stops at the limits", async () => {
    await mount({ initial: start() });
    await focus("A1");
    await type(bar(), "ostaje");
    await act(async () => { btn("Dodaj redak").click(); });
    expect(latest!.sheets[0]!.rows).toBe(5);
    expect(latest!.sheets[0]!.cells.A1).toEqual({ value: "ostaje" });
    await act(async () => { btn("Dodaj stupac").click(); });
    expect(latest!.sheets[0]!.columns).toBe(4);
    expect(document.querySelectorAll('th[scope="col"]')).toHaveLength(4);
    for (let i = 0; i < 30; i += 1) await act(async () => { btn("Dodaj stupac").click(); });
    expect(latest!.sheets[0]!.columns).toBe(26);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("najviše 26 stupaca");
  });
});
