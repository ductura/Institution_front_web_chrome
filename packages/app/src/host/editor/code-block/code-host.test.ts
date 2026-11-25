// @vitest-environment jsdom
// WEB-V21-STEM-KOD-BLOK: the host hook opens the dialog, puts a code block into a v4 document, draws line numbers,
// caption and `actions`, and offers nothing on a v3 work.
import { Editor, type JSONContent } from "@tiptap/core";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { V4_CORE_EXTENSIONS } from "../../../../../editor-core/src/editor/extensions-v4";
import { createEditorExtensionsV3, createEditorExtensionsV4 } from "../../../../../editor-core/src/editor/schema";
import { useCodeBlockHost, type CodeBlockHostApi } from "./CodeBlockHost";
import type { CodeBlockActions } from "./code-view";
import { setHighlightEngine } from "./highlight";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { requestAnimationFrame?: (cb: () => void) => number }).requestAnimationFrame = (cb) => { cb(); return 0; };
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
const rects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} });
Range.prototype.getClientRects = rects as never;
Range.prototype.getBoundingClientRect = (() => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 })) as never;
Element.prototype.getClientRects = rects as never;

let editor: Editor | null = null;
let root: Root | null = null;
let mount: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); mount?.remove(); editor?.destroy(); editor = null; root = null; mount = null; setHighlightEngine(null); });

const paragraph = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "let a = 1;\nlet b = 2;" }] }] } as JSONContent;

