// @vitest-environment jsdom
// ED-96: the prototype's "Sesija pisanja": goal, the foot line, "Završi" and the summary. Invented text.
import { Editor } from "@tiptap/core";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorExtensionsV3, NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/schema";
import { countsOf, endSession, footLine, parseGoal, parseSession, sessionHr as t, startSession, summaryLine } from "./session-model";
import { WritingSessionFoot } from "./WritingSessionFoot";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const para = (n: number, text: string) => ({ type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: id(n) }, content: [{ type: "text", text }] });
const head = (n: number, text: string) => ({ type: "heading", attrs: { [NODE_ID_ATTRIBUTE]: id(n), level: 2 }, content: [{ type: "text", text }] });

let editor: Editor | null = null;
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount()); root = null;
  host?.remove(); host = null;
  editor?.destroy(); editor = null;
  localStorage.clear();
});

function make() {
  editor = new Editor({ element: document.createElement("div"), extensions: createEditorExtensionsV3(), content: { type: "doc", content: [
    head(1, "Uvod"), para(2, "Jedan dva tri."), head(3, "Metoda"), para(4, "Četiri pet."),
  ] } });
  return editor;
}
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label);

describe("Sesija pisanja (ED-96)", () => {
  it("counts the work and each chapter", () => {
    const counts = countsOf(make().state.doc);
    expect(counts.total).toBe(7);
    expect(counts.chapters).toEqual([{ id: id(1), title: "1 Uvod", words: 3 }, { id: id(3), title: "2 Metoda", words: 2 }]);
  });

  it("says the foot line and the summary as the prototype", () => {
    const e = make();
    const s = startSession(countsOf(e.state.doc), { w: 300, m: 45 }, 0);
    e.commands.insertContentAt(e.state.doc.content.size - 1, " šest sedam");
    const counts = countsOf(e.state.doc);
    expect(footLine(s, counts, 12 * 60_000)).toBe("+2 / 300 riječi, 12 / 45 min");
    const sum = endSession(s, counts, 12 * 60_000);
    expect(sum.ch).toEqual([{ title: "2 Metoda", delta: 2 }]);
    expect(summaryLine(sum)).toEqual({ lead: "Napisano 2 riječi", rest: " u 12 min. Do cilja je ostalo 298 riječi." });
    expect(summaryLine({ words: -21, min: 3, goalW: 0, ch: [] })).toEqual({ lead: "Skraćeno za 21 riječ", rest: " u 3 min." });
    expect(summaryLine({ words: 300, min: 40, goalW: 300, ch: [] }).rest).toBe(" u 40 min. Cilj od 300 riječi je dosegnut.");
  });

  it("reads only well formed values from the device", () => {
    expect(parseSession({ t0: 1 })).toBeNull();
    expect(parseGoal({ w: 7, m: 90 })).toEqual({ w: 300, m: 90 });
  });

  it("starts with the chosen goal, keeps it on the device, and ends with the summary", () => {
    const e = make();
    let clock = 1_000;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => { root!.render(h(WritingSessionFoot, { editor: e, workId: "rad-demo", now: () => clock })); });
    expect(host.textContent).toContain(t.startHint);
    act(() => { button(t.start)!.click(); });
    expect(document.body.textContent).toContain(t.intro);
    act(() => { button("500")!.click(); });
    act(() => { button(t.begin)!.click(); });
    expect(JSON.parse(localStorage.getItem([...Array(localStorage.length).keys()].map((i) => localStorage.key(i)!).find((k) => k.includes("writing-session") && !k.includes("log") && !k.includes("goal"))!)!)).toMatchObject({ goalW: 500, goalM: 45, w0: 7 });
    expect(host.textContent).toContain("+0 / 500 riječi, 0 / 45 min");
    e.commands.insertContentAt(7, "Novi ");
    clock += 5 * 60_000;
    act(() => { button(t.end)!.click(); });
    expect(document.body.textContent).toContain(t.doneTitle);
    expect(document.body.textContent).toContain("Napisano 1 riječ u 5 min. Do cilja je ostalo 499 riječi.");
    expect(document.body.textContent).toContain("1 Uvod+1");
    expect(document.body.textContent).toContain("+1 riječ, 5 min");
    expect(host.textContent).toContain(t.start);
  });

  it("shows nothing on a submitted work", () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => { root!.render(h(WritingSessionFoot, { editor: make(), workId: "rad-demo", hidden: true })); });
    expect(host.textContent).toBe("");
  });
});
