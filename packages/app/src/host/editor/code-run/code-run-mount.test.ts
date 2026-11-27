// @vitest-environment jsdom
// WEB-V21-KOD-POKRETANJE: the button appears beside javascript blocks only when the assignment has tests; the result
// shows the standing note; "could not read" is not "no tests".
import { Editor, type JSONContent } from "@tiptap/core";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { V4_CORE_EXTENSIONS } from "../../../../../editor-core/src/editor/extensions-v4";
import { createEditorExtensionsV4 } from "../../../../../editor-core/src/editor/schema";
import { codeViewKey, codeViewPlugin } from "../code-block/code-view";
import { FAKE_CODE_TESTS, fakeReadCodeTests } from "./fake-port";
import type { ReadCodeTests } from "./port";
import type { RunOutcome } from "./runner";

let current: Editor | null = null;
vi.mock("@/components/editor/LocalDocument", () => ({ useLocalEditor: () => current }));
const { CodeRunMount } = await import("./CodeRunPanel");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { requestAnimationFrame?: (cb: () => void) => number }).requestAnimationFrame = (cb) => { cb(); return 0; };
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
const rects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} });
Range.prototype.getClientRects = rects as never;
Range.prototype.getBoundingClientRect = (() => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 })) as never;
Element.prototype.getClientRects = rects as never;

let root: Root | null = null;
let mount: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); mount?.remove(); current?.destroy(); current = null; root = null; mount = null; });

const doc = (language: string): JSONContent => ({ type: "doc", content: [{ type: "codeBlock", attrs: { language, caption: null }, content: [{ type: "text", text: "function solve([a, b]) { return a + b; }" }] }] });

async function render(language: string, readTests: ReadCodeTests, runner: (code: string) => Promise<RunOutcome>) {
  const element = document.createElement("div");
  document.body.append(element);
  current = new Editor({ element, enableCoreExtensions: V4_CORE_EXTENSIONS, extensions: createEditorExtensionsV4(), content: doc(language) });
  // What the toolbar registers: the same plugin, with no actions.
  current.registerPlugin(codeViewPlugin(() => undefined));
  mount = document.createElement("div");
  document.body.append(mount);
  root = createRoot(mount);
  await act(async () => { root!.render(createElement(CodeRunMount, { assignmentId: "a", readTests, runner: runner as never })); });
  return element;
}
const runButton = (el: Element) => Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Pokreni testove");
const passing: RunOutcome = { kind: "results", results: [{ id: "t1", status: "passed" }, { id: "t2", status: "failed", actual: 1 }] };

describe("CodeRunMount", () => {
  it("offers the button on a javascript block with tests, runs it and shows the note and the result", async () => {
    const runner = vi.fn(async () => passing);
    const el = await render("javascript", fakeReadCodeTests, runner);
    const button = runButton(el)!;
    expect(button).toBeTruthy();
    await act(async () => { button.click(); });
    expect(runner).toHaveBeenCalledWith("function solve([a, b]) { return a + b; }", expect.arrayContaining([expect.objectContaining({ id: "t1" })]));
    const text = document.body.textContent ?? "";
    expect(text).toContain("Pokrenuto u vašem pregledniku; to nije provjera nastavnika i ne ulazi u ocjenu.");
    expect(text).toContain("Prošlo 1 od 2 testova.");
    expect(text).toContain(FAKE_CODE_TESTS[1].title);
    expect(text).toContain("Ulaz: [2,3]");
  });

  it("offers nothing on a block of another language, or when the assignment has no tests", async () => {
    expect(runButton(await render("python", fakeReadCodeTests, vi.fn()))).toBeUndefined();
    act(() => root?.unmount()); mount?.remove(); current?.destroy();
    const none: ReadCodeTests = async () => ({ ok: true, body: { revisionNo: 0, language: "javascript", tests: [] } });
    expect(runButton(await render("javascript", none, vi.fn()))).toBeUndefined();
  });

  it("an assignment that is not the student's (404) offers no button", async () => {
    expect(runButton(await render("javascript", async () => ({ ok: false, status: 404 }), vi.fn()))).toBeUndefined();
  });

  it("503 keeps the button and says the tests are unavailable, never that there are none", async () => {
    const runner = vi.fn();
    const el = await render("javascript", async () => ({ ok: false, status: 503 }), runner);
    const button = runButton(el)!;
    expect(button).toBeTruthy();
    await act(async () => { button.click(); });
    expect(runner).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Testovi trenutačno nisu dostupni");
  });

  it("a code without solve gets the message", async () => {
    const el = await render("javascript", fakeReadCodeTests, async () => ({ kind: "missing-solve" }));
    await act(async () => { runButton(el)!.click(); });
    expect(document.body.textContent).toContain("Kod nema funkciju solve");
  });

  it("keeps the toolbar's plugin key single (replaces it, never adds a second)", async () => {
    await render("javascript", fakeReadCodeTests, vi.fn());
    expect(current!.state.plugins.filter((p) => p.spec.key === codeViewKey).length).toBe(1);
  });
});
