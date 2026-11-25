// @vitest-environment jsdom
// ED-17 (NF2-P15): "Vratiti ovu verziju?" shows what "Da, vrati" changes, and waits for the network.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FAKE_VERSIONS } from "../../time-machine/fake-port";
import type { CompareBlock, CompareRead } from "../../time-machine/model";
import { restoreMessages as text } from "./messages.hr";
import type { RestorePort } from "./model";
import { paragraphs, readRestoreDiff, restoreBlocks, restoreDiff } from "./restore-diff";
import RestoreVersion from "./RestoreVersion";

const block = (op: CompareBlock["op"], words: string): CompareBlock => ({
  op, words: words.split(" ").map((w) => ({ op: op === "changed" ? "same" : op, text: w })),
});

describe("restoreDiff", () => {
  it("turns the comparison around: what the newest text added, the restore takes out", () => {
    const blocks = [block("same", "Uvod ostaje."), block("added", "Novi odlomak."), block("removed", "Stari odlomak.")];
    expect(restoreBlocks(blocks).map((b) => b.op)).toEqual(["same", "removed", "added"]);
    expect(restoreBlocks(blocks)[1]!.words.every((w) => w.op === "removed")).toBe(true);
    const diff = restoreDiff(blocks);
    expect([diff.added, diff.removed]).toEqual([1, 1]);
    expect(diff.first.map((b) => b.words[0]!.text)).toEqual(["Novi", "Stari"]);
  });

  it("counts a changed block on both sides and shows only the first three changes", () => {
    const blocks = [block("added", "a"), block("same", "b"), block("changed", "c"), block("added", "d"), block("added", "e"), block("removed", "f")];
    const diff = restoreDiff(blocks);
    expect([diff.added, diff.removed]).toEqual([2, 4]);
    expect(diff.first.map((b) => b.words[0]!.text)).toEqual(["a", "c", "d"]);
  });

  it("reads the comparison from the picked version to the newest one, and never guesses", async () => {
    const compare = vi.fn(async (): Promise<CompareRead> => ({ kind: "ready", blocks: [block("removed", "x")] }));
    expect(await readRestoreDiff(compare, 1, 3)).toEqual({ kind: "ready", diff: { added: 1, removed: 0, first: [restoreBlocks([block("removed", "x")])[0]] } });
    expect(compare).toHaveBeenCalledWith(1, 3);
    expect(await readRestoreDiff(async () => ({ kind: "unavailable" }), 1, 3)).toEqual({ kind: "unavailable" });
    expect(await readRestoreDiff(async () => { throw new Error("mreža"); }, 1, 3)).toEqual({ kind: "unavailable" });
    expect(await readRestoreDiff(compare, 3, 3)).toEqual({ kind: "unavailable" });
  });

  it("names paragraphs in Croatian", () => {
    expect([0, 1, 2, 4, 5, 11, 12, 21, 22, 112].map(paragraphs)).toEqual([
      "0 odlomaka", "1 odlomak", "2 odlomka", "4 odlomka", "5 odlomaka", "11 odlomaka", "12 odlomaka", "21 odlomak", "22 odlomka", "112 odlomaka",
    ]);
  });
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots: Root[] = [];
let online = true;
Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
afterEach(() => {
  act(() => { roots.splice(0).forEach((root) => root.unmount()); });
  document.body.replaceChildren();
  online = true;
});

async function mount(compare: (from: number, to: number) => Promise<CompareRead>, port: RestorePort = { restore: async () => ({ kind: "saved" }) }) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => { root.render(createElement(RestoreVersion, { documentId: "rad-1", versions: FAKE_VERSIONS, port, compare })); });
  return host;
}
const button = (el: HTMLElement, label: string) => [...el.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement;
async function open(el: HTMLElement, revision: string) {
  const select = el.querySelector("select")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, revision);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => { button(el, text.action).click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

describe("RestoreVersion: the preview before \"Da, vrati\" (ED-17)", () => {
  it("shows the counts, the first changed blocks and the note that no version is removed", async () => {
    const compare = vi.fn(async (): Promise<CompareRead> => ({ kind: "ready", blocks: [
      block("same", "Uvod ostaje."), block("added", "Odlomak koji nestaje."), block("removed", "Odlomak koji se vraća."),
    ] }));
    const el = await mount(compare);
    await open(el, "1");
    expect(compare).toHaveBeenCalledWith(1, 3);
    const dialog = el.querySelector("[role=alertdialog]")!;
    expect(dialog.querySelector("h3")?.textContent).toBe(text.confirmTitle);
    expect(dialog.textContent).toContain(text.diffCount("1 odlomak", "1 odlomak"));
    expect(dialog.textContent).toContain("Odlomak koji nestaje.".split(" ")[0]);
    expect(dialog.textContent).toContain("vraća.");
    expect(dialog.textContent).not.toContain("Uvod");
    expect(dialog.textContent).toContain(text.newVersionNote);
    expect(button(el, text.confirm).disabled).toBe(false);
  });

  it("says so when the comparison cannot be read, and the restore stays possible", async () => {
    const el = await mount(async () => ({ kind: "unavailable" }));
    await open(el, "2");
    expect(el.querySelector("[data-restore-diff]")?.getAttribute("data-restore-diff")).toBe("unavailable");
    expect(el.textContent).toContain(text.diffUnavailable);
    expect(button(el, text.confirm).disabled).toBe(false);
  });

  it("without a network \"Da, vrati\" is off and the port is not asked; it comes back with the network", async () => {
    const restore = vi.fn<RestorePort["restore"]>(async () => ({ kind: "saved" }));
    online = false;
    const el = await mount(async () => ({ kind: "ready", blocks: [] }), { restore });
    await open(el, "1");
    expect(el.textContent).toContain(text.offline);
    expect(el.textContent).toContain(text.diffNone);
    expect(button(el, text.confirm).disabled).toBe(true);
    await act(async () => { button(el, text.confirm).click(); });
    expect(restore).not.toHaveBeenCalled();
    online = true;
    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(el.textContent).not.toContain(text.offline);
    await act(async () => { button(el, text.confirm).click(); });
    expect(restore).toHaveBeenCalledWith("rad-1", 1, 3);
  });
});
