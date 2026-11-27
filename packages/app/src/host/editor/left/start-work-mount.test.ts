// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorExtensions } from "../../../../../editor-core/src/editor/schema";
import { assistHr } from "../assist";
import { leftSectionsFor, StartWorkHost } from "./LeftSectionsHost";

// EDI-R16 (F4 student/uređivač): "Započnite rad" on a fresh empty work. Invented work id only.
const live = vi.hoisted(() => ({ editor: null as unknown }));
vi.mock("@/components/editor/LocalDocument", async (original) => ({ ...(await original<Record<string, unknown>>()), useLocalEditor: () => live.editor }));
vi.mock("../../../../../../src/components/editor/LocalDocument.tsx", async (original) => ({ ...(await original<Record<string, unknown>>()), useLocalEditor: () => live.editor }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no modal dialog; it opens like the browser's, and the wizard is visible exactly when its dialog is open.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };

let host: HTMLDivElement | null = null;
let editor: Editor | null = null;
afterEach(() => { host?.remove(); host = null; editor?.destroy(); editor = null; live.editor = null; window.localStorage.clear(); });

function emptyEditor(): Editor {
  editor = new Editor({ element: document.createElement("div"), extensions: createEditorExtensions(), content: { type: "doc", content: [{ type: "paragraph" }] } });
  live.editor = editor;
  return editor;
}
async function mount(...nodes: ReturnType<typeof createElement>[]) {
  host = document.createElement("div");
  document.body.append(host);
  await act(async () => { createRoot(host!).render(createElement("div", null, ...nodes)); });
  return host;
}
const entry = (el: HTMLElement) => [...el.querySelectorAll("button")].find((b) => b.textContent === assistHr.wizard.title);

describe("Započnite rad on an empty work (EDI-R16)", () => {
  it("is enabled as soon as it is mounted, without a click into the page", async () => {
    const e = emptyEditor();
    e.setEditable(true, false);
    const el = await mount(leftSectionsFor("rad-a", "dok-a").thread as never);
    expect(entry(el)?.disabled).toBe(false);
  });

  it("turns on when the provider opens writing after the panel is mounted, with no transaction", async () => {
    const e = emptyEditor();
    e.setEditable(false, false);
    const el = await mount(leftSectionsFor("rad-b", "dok-b").thread as never);
    expect(entry(el)?.disabled).toBe(true);
    await act(async () => { e.setEditable(true, false); await Promise.resolve(); });
    expect(entry(el)?.disabled).toBe(false);
  });

  it("opens a visible dialog when the Napredak section is closed (its cards are not mounted)", async () => {
    const e = emptyEditor();
    e.setEditable(true, false);
    const sections = leftSectionsFor("rad-c", "dok-c");
    // Only the thread section is mounted; Napredak is closed. The wizard host sits beside the editor.
    const el = await mount(sections.thread as never, createElement(StartWorkHost, { workId: "rad-c" }));
    expect(document.querySelector("dialog[open]")).toBeNull();
    await act(async () => { entry(el)!.click(); });
    const dialog = document.querySelector("dialog[open]");
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain(assistHr.wizard.steps[0]);
    expect(host!.contains(dialog)).toBe(true);
  });
});
