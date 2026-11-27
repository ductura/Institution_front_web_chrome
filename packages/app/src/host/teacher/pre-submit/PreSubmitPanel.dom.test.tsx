// @vitest-environment jsdom
// F4-NAS-R20-RUTA: the teacher's "Mjesta za izvor" reads the submitted revision through the teacher route; 404 keeps the existing message.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { preSubmitMessages as text } from "./messages.hr";

const read = vi.fn();
vi.mock("./read", () => ({ readSubmittedVersion: (...a: unknown[]) => read(...a) }));
vi.mock("../n07/WorkPage", () => ({
  WorkPanel: ({ children }: { children: unknown }) => h("section", null, children as never),
  StateBlock: ({ children }: { children: unknown }) => h("div", null, children as never),
  workPageStyles: { places: "places", acts: "acts" },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; read.mockReset(); });

const SRC = { id: "11111111-1111-4111-8111-111111111111", type: "book", authors: [{ kind: "person", family: "Autor A", given: "Ana" }], year: 2019, title: "Izmišljena knjiga", place: "Grad", publisher: "Nakladnik" };
const DOCUMENT = { schemaVersion: 3, sources: [SRC], nodes: [
  { type: "heading", level: 1, id: "44444444-4444-4444-8444-444444444441", children: [{ type: "text", text: "Uvod", marks: [] }] },
  { type: "paragraph", id: "22222222-2222-4222-8222-222222222221", children: [{ type: "citation", sourceId: "33333333-3333-4333-8333-333333333333" }] },
] };
const OUTCOME = { kind: "ok", summary: { pastes: { listedAboveCharacters: 200, listed: [] } } } as never;

async function show(documentId?: string, revision?: number) {
  const { PreSubmitPanel } = await import("./PreSubmitPanel");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(h(PreSubmitPanel, { outcome: OUTCOME, summaryHref: "/x", onReload: () => {}, ...(documentId === undefined ? {} : { documentId }), ...(revision === undefined ? {} : { revision }) })); });
  await act(async () => {});
}

describe("N-07 'Mjesta za izvor' for the teacher", () => {
  it("shows the open places read from the submitted revision", async () => {
    read.mockResolvedValue({ kind: "document", document: DOCUMENT });
    await show("izmisljeni-rad-0001", 1);
    expect(read.mock.calls[0]?.slice(0, 2)).toEqual(["izmisljeni-rad-0001", 1]);
    expect(host!.textContent).toContain("1. Uvod, odlomak 1");
  });
  it("404 gives the existing unavailable message, never 'none'", async () => {
    read.mockResolvedValue({ kind: "notFound" });
    await show("izmisljeni-rad-0001", 1);
    expect(host!.textContent).toContain(text.placesUnavailable);
    expect(host!.textContent).not.toContain(text.placesNone);
  });
  it("without a document id or revision nothing is read and the places are unavailable", async () => {
    await show("izmisljeni-rad-0001");
    expect(read).not.toHaveBeenCalled();
    expect(host!.textContent).toContain(text.placesUnavailable);
  });
});
