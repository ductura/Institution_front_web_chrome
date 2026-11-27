// @vitest-environment jsdom
// WEB-F4-EDI-R15: the source buttons answer a click that scripts or assistive technology send (`isTrusted` false).
// The old `isTrusted`-only guard dropped such a click without a word. Every source and name here is invented.
import { Editor } from "@tiptap/core";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditorExtensionsV2 } from "@/editor";

let current: Editor | null = null;
vi.mock("@/components/editor/LocalDocument", () => ({ useLocalEditor: () => current, useLocalSignedOut: () => false }));
vi.mock("./RequiredLiterature", () => ({ RequiredLiterature: () => null }));
const { LiteratureList } = await import("./LiteratureList");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };

const ID = "00000000-0000-4000-8000-00000000c0a1";
const book = { id: ID, type: "book", title: "Izmišljeni vrt", year: 2026, place: "Izmišljeni grad", publisher: "Izmišljeni nakladnik",
  authors: [{ kind: "organization", name: "Izmišljeni institut" }] };

let root: Root | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; current?.destroy(); current = null; document.body.innerHTML = ""; });

async function mount() {
  current = new Editor({ extensions: createEditorExtensionsV2(), content: { type: "doc", attrs: { sources: [book] }, content: [{
    type: "paragraph", attrs: { nodeId: "00000000-0000-4000-8000-000000000001" }, content: [{ type: "text", text: "Tekst bez navoda." }] }] } });
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root?.render(createElement(LiteratureList)); });
  return host;
}
const button = (host: HTMLElement, name: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === name)!;

describe("source buttons without the isTrusted guard", () => {
  it("removes a source on a synthetic click", async () => {
    const host = await mount();
    const click = vi.fn();
    const remove = button(host, "Ukloni");
    remove.addEventListener("click", (e) => click(e.isTrusted));
    await act(async () => { remove.click(); });
    expect(click).toHaveBeenCalledWith(false);
    expect((current!.state.doc.attrs.sources as unknown[]).length).toBe(0);
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Izvor je obrisan.");
  });

  it("opens the edit dialog on a synthetic click", async () => {
    const host = await mount();
    await act(async () => { button(host, "Uredi").click(); });
    expect(document.querySelector("dialog[open]")).not.toBeNull();
  });
});
