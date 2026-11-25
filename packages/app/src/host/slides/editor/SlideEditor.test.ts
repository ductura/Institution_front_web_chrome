// @vitest-environment jsdom
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applySlideSteps, slidesRevisionZeroDocument, type SlideStep } from "../../../../../editor-core/src/slides/index.ts";
import { SlideEditor, type SlideEditorProps } from "./SlideEditor.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = host = null;
});

async function mount(props: SlideEditorProps) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(SlideEditor, props)));
  return host;
}
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const ready = (readOnly = false) => ({ kind: "ready", doc: slidesRevisionZeroDocument(), readOnly }) as const;
const button = (el: HTMLElement, name: string) => [...el.querySelectorAll("button")].find((b) => b.textContent?.trim() === name) as HTMLButtonElement | undefined;
const field = (el: HTMLElement, label: string) => {
  const labelled = [...el.querySelectorAll("label")].find((l) => l.textContent === label);
  return (labelled === undefined ? null : document.getElementById(labelled.htmlFor)) as HTMLInputElement | HTMLTextAreaElement | null;
};
async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}

describe("SlideEditor", () => {
  it("loading shows a busy card, not an empty editor", async () => {
    const el = await mount({ source: { kind: "loading" } });
    expect(el.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(el.querySelector("textarea, input")).toBeNull();
  });

  it("an error says so and offers a retry; it never reads as 'no data'", async () => {
    const retry = vi.fn();
    const el = await mount({ source: { kind: "error", onRetry: retry } });
    expect(el.textContent).toContain("Slajdovi se ne mogu otvoriti");
    expect(el.textContent).not.toMatch(/nema podataka|prazno/i);
    await act(async () => button(el, "Pokušaj ponovno")!.click());
    expect(retry).toHaveBeenCalledOnce();
  });

  it("typing makes steps that replay to a valid document; add and undo make steps too", async () => {
    const steps: SlideStep[] = [];
    let n = 0;
    const el = await mount({ source: ready(), onSteps: (s) => steps.push(...s), newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });
    await type(field(el, "Naslov")!, "Uvod");
    await type(field(el, "Bilješke govornika")!, "Pozdraviti");
    await act(async () => button(el, "Dodaj slajd")!.click());
    await settle();
    expect(el.textContent).toContain("Slajd 2 od 2");
    await act(async () => button(el, "Poništi")!.click());
    await settle();
    expect(el.textContent).toContain("Slajd 1 od 1");
    expect(steps.map((s) => s.type)).toEqual(["blockSet", "notesSet", "slideAdd", "slideRemove"]);
    const replay = await applySlideSteps(slidesRevisionZeroDocument(), steps);
    expect(replay.ok && replay.doc.slides[0]).toMatchObject({ notes: "Pozdraviti", blocks: [{ slot: "title", text: "Uvod" }] });
    expect(field(el, "Naslov")!.value).toBe("Uvod");
  });

  it("keeps what is typed while the document holds a trimmed version, and shows the document's text on blur", async () => {
    const el = await mount({ source: ready() });
    const title = field(el, "Naslov")!;
    await type(title, "Uvod ");
    expect(field(el, "Naslov")!.value).toBe("Uvod ");
    await act(async () => { title.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    expect(field(el, "Naslov")!.value).toBe("Uvod");
  });

  it("a refused change is announced and the document is unchanged", async () => {
    const steps: SlideStep[] = [];
    const el = await mount({ source: ready(), onSteps: (s) => steps.push(...s) });
    await type(field(el, "Naslov")!, "x".repeat(201));
    expect(el.querySelector("[role='alert']")?.textContent).toContain("Izmjena nije napravljena");
    expect(steps).toEqual([]);
  });

  it("the last slide cannot be removed", async () => {
    const el = await mount({ source: ready() });
    await act(async () => button(el, "Ukloni slajd")!.click());
    await settle();
    expect(el.querySelector("[role='alert']")?.textContent).toContain("Zadnji slajd");
  });

  it("a submitted work is read only: no actions, fields cannot be changed, the note says so", async () => {
    const steps: SlideStep[] = [];
    const el = await mount({ source: ready(true), onSteps: (s) => steps.push(...s) });
    expect(el.textContent).toContain("Rad je predan");
    for (const name of ["Dodaj slajd", "Ukloni slajd", "Poništi", "Ponovi"]) expect(button(el, name)).toBeUndefined();
    expect(field(el, "Naslov")!.readOnly).toBe(true);
    expect((field(el, "Bilješke govornika") as HTMLTextAreaElement).readOnly).toBe(true);
    await act(async () => { el.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })); });
    expect(steps).toEqual([]);
  });
  it("undo from inside a field keeps that field in the page and shows the document's text", async () => {
    const el = await mount({ source: ready() });
    const notes = field(el, "Bilješke govornika")!;
    await type(notes, "Prva");
    notes.focus();
    await act(async () => { notes.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })); });
    await settle();
    const after = field(el, "Bilješke govornika")!;
    expect(after).toBe(notes);
    expect(after.value).toBe("");
  });

  it("clearing a field and typing at once leaves one block with the typed text", async () => {
    const steps: SlideStep[] = [];
    const el = await mount({ source: ready(), onSteps: (s) => steps.push(...s) });
    await type(field(el, "Naslov")!, "Stari");
    await act(async () => {
      const input = field(el, "Naslov")!;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      for (const value of ["", "A", "AB"]) { set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }
    });
    await settle();
    const replay = await applySlideSteps(slidesRevisionZeroDocument(), steps);
    expect(replay.ok && replay.doc.slides[0]!.blocks).toMatchObject([{ slot: "title", text: "AB" }]);
  });
  it("a change that throws is reported and does not stop the later ones", async () => {
    const el = await mount({ source: ready() });
    const digest = vi.spyOn(globalThis.crypto.subtle, "digest").mockRejectedValueOnce(new Error("no crypto"));
    await act(async () => button(el, "Dodaj slajd")!.click());
    await settle();
    expect(el.querySelector("[role='alert']")?.textContent).toContain("greške u pregledniku");
    expect(el.textContent).toContain("Slajd 1 od 1");
    await act(async () => button(el, "Dodaj slajd")!.click());
    await settle();
    expect(el.textContent).toContain("Slajd 2 od 2");
    digest.mockRestore();
  });
});
