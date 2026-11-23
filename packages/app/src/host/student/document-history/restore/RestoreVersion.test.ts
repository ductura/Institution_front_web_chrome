// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FAKE_VERSIONS } from "../../time-machine/fake-port";
import { restoreMessages as text } from "./messages.hr";
import type { RestoreOutcome, RestorePort } from "./model";
import RestoreVersion from "./RestoreVersion";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
afterEach(() => { host?.remove(); host = null; });

/** A port whose answer the test gives when it chooses, so a restore can stay "running". */
function slowPort() {
  let finish: (outcome: RestoreOutcome) => void = () => undefined;
  const restore = vi.fn<RestorePort["restore"]>(() => new Promise<RestoreOutcome>((resolve) => { finish = resolve; }));
  return { port: { restore } as RestorePort, restore, finish: (outcome: RestoreOutcome) => finish(outcome) };
}

async function mount(port: RestorePort, onRestored?: () => void) {
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(RestoreVersion, { documentId: "rad-1", versions: FAKE_VERSIONS, port, onRestored })); });
  return host;
}

const button = (el: HTMLElement, label: string) => [...el.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement;
async function pick(el: HTMLElement, revision: string) {
  const select = el.querySelector("select")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, revision);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("RestoreVersion: one restore at a time (PIL-D7-OBNOVA)", () => {
  it("a second click on confirm before the next render never reaches the port", async () => {
    const { port, restore, finish } = slowPort();
    const onRestored = vi.fn();
    const el = await mount(port, onRestored);
    await pick(el, "1");
    await act(async () => { button(el, text.action).click(); });
    const confirm = button(el, text.confirm);
    // Both clicks run in one act: the second sees the render before `busy` was set, so only the ref stops it.
    await act(async () => { confirm.click(); confirm.click(); });
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith("rad-1", 1, 3);
    expect(el.querySelector("select")!.disabled).toBe(true);
    expect(button(el, text.action).disabled).toBe(true);
    expect(el.textContent).toContain(text.restoring);
    await act(async () => { finish({ kind: "saved" }); });
    expect(el.textContent).toContain(text.done(1));
    expect(onRestored).toHaveBeenCalledTimes(1);
    expect(onRestored).toHaveBeenCalledWith();
  });

  it("the retry button is disabled while a retry runs and the port is asked once", async () => {
    const { port, restore, finish } = slowPort();
    const onRecorded = vi.fn();
    host = document.createElement("div");
    document.body.append(host);
    await act(async () => { createRoot(host!).render(createElement(RestoreVersion, { documentId: "rad-1", versions: FAKE_VERSIONS, port, onRecorded })); });
    const el = host;
    await pick(el, "2");
    await act(async () => { button(el, text.action).click(); });
    await act(async () => { button(el, text.confirm).click(); });
    await act(async () => { finish({ kind: "unavailable" }); });
    expect(el.querySelector("[role=alert]")?.textContent).toBe(text.unavailable);
    const retry = button(el, text.retry);
    await act(async () => { retry.click(); retry.click(); });
    expect(restore).toHaveBeenCalledTimes(2);
    expect(button(el, text.retry)?.disabled ?? true).toBe(true);
    await act(async () => { finish({ kind: "pending" }); });
    // The label is RestoreHost's now (INT-21): the pending restore reaches it once.
    expect(onRecorded.mock.calls).toEqual([[2, false]]);
  });

  it("a stale answer asks the caller to read the list again", async () => {
    const onStale = vi.fn();
    host = document.createElement("div");
    document.body.append(host);
    const port: RestorePort = { restore: async () => ({ kind: "stale", currentRevision: 4 }) };
    await act(async () => { createRoot(host!).render(createElement(RestoreVersion, { documentId: "rad-1", versions: FAKE_VERSIONS, port, onStale })); });
    await pick(host, "1");
    await act(async () => { button(host!, text.action).click(); });
    await act(async () => { button(host!, text.confirm).click(); });
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(host.querySelector("[role=alert]")?.textContent).toBe(text.stale);
  });
});
