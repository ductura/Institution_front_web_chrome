// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WritingSessionHost } from "./WritingSessionHost";
import { chapterWords, logAdd, parseSession, summarize, wordsLabel, type Session } from "./session-model";

// ED-110: "Sesija pisanja" (prototype tools.js sessNew/sessStart/sessEnd). Invented chapters only.
const heading = (id: string, level: number, number: string, title: string) => ({ id, level, number, title, pos: 0 });
const live = vi.hoisted(() => ({
  snap: { headings: [] as unknown[], words: [] as number[], total: 0, figures: [], current: -1, selected: "" },
}));
vi.mock("../left/use-left", async (original) => ({ ...(await original<Record<string, unknown>>()), useWorkSnapshot: () => live.snap }));
vi.mock("@/components/editor/LocalDocument", async (original) => ({ ...(await original<Record<string, unknown>>()), useLocalEditor: () => null }));
vi.mock("../../../../../../src/components/editor/LocalDocument.tsx", async (original) => ({ ...(await original<Record<string, unknown>>()), useLocalEditor: () => null }));

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root | null = null;
const setSnap = (words: number[]) => {
  live.snap = { ...live.snap, headings: [heading("a", 2, "1", "Uvod"), heading("a1", 3, "1.1", "Pojmovi"), heading("b", 2, "2", "Metoda")], words, total: words.reduce((s, n) => s + n, 0) };
};
beforeEach(() => { localStorage.clear(); setSnap([100, 50, 200]); });
afterEach(() => { act(() => root?.unmount()); host?.remove(); host = null; root = null; vi.useRealTimers(); });

async function mount(readOnly = false) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(WritingSessionHost, { workId: "rad-1", readOnly })); });
  return host;
}
const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label)!;
const click = async (label: string) => { await act(async () => { button(label).click(); }); };

describe("session model (ED-110)", () => {
  it("counts a level-2 chapter with its subheadings", () => {
    const chapters = chapterWords([heading("a", 2, "1", "Uvod"), heading("a1", 3, "1.1", "Pojmovi"), heading("b", 2, "2", "")] as never, [100, 50, 200], "Bez naslova");
    expect(chapters).toEqual([{ id: "a", title: "1. Uvod", words: 150 }, { id: "b", title: "2. Bez naslova", words: 200 }]);
  });

  it("summarizes words, minutes and the chapters that changed", () => {
    const session: Session = { t0: 0, goalW: 300, goalM: 45, w0: 350, ch0: { a: 150, b: 200 } };
    const summary = summarize(session, 420, [{ id: "a", title: "1. Uvod", words: 220 }, { id: "b", title: "2. Metoda", words: 200 }], 26 * 60_000);
    expect(summary).toEqual({ words: 70, minutes: 26, goalW: 300, chapters: [{ title: "1. Uvod", delta: 70 }] });
    expect(logAdd([], summary, 5)).toEqual([{ at: 5, words: 70, min: 26 }]);
  });

  it("reads back only a sound session and says riječ in the right form", () => {
    expect(parseSession({ t0: "x" })).toBeNull();
    expect(parseSession({ t0: 1, w0: 2, goalW: 0, ch0: { a: 3, b: "x" } })).toEqual({ t0: 1, w0: 2, goalW: null, goalM: null, ch0: { a: 3 } });
    expect([1, 2, 11, 21, 5].map(wordsLabel)).toEqual(["riječ", "riječi", "riječi", "riječ", "riječi"]);
  });
});

describe("WritingSessionHost (ED-110)", () => {
  it("offers a session, starts it with the chosen goals and shows the progress", async () => {
    const el = await mount();
    expect(el.textContent).toContain("cilj za danas");
    await click("Započni sesiju pisanja");
    expect(document.querySelector("dialog")?.textContent).toContain("Sesije vidite samo Vi.");
    expect(button("300").getAttribute("aria-pressed")).toBe("true");
    expect(button("45 min").getAttribute("aria-pressed")).toBe("true");
    await click("500");
    await click("Započni");
    expect(document.querySelector("dialog")).toBeNull();
    expect(el.textContent).toContain("Sesija");
    expect(el.textContent).toContain("+0 / 500 riječi");
    expect(el.textContent).toContain("0 / 45 min");
    expect(JSON.parse(localStorage.getItem("ductura.editor.left.sessionGoals:all")!)).toEqual({ words: 500, minutes: 45 });
  });

  it("ends with what was written, per chapter, and keeps the session in the log", async () => {
    await mount();
    await click("Započni sesiju pisanja");
    await click("bez cilja");
    await click("Započni");
    setSnap([130, 50, 200]);
    await act(async () => { root!.render(createElement(WritingSessionHost, { workId: "rad-1", readOnly: false })); });
    expect(host!.textContent).toContain("+30 riječi");
    await click("Završi");
    const dialog = document.querySelector("dialog")!.textContent!;
    expect(dialog).toContain("Sesija je gotova");
    expect(dialog).toContain("Napisano 30 riječi u 0 min.");
    expect(dialog).toContain("1. Uvod+30");
    expect(dialog).not.toContain("2. Metoda");
    expect(JSON.parse(localStorage.getItem("ductura.editor.left.sessionLog:rad-1")!)).toHaveLength(1);
    expect(localStorage.getItem("ductura.editor.left.session:rad-1")).toBe("null");
    await click("Zatvori");
    expect(host!.textContent).toContain("Započni sesiju pisanja");
  });

  it("says a shortened text, the goal left and the previous sessions", async () => {
    localStorage.setItem("ductura.editor.left.sessionLog:rad-1", JSON.stringify([{ at: Date.UTC(2099, 0, 5, 9), words: 210, min: 40 }]));
    localStorage.setItem("ductura.editor.left.session:rad-1", JSON.stringify({ t0: Date.now(), w0: 400, goalW: 150, goalM: null, ch0: { a: 150, b: 250 } }));
    await mount();
    await click("Završi");
    const dialog = document.querySelector("dialog")!.textContent!;
    expect(dialog).toContain("Skraćeno za 50 riječi u 0 min.");
    expect(dialog).toContain("Do cilja je ostalo 200 riječi.");
    expect(dialog).toContain("2. Metoda-50");
    expect(dialog).toContain("Prethodne sesije");
    expect(dialog).toContain("+210 riječi, 40 min");
  });

  it("shows nothing on a work that cannot be written", async () => {
    const el = await mount(true);
    expect(el.textContent).toBe("");
  });
});
