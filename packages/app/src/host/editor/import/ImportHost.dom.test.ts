// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ED-20 (NF2-P19): the dialog over a fake api and a fake editor. Invented ids and text.
const editor = vi.hoisted(() => ({ value: null as null | Record<string, unknown> }));
vi.mock("../../../../../../src/components/editor/LocalDocument.tsx", () => ({ useLocalEditor: () => editor.value }));

import { ImportHost } from "./ImportHost";

const D = "33333333-3333-4333-8333-333333333333";
const I = "22222222-2222-4222-8222-222222222222";
const BODY = {
  importId: I, manifestSha256: "a".repeat(64), source: "import", evidenceKind: "imported", fileFormat: "docx",
  content: { schemaVersion: 2, sources: [], nodes: [{ type: "paragraph", id: "p1", children: [{ type: "text", text: "Izmišljeni uvezeni odlomak.", marks: [] }] }] },
  traces: [], rawByteLength: 10, fileName: "rad.docx", baseRevision: 1, expiresAt: "2026-11-25T12:00:00.000Z",
};

let root: Root;
let host: HTMLDivElement;
let inserted: unknown[];
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  inserted = [];
  const chain = { focus: () => chain, insertContent: (content: unknown) => { inserted.push(content); return chain; }, run: () => true };
  editor.value = { isDestroyed: false, isEditable: true, chain: () => chain };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const fakeApi = (answers: Record<string, unknown>) =>
  (async (id: string) => answers[id]) as unknown as NonNullable<Parameters<typeof ImportHost>[0]["api"]>;
const button = (name: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === name)!;
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
async function choose(name: string, size = 4) {
  const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
  Object.defineProperty(input, "files", { value: [new File([new Uint8Array(size)], name)], configurable: true });
  await act(async () => button("Pregledaj uvoz").click());
  await settle();
}

describe("ImportHost", () => {
  it("draws nothing without a document or while the work cannot be edited", () => {
    act(() => root.render(h(ImportHost, { documentId: "" })));
    expect(host.innerHTML).toBe("");
    editor.value = { isDestroyed: false, isEditable: false, chain: () => null };
    act(() => root.render(h(ImportHost, { documentId: D })));
    expect(host.innerHTML).toBe("");
  });

  it("previews, adds nothing before Potvrdi uvoz, then puts the text at the end", async () => {
    const api = fakeApi({ "work.imports.post": { ok: true, status: 201, body: BODY }, "work.imports.confirm.post": { ok: true, status: 200, body: { importId: I, eventId: "e-1" } } });
    act(() => root.render(h(ImportHost, { documentId: D, api })));
    act(() => button("Uvezi tekst iz datoteke").click());
    expect(document.querySelector("dialog")?.textContent).toContain("Datoteka (.docx ili .pdf, do 2 MB)");
    await choose("rad.docx");
    const dialog = document.querySelector("dialog")!;
    expect(dialog.textContent).toContain("rad.docx · 3 riječi");
    expect(dialog.textContent).toContain("Pregled čeka Vašu potvrdu. Ništa nije dodano u rad.");
    expect(inserted).toEqual([]);
    await act(async () => button("Potvrdi uvoz").click());
    await settle();
    expect(inserted).toEqual([[{ type: "paragraph", content: [{ type: "text", text: "Izmišljeni uvezeni odlomak." }] }]]);
    expect(document.querySelector("dialog")).toBeNull();
    expect(host.querySelector("[role=status]")?.textContent).toBe("Uvezeno 3 riječi, označeno kao uvezeno.");
  });

  it("refuses a wrong format or a file over 2 MB without a call, and says when import is not allowed", async () => {
    let calls = 0;
    const api = (async () => { calls += 1; return { ok: false, status: 403, code: "import_not_allowed" }; }) as unknown as NonNullable<Parameters<typeof ImportHost>[0]["api"]>;
    act(() => root.render(h(ImportHost, { documentId: D, api })));
    act(() => button("Uvezi tekst iz datoteke").click());
    await choose("rad.odt");
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Podržani su samo .docx i .pdf.");
    await choose("rad.pdf", 2 * 1024 * 1024 + 1);
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Datoteka je veća od 2 MB. Odaberite manju ili zalijepite tekst.");
    expect(calls).toBe(0);
    await choose("rad.pdf");
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Uvoz za ovaj rad nije dopušten.");
    expect(inserted).toEqual([]);
  });

  it("starts over when the work changed since the preview", async () => {
    const api = fakeApi({ "work.imports.post": { ok: true, status: 201, body: BODY }, "work.imports.confirm.post": { ok: false, status: 409, code: "import_revision_changed" } });
    act(() => root.render(h(ImportHost, { documentId: D, api })));
    act(() => button("Uvezi tekst iz datoteke").click());
    await choose("rad.docx");
    await act(async () => button("Potvrdi uvoz").click());
    await settle();
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Rad se u međuvremenu promijenio. Odaberite datoteku ponovno.");
    expect(document.querySelector("input[type=file]")).not.toBeNull();
    expect(inserted).toEqual([]);
  });

  const NOTEBOOK = JSON.stringify({ metadata: { kernelspec: { language: "python" } }, cells: [
    { cell_type: "markdown", source: "# Izmišljeno" },
    { cell_type: "code", source: "print(1)", outputs: [{ output_type: "stream", name: "stdout", text: "1\n" }, { output_type: "display_data", data: { "text/html": "<b>1</b>" } }] },
  ] });
  async function chooseNotebook(text: string) {
    const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
    const file = new File([text], "izmisljeno.ipynb");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => button("Pregledaj uvoz").click());
    await settle();
  }

  it("reads a notebook in the browser without any call, previews it and inserts only after Potvrdi uvoz", async () => {
    let calls = 0;
    const api = (async () => { calls += 1; return {}; }) as unknown as NonNullable<Parameters<typeof ImportHost>[0]["api"]>;
    (editor.value as Record<string, unknown>).schema = { nodes: { codeBlock: {} } };
    act(() => root.render(h(ImportHost, { documentId: D, api })));
    act(() => button("Uvezi tekst iz datoteke").click());
    await chooseNotebook(NOTEBOOK);
    const dialog = document.querySelector("dialog")!;
    expect(dialog.textContent).toContain("Odbačeno izlaza (HTML, JavaScript, slike i ostalo): 1.");
    expect(dialog.textContent).not.toContain("<b>");
    expect(inserted).toEqual([]);
    await act(async () => button("Potvrdi uvoz").click());
    expect(calls).toBe(0);
    expect(inserted).toHaveLength(1);
    expect(JSON.stringify(inserted[0])).toContain('"imported"');
    expect(host.querySelector("[role=status]")?.textContent).toBe("Uvezeno blokova: 3, označeno kao uvezeno. Odbačeno izlaza: 1.");
  });

  it("refuses a broken notebook with a message, and inserts nothing when the editor has no code blocks", async () => {
    act(() => root.render(h(ImportHost, { documentId: D })));
    act(() => button("Uvezi tekst iz datoteke").click());
    await chooseNotebook("{ nije json");
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Bilježnicu nije moguće pročitati. Provjerite je li ispravna.");
    await chooseNotebook(NOTEBOOK);
    await act(async () => button("Potvrdi uvoz").click());
    expect(document.querySelector("[role=alert]")?.textContent).toContain("ne podržava blokove kôda");
    expect(inserted).toEqual([]);
  });
});