async function render(version: 3 | 4, actions?: CodeBlockActions, content: JSONContent = paragraph) {
  const element = document.createElement("div");
  document.body.append(element);
  editor = new Editor(version === 4
    ? { element, enableCoreExtensions: V4_CORE_EXTENSIONS, extensions: createEditorExtensionsV4(), content }
    : { element, extensions: createEditorExtensionsV3(), content });
  editor.commands.setTextSelection(3);
  let latest!: CodeBlockHostApi;
  const Harness = () => { latest = useCodeBlockHost(editor, version, actions); return createElement("div", null, latest.dialog); };
  mount = document.createElement("div");
  document.body.append(mount);
  root = createRoot(mount);
  await act(async () => { root!.render(createElement(Harness)); });
  return { api: () => latest, element };
}
const button = (label: string) => Array.from(document.querySelectorAll("button")).find((b) => b.textContent === label);
const choose = async (selector: string, value: string, proto: typeof HTMLSelectElement.prototype | typeof HTMLInputElement.prototype) => {
  const el = document.querySelector(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
};

describe("useCodeBlockHost", () => {
  it("inserts a code block with language and caption through the dialog and draws line numbers and caption", async () => {
    const { api, element } = await render(4);
    expect(api().availability.enabled).toBe(true);
    await act(async () => { api().open(); });
    await choose("select", "javascript", HTMLSelectElement.prototype);
    await choose("input", "Zbroj", HTMLInputElement.prototype);
    await act(async () => { button("Spremi")!.click(); });
    expect(JSON.stringify(editor!.getJSON())).toContain('"language":"javascript"');
    expect(editor!.getJSON().content![0]).toMatchObject({ type: "codeBlock", attrs: { language: "javascript", caption: "Zbroj" } });
    expect(document.querySelector("dialog[open]")).toBeNull();
    const block = element.querySelector("[data-code-block]")!;
    expect(block.textContent).toContain("Ispis: Zbroj");
    expect(block.querySelector("pre code")!.textContent).toBe("let a = 1;\nlet b = 2;");
    expect(Array.from(block.children).find((c) => c.getAttribute("aria-hidden") === "true")!.textContent).toBe("12");
    expect(Array.from(block.querySelectorAll("[aria-hidden='true'] > div")).map((n) => n.textContent)).toEqual(["1", "2"]);
    expect(block.querySelector("pre code [class*='hljs-'], pre code .hljs-keyword")).not.toBeNull();
  });
  it("still shows the block, uncoloured, when the library is unavailable", async () => {
    setHighlightEngine(() => { throw new Error("nedostupno"); });
    const { element } = await render(4, undefined, { type: "doc", content: [{ type: "codeBlock", attrs: { language: "javascript", caption: null }, content: [{ type: "text", text: "let a;" }] }] });
    expect(element.querySelector("[data-code-block] pre code")!.textContent).toBe("let a;");
    expect(element.querySelector("pre code span")).toBeNull();
  });
  it("shows the actions given through the `actions` prop and runs them; none without it", async () => {
    const run = vi.fn();
    const actions: CodeBlockActions = (b) => b.language === "javascript" ? [{ id: "tests", label: "Pokreni testove", run }] : [];
    const block = { type: "doc", content: [{ type: "codeBlock", attrs: { language: "javascript", caption: null }, content: [{ type: "text", text: "let a;" }] }] } as JSONContent;
    const { element } = await render(4, actions, block);
    const btn = element.querySelector<HTMLButtonElement>("[data-code-action='tests']")!;
    expect(btn.textContent).toBe("Pokreni testove");
    btn.click();
    expect(run).toHaveBeenCalledOnce();
    act(() => root?.unmount()); mount?.remove(); editor?.destroy();
    const plain = await render(4, undefined, block);
    expect(plain.element.querySelector("[data-code-action]")).toBeNull();
  });
  it("refreshes the buttons of existing blocks when `actions` changes, document unchanged", async () => {
    const first = vi.fn(); const second = vi.fn();
    const block = { type: "doc", content: [{ type: "codeBlock", attrs: { language: "c", caption: null }, content: [{ type: "text", text: "int x;" }] }] } as JSONContent;
    const { element } = await render(4, undefined, block);
    expect(element.querySelector("[data-code-action]")).toBeNull();
    const before = JSON.stringify(editor!.getJSON());
    const rerender = async (actions?: CodeBlockActions) => act(async () => {
      root!.render(createElement(() => { const api = useCodeBlockHost(editor, 4, actions); return createElement("div", null, api.dialog); }));
    });
    await rerender(() => [{ id: "a", label: "Prva", run: first }]);
    element.querySelector<HTMLButtonElement>("[data-code-action='a']")!.click();
    expect(first).toHaveBeenCalledOnce();
    await rerender(() => [{ id: "b", label: "Druga", run: second }]);
    expect(element.querySelector("[data-code-action='a']")).toBeNull();
    element.querySelector<HTMLButtonElement>("[data-code-action='b']")!.click();
    expect(second).toHaveBeenCalledOnce();
    await rerender(undefined);
    expect(element.querySelector("[data-code-action]")).toBeNull();
    expect(JSON.stringify(editor!.getJSON())).toBe(before);
  });
  it("keeps the dialog open and the document unchanged for a caption over 300 characters", async () => {
    const { api } = await render(4);
    await act(async () => { api().open(); });
    await choose("input", "x".repeat(301), HTMLInputElement.prototype);
    expect(button("Spremi")?.hasAttribute("disabled")).toBe(true);
    expect(JSON.stringify(editor!.getJSON())).not.toContain("codeBlock");
  });
  it("changes the properties of the block around the selection", async () => {
    const block = { type: "doc", content: [{ type: "codeBlock", attrs: { language: "c", caption: null }, content: [{ type: "text", text: "int x;" }] }] } as JSONContent;
    const { api } = await render(4, undefined, block);
    expect(api().inBlock).toBe(true);
    await act(async () => { api().open(true); });
    await choose("select", "java", HTMLSelectElement.prototype);
    await act(async () => { button("Spremi")!.click(); });
    expect(editor!.getJSON().content![0]).toMatchObject({ attrs: { language: "java" }, content: [{ text: "int x;" }] });
  });
  it("offers nothing on a v3 work: disabled with a reason, and open() refuses", async () => {
    const { api } = await render(3);
    expect(api().availability).toMatchObject({ enabled: false });
    expect(api().open()).toBe(false);
  });
});
