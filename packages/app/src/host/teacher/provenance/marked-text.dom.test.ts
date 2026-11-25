// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import ProvenanceMap from "./ProvenanceMap";
import { fakeMatchCall } from "./fake-match";
import { placeRanges } from "./marked-text";
import { readOfParts } from "./model";
import type { ProvenanceCall } from "./read";
import { markedTextMessages as t } from "./text-messages.hr";
import type { TextCall, TextRead } from "./text-read";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Invented work and text.
const DOCUMENT = "izmisljeni-rad-1";
const BLOCKS = [
  { id: "b1", heading: false, text: "Zalijepljena rečenica. Vlastita rečenica." },
  { id: "b2", heading: false, text: "Rečenica iz Asistenta." },
];
const TEXT: TextRead = { kind: "text", text: placeRanges(7, BLOCKS, [
  { blockId: "b1", start: 0, end: 22, kind: "pasted_unknown", segmentRef: null },
  { blockId: "b2", start: 0, end: 22, kind: "assistant_inserted", segmentRef: "odsjecak-1" },
]) };

describe("PG-2 Karta podrijetla: the mounted map with the text of the work", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  const mount = async (call: ProvenanceCall, read: TextRead = TEXT) => {
    const asked: string[] = [];
    const textCall: TextCall = async (documentId) => { asked.push(documentId); return read; };
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(ProvenanceMap, { documentId: DOCUMENT, call, textCall, matchCall: fakeMatchCall({ kind: "none" }).call })); });
    return { host, asked };
  };
  const button = (host: HTMLElement) => host.querySelector<HTMLButtonElement>("button[data-next-mark]");

  it("reads the text once the work has marks and steps the focus from mark to mark, saying which one", async () => {
    const { host, asked } = await mount(async () => ({ kind: "marked" as const }));
    expect(asked).toEqual([DOCUMENT]);
    expect(host.querySelector('[data-kind="pasted_unknown"]')?.textContent).toBe("Zalijepljena rečenica.");
    expect(host.querySelector("[data-mark-status]")?.textContent).toBe("");
    await act(async () => { button(host)?.click(); });
    expect(document.activeElement?.textContent).toBe("Zalijepljena rečenica.");
    expect(host.querySelector("[data-mark-status]")?.textContent).toBe(t.markStatus(1, 2, "pasted_unknown"));
    await act(async () => { button(host)?.click(); });
    expect(document.activeElement?.getAttribute("data-kind")).toBe("assistant_inserted");
    await act(async () => { button(host)?.click(); });
    expect(document.activeElement?.getAttribute("data-kind")).toBe("pasted_unknown");
    expect(host.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("turning „Podrijetlo teksta” off hides the words and turns the step off", async () => {
    const { host } = await mount(async () => ({ kind: "marked" as const }));
    const origin = host.querySelector<HTMLInputElement>('input[data-sw="origin"]');
    await act(async () => { origin?.click(); });
    expect(host.querySelector("[data-map-text]")?.getAttribute("data-origin")).toBe("off");
    expect(button(host)?.disabled).toBe(true);
  });

  // PG-2: a work whose only mark is the match with an answer of the Asistent still reads and shows its marked text.
  it("reads the text of a work whose only mark is the assistant match", async () => {
    const parts = [{ kind: "typed", percent: 92 }, { kind: "assistant_inserted", percent: 0 }, { kind: "assistant_match", percent: 8 },
      { kind: "imported_file", percent: 0 }, { kind: "pasted_known", percent: 0 }, { kind: "pasted_unknown", percent: 0 }];
    const matched: TextRead = { kind: "text", text: placeRanges(7, BLOCKS, [{ blockId: "b2", start: 0, end: 22, kind: "assistant_match", segmentRef: "odsjecak-1" }]) };
    const { host, asked } = await mount(async () => readOfParts(parts), matched);
    expect(asked).toEqual([DOCUMENT]);
    expect(host.querySelector('[data-kind="assistant_match"]')?.textContent).toBe("Rečenica iz Asistenta.");
    expect(host.textContent).toContain(t.markLabel("assistant_match", 1));
  });

  it("does not read the text of a work without marks", async () => {
    const { host, asked } = await mount(async () => ({ kind: "noMarks" as const }));
    expect(asked).toEqual([]);
    expect(host.querySelector("[data-marked-text]")).toBeNull();
  });

  it("a failed text read offers a retry that reads again", async () => {
    let answer: TextRead = { kind: "unavailable" };
    const asked: string[] = [];
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const textCall: TextCall = async (documentId) => { asked.push(documentId); return answer; };
    await act(async () => { root?.render(h(ProvenanceMap, { documentId: DOCUMENT, call: async () => ({ kind: "marked" as const }), textCall, matchCall: fakeMatchCall({ kind: "none" }).call })); });
    expect(host.textContent).toContain(t.unavailable);
    answer = TEXT;
    const retry = [...host.querySelectorAll("button")].find((b) => b.textContent === t.retry);
    await act(async () => { retry?.click(); });
    expect(asked).toEqual([DOCUMENT, DOCUMENT]);
    expect(host.querySelector("[data-marked-text]")).not.toBeNull();
  });
});
