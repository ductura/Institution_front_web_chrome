// @vitest-environment jsdom
// PIL-P1-PODUDARANJE-PROVJERA-WEB: the editor sends the segments the student changed to the check,
// and reads the notice again when one matched. Routes are fakes; ids and texts are invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAssistantMatchCall, type SegmentCheckAnswer } from "@/client/assistant-match";

import { AssistantMatchNoticeHost, IDLE_MS } from "./AssistantMatchNoticeHost";
import { segmentsIn, segmentsToCheck } from "./segment-check";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOC = "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d01";
const LONG = "Ovo je izmišljena rečenica od dovoljno riječi za usporedbu s odgovorom.";
const FINDING = { segmentRef: "p-2", conversationId: "c-1", messageId: "m-1", runWords: 9, recordedAt: "2026-11-20T10:00:00.000Z", attachedAt: "2026-11-20T10:00:00.000Z" };

function editor(editable = true): HTMLElement {
  const dom = document.createElement("div");
  dom.className = "ProseMirror";
  dom.setAttribute("contenteditable", String(editable));
  dom.innerHTML = `<p data-node-id="p-1">${LONG}</p><p data-node-id="p-2">Kratko.</p>`;
  document.body.append(dom);
  return dom;
}

function type(dom: HTMLElement, nodeId: string, text: string) {
  dom.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`)!.textContent = text;
  dom.dispatchEvent(new Event("input", { bubbles: true }));
}

async function pause() {
  await act(async () => { await vi.advanceTimersByTimeAsync(IDLE_MS); });
  await act(async () => { await Promise.resolve(); });
}

describe("segment-check", () => {
  it("takes the innermost blocks with a node id and sends only changed text of 8 or more words", () => {
    const dom = document.createElement("div");
    dom.innerHTML = `<ul data-node-id="l-1"><li data-node-id="i-1">${LONG}</li></ul><p data-node-id="p-2">Kratko.</p><p>${LONG}</p>`;
    const now = segmentsIn(dom);
    expect(now).toEqual([{ segmentRef: "i-1", text: LONG }, { segmentRef: "p-2", text: "Kratko." }]);
    expect(segmentsToCheck(now, new Map())).toEqual([{ segmentRef: "i-1", text: LONG }]);
    expect(segmentsToCheck(now, new Map([["i-1", LONG]]))).toEqual([]);
  });
});

describe("AssistantMatchNoticeHost: the check of changed segments", () => {
  let root: Root | undefined;
  let get: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    get = vi.fn(async () => ({ ok: true, status: 200, headers: {}, body: { findings: [FINDING] } }));
  });
  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  const mount = async (check: (d: string, s: { segmentRef: string; text: string }) => Promise<SegmentCheckAnswer>) => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const call = createAssistantMatchCall(get as never);
    await act(async () => { root?.render(h(AssistantMatchNoticeHost, { documentId: DOC, call, check })); });
  };

  it("sends a changed segment after a pause, not what the editor opened with, and reads the notice again on a match", async () => {
    const dom = editor();
    const check = vi.fn(async (): Promise<SegmentCheckAnswer> => ({ ok: true, matched: 1 }));
    await mount(check);
    expect(get).toHaveBeenCalledTimes(1);
    type(dom, "p-2", LONG);
    expect(check).not.toHaveBeenCalled();
    await pause();
    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith(DOC, { segmentRef: "p-2", text: LONG });
    expect(get).toHaveBeenCalledTimes(2);
    // The same text is not checked again.
    dom.dispatchEvent(new Event("input"));
    await pause();
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("does not read the notice again when nothing matched (the switch off answers no match)", async () => {
    const dom = editor();
    const check = vi.fn(async (): Promise<SegmentCheckAnswer> => ({ ok: true, matched: 0 }));
    await mount(check);
    type(dom, "p-2", LONG);
    await pause();
    expect(check).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("sends nothing from a read-only editor (a submitted work or a replay)", async () => {
    const dom = editor(false);
    const check = vi.fn(async (): Promise<SegmentCheckAnswer> => ({ ok: true, matched: 1 }));
    await mount(check);
    type(dom, "p-2", LONG);
    await pause();
    expect(check).not.toHaveBeenCalled();
  });

  it("stops checking after the session is gone", async () => {
    const dom = editor();
    const check = vi.fn(async (): Promise<SegmentCheckAnswer> => ({ ok: false, status: 401, code: "unauthorized" }));
    await mount(check);
    type(dom, "p-2", LONG);
    await pause();
    type(dom, "p-1", `${LONG} Još jedna izmišljena rečenica.`);
    await pause();
    expect(check).toHaveBeenCalledTimes(1);
  });
});
