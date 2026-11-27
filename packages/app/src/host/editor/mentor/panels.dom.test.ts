// @vitest-environment jsdom
// WEB-NF6-RUNDA (MK-8, MK-9, MK-10): the panels of the Mentor card as a student meets them, over stand-in
// ports. Invented text and identifiers only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mentorCardHr as t } from "./messages.hr";
import { OwnPanel } from "./OwnPanel";
import { PrepPanel } from "./PrepPanel";
import type { PrepPort } from "./prep-port";
import { SaidPanel } from "./SaidPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
async function mount(node: ReturnType<typeof h>): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(node); });
  return host;
}
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });
const click = async (host: HTMLElement, name: string) => {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent === name);
  if (!button) throw new Error(`no button ${name}`);
  await act(async () => { button.click(); });
};

const INPUT = { since: null, changed: 2, resolved: null, agreed: [], openComments: 1, words: null, toReview: null };

describe("PrepPanel", () => {
  it("is empty until composed, then sends the edited text and says so only after the server confirmed", async () => {
    const send = vi.fn<PrepPort["send"]>(async () => "sent");
    const host = await mount(h(PrepPanel, { port: { compose: async () => INPUT, send }, words: null, editable: true }));
    expect(host.textContent).toContain(t.prep.empty);
    expect(host.textContent).toContain(t.prep.note);
    await click(host, t.prep.make);
    const area = host.querySelector("textarea")!;
    expect(area.value).toContain("izmijenjeno odlomaka: 2");
    await click(host, t.prep.send);
    expect(send).toHaveBeenCalledWith(area.value);
    expect(host.querySelector('[role="status"]:last-of-type')?.textContent).toBe(t.prep.sent);
  });

  it("keeps the text and says why when the send fails, and refuses a text over the limit without a request", async () => {
    const send = vi.fn<PrepPort["send"]>(async () => "failed");
    const host = await mount(h(PrepPanel, { port: { compose: async () => INPUT, send }, words: null, editable: true }));
    await click(host, t.prep.make);
    await click(host, t.prep.send);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(t.prep.sendFailed);
    expect(host.querySelector("textarea")!.value).toContain("Priprema za konzultacije");
    expect(host.textContent).not.toContain(t.prep.sent);
  });

  it("says unavailable when nothing could be read, and never draws a send after submission", async () => {
    const host = await mount(h(PrepPanel, { port: { compose: async () => null, send: async () => "sent" as const }, words: null, editable: false }));
    await click(host, t.prep.make);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(t.prep.unavailable);
    const ready = await mount(h(PrepPanel, { port: { compose: async () => INPUT, send: async () => "sent" as const }, words: null, editable: false }));
    await click(ready, t.prep.make);
    expect([...ready.querySelectorAll("button")].map((b) => b.textContent)).not.toContain(t.prep.send);
  });
});

describe("SaidPanel", () => {
  it("has loading, failed, empty and full states", async () => {
    const now = new Date("2026-11-22T10:00:00");
    expect((await mount(h(SaidPanel, { read: undefined, now }))).textContent).toContain(t.said.loading);
    const retry = vi.fn();
    const failed = await mount(h(SaidPanel, { read: null, now, onRetry: retry }));
    expect(failed.querySelector('[role="alert"]')?.textContent).toBe(t.said.unavailable);
    await click(failed, t.said.retry);
    expect(retry).toHaveBeenCalledOnce();
    expect((await mount(h(SaidPanel, { read: { ret: null, requests: [] }, now }))).textContent).toContain(t.said.empty);
    const ret = { documentId: "rad-a", comment: "Izmišljena napomena: dopunite zaključak.", revisionDueAt: "2026-11-25T22:59:59.000Z", createdAt: "2026-11-20T10:00:00.000Z" };
    const full = await mount(h(SaidPanel, { read: { ret, requests: [] }, now }));
    expect(full.querySelector("blockquote")?.textContent).toBe(ret.comment);
    expect(full.textContent).toContain("Rok dorade:");
  });
  it("MEN-R06: tells the caller only the open revisions the panel counts, and only while it is displayed", async () => {
    const now = new Date("2026-11-22T10:00:00");
    const rq = (n: number, state: string) => ({ id: `00000000-0000-4000-8000-00000000000${n}`, number: n, state, rowSeq: 1, anchor: {}, versions: [] });
    const shown = vi.fn();
    await mount(h(SaidPanel, { read: undefined, now, onShown: shown }));
    await mount(h(SaidPanel, { read: null, now, onShown: shown }));
    await mount(h(SaidPanel, { read: { ret: null, requests: [] }, now, onShown: shown }));
    // Every revision answered or closed and no return: the panel shows "empty", nothing is confirmed.
    await mount(h(SaidPanel, { read: { ret: null, requests: [rq(1, "responded"), rq(2, "closed")] as never }, now, onShown: shown }));
    // The right panel mounts every tab and hides the inactive ones: mounted but hidden is not seen.
    await mount(h("div", { hidden: true }, h(SaidPanel, { read: { ret: null, requests: [rq(3, "open")] as never }, now, onShown: shown })));
    expect(shown).not.toHaveBeenCalled();
    await mount(h(SaidPanel, { read: { ret: null, requests: [rq(4, "open"), rq(5, "reopened"), rq(6, "responded")] as never }, now, onShown: shown }));
    expect(shown).toHaveBeenCalledOnce();
    expect(shown.mock.calls[0]![0].map((r: { id: string }) => r.id)).toEqual([rq(4, "open").id, rq(5, "reopened").id]);
  });
});

