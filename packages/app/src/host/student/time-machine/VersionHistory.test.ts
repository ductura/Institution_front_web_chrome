// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { FAKE_VERSIONS, fakeTimeMachinePort } from "./fake-port";
import type { TimeMachinePort } from "./model";
import { timeMachineMessages as text } from "./messages.hr";
import VersionHistory from "./VersionHistory";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
afterEach(() => { host?.remove(); host = null; });

async function mount(port = fakeTimeMachinePort()) {
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(VersionHistory, { documentId: "rad-1", port })); });
  return host;
}

describe("Povijest dokumenta (PIL-D7-POVIJEST)", () => {
  it("lists the versions newest first and shows the chosen one's text, read only", async () => {
    const el = await mount();
    const buttons = [...el.querySelectorAll("li button")];
    expect(buttons.map((b) => b.textContent)).toEqual([
      expect.stringContaining("Verzija 3"), expect.stringContaining("Predaja 2"), expect.stringContaining("Verzija 1"),
    ]);
    await act(async () => { (buttons[1] as HTMLButtonElement).click(); });
    const article = el.querySelector("[data-version-text='2']")!;
    expect(article.textContent).toContain("Izmišljeni odlomak verzije 2.");
    expect(article.textContent).toContain(text.historyReadOnly);
    expect(buttons[1]!.getAttribute("aria-current")).toBe("true");
    expect(buttons[1]!.hasAttribute("aria-pressed")).toBe(false);
    expect(buttons[0]!.hasAttribute("aria-current")).toBe(false);
    expect(el.querySelectorAll("input, textarea, select, [contenteditable]")).toHaveLength(0);
  });

  it("says so when the work has no saved version", async () => {
    const el = await mount(fakeTimeMachinePort([]));
    expect(el.textContent).toContain(text.historyEmpty);
    expect(el.querySelectorAll("li")).toHaveLength(0);
  });

  it("offers a retry when the versions cannot be read", async () => {
    const port = { ...fakeTimeMachinePort(), versions: async () => ({ kind: "unavailable" as const }) };
    const el = await mount(port);
    expect(el.querySelector("[role=alert]")?.textContent).toBe(text.unavailable);
    expect(el.textContent).toContain(text.retry);
  });

  it("says the session ended when the list needs a sign-in", async () => {
    const port = { ...fakeTimeMachinePort(), versions: async () => ({ kind: "signedOut" as const }) };
    const el = await mount(port);
    expect(el.querySelector("[role=alert]")?.textContent).toBe(text.signedOut);
    expect(el.querySelectorAll("li")).toHaveLength(0);
  });

  it("names that older versions exist when the server holds more than one page", async () => {
    const more = { ...fakeTimeMachinePort(), versions: async () => ({ kind: "ready" as const, versions: FAKE_VERSIONS, more: true }) };
    expect((await mount(more)).querySelector("[data-older-versions]")?.textContent).toBe(text.historyOlder);
    host?.remove();
    expect((await mount()).querySelector("[data-older-versions]")).toBeNull();
  });

  const state = (el: HTMLElement) => el.querySelector("[data-version-state]")!;
  const click = async (el: HTMLElement, index: number) => { await act(async () => { (el.querySelectorAll("li button")[index] as HTMLButtonElement).click(); }); };
  const withVersion = (read: TimeMachinePort["version"]) => ({ ...fakeTimeMachinePort(), version: read });

  it("announces only the state; the version's own text is outside the live region and nothing is nested in it", async () => {
    const el = await mount();
    await click(el, 1);
    expect(state(el).getAttribute("role")).toBe("status");
    expect(state(el).textContent).toBe(text.historyShown(`${text.submission} 2 · ${state(el).textContent!.split(" · ").slice(1).join(" · ")}`));
    expect(state(el).textContent).not.toContain("Izmišljeni odlomak");
    expect(state(el).querySelector("[role], [aria-live]")).toBeNull();
    expect(el.querySelectorAll("[aria-live] [role=alert], [aria-live] [role=status], [role=status] [role=alert], [role=status] [role=status]")).toHaveLength(0);
    expect(el.querySelector("article")!.closest("[role=status], [aria-live]")).toBeNull();
  });

  it("when the text cannot be read, the state says so and no text is shown", async () => {
    const el = await mount(withVersion(async () => ({ kind: "unavailable" })));
    await click(el, 0);
    expect(state(el).textContent).toBe(text.historyTextFailed);
    expect(el.querySelector("article")).toBeNull();
    const thrown = await mount(withVersion(async () => { throw new Error("offline"); }));
    await click(thrown, 0);
    expect(state(thrown).textContent).toBe(text.historyTextFailed);
  });

  it("a version read that needs a sign-in says the session ended", async () => {
    const el = await mount(withVersion(async () => ({ kind: "signedOut" })));
    await click(el, 0);
    expect(state(el).textContent).toBe(text.signedOut);
  });

  it("a document that is not a document is unreadable, never shown in part", async () => {
    const el = await mount(withVersion(async (_id, revision) => ({ kind: "ready" as const, revision, document: "{\"nodes\": 5}" })));
    await click(el, 0);
    expect(state(el).textContent).toBe(text.historyUnreadable);
    expect(el.querySelector("article")).toBeNull();
  });

  it("an answer that arrives late never replaces the version chosen after it", async () => {
    const waiting = new Map<number, (read: Awaited<ReturnType<TimeMachinePort["version"]>>) => void>();
    const port = withVersion((_id, revision) => new Promise((resolve) => { waiting.set(revision, resolve); }));
    const el = await mount(port);
    const doc = (revision: number) => ({ kind: "ready" as const, revision, document: JSON.stringify({ nodes: [{ type: "paragraph", children: [{ type: "text", text: `Tekst ${revision}` }] }] }) });
    await click(el, 0); // revision 3
    await click(el, 2); // revision 1, chosen after
    await act(async () => { waiting.get(1)!(doc(1)); });
    await act(async () => { waiting.get(3)!(doc(3)); }); // the older request answers last
    expect(el.querySelector("[data-version-text]")!.getAttribute("data-version-text")).toBe("1");
    expect(el.textContent).toContain("Tekst 1");
    expect(el.textContent).not.toContain("Tekst 3");
    expect(el.querySelectorAll("li button")[2]!.getAttribute("aria-current")).toBe("true");
  });

  it("keeps the version's headings below the panel's: level 1 to 3 are h4 to h6", async () => {
    const document = JSON.stringify({ nodes: [
      { type: "heading", level: 1, children: [{ type: "text", text: "Prvi" }] },
      { type: "heading", level: 2, children: [{ type: "text", text: "Drugi" }] },
      { type: "heading", level: 3, children: [{ type: "text", text: "Treći" }] },
    ] });
    const el = await mount(withVersion(async (_id, revision) => ({ kind: "ready" as const, revision, document })));
    await click(el, 0);
    expect([...el.querySelectorAll("article h4, article h5, article h6")].map((h) => `${h.tagName}:${h.textContent}`)).toEqual(["H4:Prvi", "H5:Drugi", "H6:Treći"]);
  });
});
