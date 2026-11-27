// @vitest-environment jsdom
// ED-113: "Kostur za obranu" composed from a real editor document and the left panel's thread. Invented texts only.
import { Editor } from "@tiptap/core";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorExtensionsV2 } from "@/editor";

import { storageKey } from "../left/left-model";

import type { DefenseNode } from "./defense-model";
import { DefensePanel } from "./DefensePanel";
import { mentorCardHr } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const t = mentorCardHr.defense;
const WORK = "rad-obrana";
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const heading = (level: number, text: string) => ({ type: "heading", attrs: { level, nodeId: id() }, content: [{ type: "text", text }] });
const para = (text: string) => ({ type: "paragraph", attrs: { nodeId: id() }, content: [{ type: "text", text }] });
const DOC = {
  type: "doc",
  content: [
    heading(1, "Izmišljeni vrtovi"),
    heading(2, "Uvod"), para("Rad opisuje izmišljene vrtove. Druga rečenica."),
    heading(3, "Pozadina"), para("Ovo je potpoglavlje."),
    heading(2, "Rezultati"), heading(3, "Mjerenja"), para("Potvrđujemo H2 i H1 u mjerenjima."),
  ],
};

describe("ED-113 Kostur za obranu (panel)", () => {
  let root: Root | undefined;
  let editor: Editor | undefined;
  afterEach(() => {
    act(() => root?.unmount()); editor?.destroy(); root = undefined; editor = undefined;
    document.body.innerHTML = ""; localStorage.clear();
  });

  const mount = async (onCopy?: (text: string) => Promise<boolean>) => {
    const place = document.createElement("div");
    document.body.append(place);
    editor = new Editor({ element: place, extensions: createEditorExtensionsV2(), content: DOC });
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(DefensePanel, { workId: WORK, onCopy, doc: () => editor!.state.doc as unknown as DefenseNode })); });
  };
  const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement | undefined;
  const click = async (label: string) => { await act(async () => { button(label)!.click(); await Promise.resolve(); }); };
  const area = () => document.querySelector("textarea")!;

  it("composes the outline from the title, the thread's question, the chapters and the hypotheses", async () => {
    localStorage.setItem(storageKey("thread", WORK), JSON.stringify({ question: "Što zadržava vodu?", hypotheses: [] }));
    await mount();
    expect(document.body.textContent).toContain(t.empty);
    await click(t.make);
    const text = area().value;
    expect(text).toContain("1. Naslov i tema\n   Izmišljeni vrtovi");
    expect(text).toContain("2. Pitanje rada\n   Što zadržava vodu?");
    expect(text).toContain("3. Uvod\n   Rad opisuje izmišljene vrtove.");
    expect(text).not.toContain("Druga rečenica");
    // A chapter that opens with a subchapter starts with the subchapter's first sentence (prototype paras to headEnd).
    expect(text).toContain("4. Rezultati\n   Potvrđujemo H2 i H1 u mjerenjima.");
    expect(text).not.toContain("Ovo je potpoglavlje");
    expect(text).toContain(`5. Hipoteze\n   H1, H2: ${t.hypothesesAsk}`);
    expect(button(t.remake)).toBeDefined();
  });

  it("keeps the student's edit on this device and copies the edited text", async () => {
    const onCopy = vi.fn(async () => true);
    await mount(onCopy);
    await click(t.make);
    const edited = `${area().value}\n\nMoja bilješka.`;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      set.call(area(), edited);
      area().dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(JSON.parse(localStorage.getItem(storageKey("defense", WORK)) ?? "null")).toBe(edited);
    await click(t.copy);
    expect(onCopy).toHaveBeenCalledWith(edited);
    expect(document.body.textContent).toContain(t.copied);
  });

  it("says when the copy fails", async () => {
    await mount(async () => false);
    await click(t.make);
    await click(t.copy);
    expect(document.querySelector("[role=alert]")?.textContent).toBe(t.copyFailed);
  });
});