describe("OwnPanel", () => {
  const note = h("p", null, "zamjena za poruku");
  it("says it is only the student's, and words each state of Dokle sam stao", async () => {
    const loading = await mount(h(OwnPanel, { documentId: "rad-a", reading: undefined, note }));
    expect(loading.textContent).toContain(t.own.intro);
    expect(loading.textContent).toContain(t.own.stopLoading);
    expect((await mount(h(OwnPanel, { documentId: "rad-a", reading: null, note }))).querySelector('[role="alert"]')?.textContent).toBe(t.own.stopUnavailable);
    expect((await mount(h(OwnPanel, { documentId: "rad-a", reading: { place: null, updatedAt: null }, note }))).textContent).toContain(t.own.stopNone);
  });
  it("sets the mark at the cursor and clears it, saying so only from the server's answer (#631 review 2)", async () => {
    const at = { nodeId: "00000000-0000-4000-8000-0000000000b2", offset: 7 };
    const set = vi.fn(async (place: typeof at) => ({ kind: "ok" as const, reading: { place, updatedAt: "2026-11-24T10:00:00.000Z" } }));
    const clear = vi.fn(async () => ({ kind: "ok" as const, reading: { place: null, updatedAt: null } }));
    const host = await mount(h(OwnPanel, { documentId: "rad-a", reading: { place: null, updatedAt: null }, mark: { set, clear }, currentPlace: () => at, note }));
    expect([...host.querySelectorAll("button")].map((b) => b.textContent)).not.toContain(t.own.stopClear);
    await click(host, t.own.stopSet);
    expect(set).toHaveBeenCalledWith(at);
    expect(host.textContent).toContain(t.own.stopSaved);
    expect(host.textContent).toMatch(/^.*Ovdje ste stali prošli put/);
    await click(host, t.own.stopClear);
    expect(clear).toHaveBeenCalledOnce();
    expect(host.textContent).toContain(t.own.stopCleared);
    expect(host.textContent).toContain(t.own.stopNone);
  });
  it("keeps the old mark and says why when the write fails, and asks for a cursor when there is none", async () => {
    const place = { nodeId: "00000000-0000-4000-8000-0000000000a1", offset: 4 };
    const set = vi.fn(async () => ({ kind: "failed" as const }));
    const host = await mount(h(OwnPanel, { documentId: "rad-a", reading: { place, updatedAt: "2026-11-20T10:00:00.000Z" },
      mark: { set, clear: async () => ({ kind: "signedOut" as const }) }, currentPlace: () => place, note }));
    await click(host, t.own.stopSet);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(t.own.stopFailed);
    expect(host.textContent).toContain("Ovdje ste stali prošli put");
    await click(host, t.own.stopClear);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(t.own.stopSignedOut);
    const none = await mount(h(OwnPanel, { documentId: "rad-a", reading: { place: null, updatedAt: null },
      mark: { set, clear: async () => ({ kind: "failed" as const }) }, currentPlace: () => null, note }));
    set.mockClear();
    await click(none, t.own.stopSet);
    expect(set).not.toHaveBeenCalled();
    expect(none.querySelector('[role="alert"]')?.textContent).toBe(t.own.stopNoPlace);
  });
  it("goes to the kept place, and says so when its paragraph is gone", async () => {
    const place = { nodeId: "00000000-0000-4000-8000-0000000000a1", offset: 4 };
    const go = vi.fn((_: typeof place) => false);
    const host = await mount(h(OwnPanel, { documentId: "rad-a", reading: { place, updatedAt: "2026-11-20T10:00:00.000Z" }, onGoToPlace: go, note }));
    await click(host, t.own.stopGo);
    expect(go).toHaveBeenCalledWith(place);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(t.own.stopGone);
  });
});
