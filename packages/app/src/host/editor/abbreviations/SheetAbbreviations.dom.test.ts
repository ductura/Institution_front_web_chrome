// @vitest-environment jsdom
// ED-79: "Popis kratica" on the sheet and the dialog "Kratica X". The editor is a fake with text
// blocks; the work parts and the names are kept in this page's storage. Every text is invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { writeWorkPartsDisplay } from "../../../../../../src/components/editor/parts/work-parts-document.ts";

import { resetFullNamesForTest } from "./abbreviations";
import { abbreviationsHr as t } from "./messages.hr";
import { SheetAbbreviations, type AbbreviationsEditor } from "./SheetAbbreviations";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SCOPE = "f".repeat(64);
const OFF = { abbreviations: false, romanNumerals: false, endnotes: false, index: false };

function fakeEditor(blocks: string[], isEditable = true) {
  const listeners = new Set<() => void>();
  let doc = { descendants: (f: (node: { isTextblock: boolean; textContent: string }) => boolean | void) => { for (const text of blocks) f({ isTextblock: true, textContent: text }); } };
  const editor: AbbreviationsEditor & { type: (next: string[]) => void } = {
    isEditable,
    get state() { return { doc }; },
    on: (_e, l) => listeners.add(l),
    off: (_e, l) => listeners.delete(l),
    type: (next) => { blocks = next; doc = { ...doc, descendants: doc.descendants }; for (const l of listeners) l(); },
  };
  return editor;
}

describe("ED-79 Popis kratica on the sheet", () => {
  let root: Root | undefined;
  let n = 0;
  beforeAll(() => {
    // jsdom has no modal dialogs: enough of <dialog> for the shared Dialog.
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
  });
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; localStorage.clear(); resetFullNamesForTest(); });

  const mount = async (editor: AbbreviationsEditor, on = true) => {
    n += 1;
    const documentId = `doc-${n}`;
    const partsKey = `ductura.editor.work-parts:${JSON.stringify([SCOPE, documentId])}`;
    if (on) localStorage.setItem(partsKey, JSON.stringify({ ...OFF, abbreviations: true }));
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(SheetAbbreviations, { editor, scope: SCOPE, documentId })); });
    return { host, partsKey };
  };
  const box = (host: HTMLElement) => host.querySelector<HTMLElement>("[data-sheet-abbreviations]");
  const rows = (host: HTMLElement) => [...host.querySelectorAll("dl > div")].map((row) => row.textContent);

  it("is off until Popis kratica is turned on in the work parts, and comes at once", async () => {
    const { host, partsKey } = await mount(fakeEditor(["Izmišljena Europska unija (EU)."]), false);
    expect(box(host)).toBeNull();
    await act(async () => { writeWorkPartsDisplay(partsKey, OFF, { ...OFF, abbreviations: true }); });
    expect(rows(host)).toEqual(["EUEuropska unija" + t.edit]);
  });

  it("follows the text and says when there are none yet", async () => {
    const editor = fakeEditor([]);
    const { host } = await mount(editor);
    expect(box(host)?.textContent).toContain(t.empty);
    await act(async () => { editor.type(["Nešto posve drugo (NATO)."]); });
    expect(rows(host)).toEqual(["NATO" + t.unknown + t.write]);
  });

  it("Kratica X keeps the full name the student writes, and an empty one gives the guess back", async () => {
    const { host } = await mount(fakeEditor(["Izmišljena Europska unija (EU)."]));
    const edit = host.querySelector<HTMLButtonElement>(`button[aria-label="${t.editLabel("EU")}"]`)!;
    await act(async () => { edit.click(); });
    const dialog = document.querySelector("dialog")!;
    expect(dialog.querySelector("h2")?.textContent).toBe("Kratica EU");
    const field = dialog.querySelector("input")!;
    expect(field.value).toBe("Europska unija");
    expect(document.activeElement).toBe(field);
    const setValue = (v: string) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, v); field.dispatchEvent(new Event("input", { bubbles: true })); };
    await act(async () => { setValue("Izmišljena Europska unija"); });
    await act(async () => { [...dialog.querySelectorAll("button")].find((b) => b.textContent === t.save)!.click(); });
    expect(document.querySelector("dialog")).toBeNull();
    expect(rows(host)).toEqual(["EUIzmišljena Europska unija" + t.edit]);

    await act(async () => { host.querySelector<HTMLButtonElement>(`button[aria-label="${t.editLabel("EU")}"]`)!.click(); });
    const again = document.querySelector("dialog input") as HTMLInputElement;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(again, ""); again.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => { again.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    expect(rows(host)).toEqual(["EUEuropska unija" + t.edit]);
  });

  it("a work that cannot be edited shows the list without buttons", async () => {
    const { host } = await mount(fakeEditor(["Izmišljena Europska unija (EU)."], false));
    expect(rows(host)).toEqual(["EUEuropska unija"]);
    expect(box(host)?.querySelector("button")).toBeNull();
  });
});
