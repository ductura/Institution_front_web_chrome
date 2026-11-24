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
    const host = await mount(h(PrepPanel, { port: { compose: async () => null, send: async () => "sent" }, words: null, editable: false }));
    await click(host, t.prep.make);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(t.prep.unavailable);
    const ready = await mount(h(PrepPanel, { port: { compose: async () => INPUT, send: async () => "sent" }, words: null, editable: false }));
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
});

describe("OwnPanel", () => {
  it("says it is only the student's, and that Dokle sam stao is not kept yet", async () => {
    const host = await mount(h(OwnPanel, { documentId: "rad-a", note: h("p", null, "zamjena za poruku") }));
    expect(host.textContent).toContain(t.own.intro);
    expect(host.textContent).toContain(t.own.stopUnavailable);
  });
});
