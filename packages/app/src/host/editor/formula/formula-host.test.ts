// @vitest-environment jsdom
// WEB-V21-STEM-FORMULA-UREDNIK: the host hook opens the dialog and puts the formula into a v4 document,
// and offers nothing on a v3 work or in a field without the formula tool.
import { Editor, type JSONContent } from "@tiptap/core";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { V4_CORE_EXTENSIONS } from "../../../../../editor-core/src/editor/extensions-v4";
import { createEditorExtensionsV3, createEditorExtensionsV4 } from "../../../../../editor-core/src/editor/schema";
import { profileById } from "../rules/profiles";
import { defaultFormulaTools, formulaToolsOf, useFormulaHost, type FormulaHostApi } from "./FormulaHost";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { requestAnimationFrame?: (cb: () => void) => number }).requestAnimationFrame = (cb) => { cb(); return 0; };
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
// jsdom has no layout: ProseMirror's scroll-into-view reads these.
const rects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} });
Range.prototype.getClientRects = rects as never;
Range.prototype.getBoundingClientRect = (() => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 })) as never;
Element.prototype.getClientRects = rects as never;
HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };

let editor: Editor | null = null;
let root: Root | null = null;
let mount: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); mount?.remove(); editor?.destroy(); editor = null; root = null; mount = null; });

const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Izmišljeni odlomak." }] }] } as JSONContent;

async function render(version: 3 | 4, tools: Parameters<typeof useFormulaHost>[2]): Promise<{ api: () => FormulaHostApi }> {
  const element = document.createElement("div");
  document.body.append(element);
  editor = new Editor(version === 4
    ? { element, enableCoreExtensions: V4_CORE_EXTENSIONS, extensions: createEditorExtensionsV4(), content }
    : { element, extensions: createEditorExtensionsV3(), content });
  editor.commands.setTextSelection(5);
  let latest!: FormulaHostApi;
  const Harness = () => { latest = useFormulaHost(editor, version, tools); return createElement("div", null, latest.dialog); };
  mount = document.createElement("div");
  document.body.append(mount);
  root = createRoot(mount);
  await act(async () => { root!.render(createElement(Harness)); });
  return { api: () => latest };
}

const button = (label: string) => Array.from(document.querySelectorAll("button")).find((b) => b.textContent === label);
const type = async (value: string) => {
  const field = document.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("useFormulaHost", () => {
  it("inserts a block formula through the dialog into the v4 document", async () => {
    const { api } = await render(4, ["formula"]);
    expect(api().availability.enabled).toBe(true);
    await act(async () => { api().open("block"); });
    await type("\\frac{a}{b}");
    await act(async () => { button("Spremi")!.click(); });
    const found: string[] = [];
    editor!.state.doc.descendants((n) => { if (n.type.name === "formula") found.push(String(n.attrs.tex)); });
    expect(found).toEqual(["\\frac{a}{b}"]);
    expect(document.querySelector("dialog[open]")).toBeNull();
  });
  it("keeps the dialog open and the document unchanged for a formula over the limit", async () => {
    const { api } = await render(4, ["formula"]);
    await act(async () => { api().open("inline"); });
    await type("x".repeat(1001));
    expect(button("Spremi")?.hasAttribute("disabled")).toBe(true);
    expect(editor!.getJSON()).toEqual(expect.objectContaining({ content: [expect.objectContaining({ type: "paragraph" })] }));
    expect(JSON.stringify(editor!.getJSON())).not.toContain("inlineFormula");
  });
  it("offers nothing on a v3 work: disabled with a reason, and open() refuses", async () => {
    const { api } = await render(3, ["formula"]);
    expect(api().availability).toMatchObject({ enabled: false });
    expect(api().open("block")).toBe(false);
  });
  it("takes the tools from the work's profile (ef offers the formula tool)", async () => {
    expect(formulaToolsOf(null)).toEqual([]);
    expect(formulaToolsOf(profileById("ef-zavrsni"))).toEqual(["formula"]);
    expect(formulaToolsOf(profileById("df-opci"))).toEqual([]);
  });
  it("offers nothing in a field without the formula tool (the default profile has none)", async () => {
    expect(defaultFormulaTools()).toEqual([]);
    const { api } = await render(4, defaultFormulaTools());
    expect(api().availability).toMatchObject({ enabled: false });
    expect(api().open("inline")).toBe(false);
  });
  it("ED-128: opens the inline dialog with \\ce{H2SO4} in a field with chemistry and saves it", async () => {
    const { api } = await render(4, ["chem"]);
    expect(api().availability.enabled).toBe(false);
    expect(api().chem.enabled).toBe(true);
    await act(async () => { api().openChem(); });
    expect(document.querySelector("textarea")!.value).toBe("\\ce{H2SO4}");
    await act(async () => { button("Spremi")!.click(); });
    const found: string[] = [];
    editor!.state.doc.descendants((n) => { if (n.type.name === "inlineFormula") found.push(String(n.attrs.tex)); });
    expect(found).toEqual(["\\ce{H2SO4}"]);
  });
  it("ED-128: no chemistry in a field without the chem tool", async () => {
    const { api } = await render(4, ["formula"]);
    expect(api().chem).toMatchObject({ enabled: false, reason: "Područje ovog rada ne nudi kemijske formule." });
    expect(api().openChem()).toBe(false);
  });
});
