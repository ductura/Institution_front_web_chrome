// @vitest-environment jsdom
// INT-21: the labels "vraćeno iz verzije N" of RestoreHost, mounted the way VersionHistory.test.ts does.
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fakeTimeMachinePort } from "../../time-machine/fake-port";
import type { TimeMachinePort } from "../../time-machine/model";
import { restoreMessages as text } from "./messages.hr";
import type { RestoreOutcome, RestorePort } from "./model";
import RestoreHost from "./RestoreHost";

// The page's editor is not needed: every test passes its own port.
vi.mock("./restore-editor", () => ({ useRestoreEditor: () => ({}) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
afterEach(() => { host?.remove(); host = null; });

type Receipt = "confirmed" | "signedOut" | "waiting";

/** A port whose restore answers `outcome` and whose receipts the test settles one by one. */
function controlledPort(outcome: RestoreOutcome) {
  const asks: ((answer: Receipt) => void)[] = [];
  const port: RestorePort = {
    restore: async () => outcome,
    receipt: () => new Promise<Receipt>((resolve) => { asks.push(resolve); }),
  };
  return { port, asks };
}

async function mount(port: RestorePort, history: Pick<TimeMachinePort, "versions"> = fakeTimeMachinePort()) {
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(RestoreHost, { documentId: "rad-1", history, port })); });
  return host;
}

async function restore(el: HTMLElement, revision: number) {
  const select = el.querySelector("select")!;
  await act(async () => {
    select.value = String(revision);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const button = (label: string) => [...el.querySelectorAll("button")].find((b) => b.textContent === label)!;
  await act(async () => { button(text.action).click(); });
  await act(async () => { button(text.confirm).click(); });
}

const labels = (el: HTMLElement) =>
  [...el.querySelectorAll("li[data-restored-from]")].map((li) => [li.getAttribute("data-confirmed"), li.textContent]);

describe("restore labels (INT-21)", () => {
  it("keeps the label when the list cannot be read again", async () => {
    let reads = 0;
    const history = {
      versions: async () => (reads++ === 0
        ? fakeTimeMachinePort().versions("rad-1")
        : { kind: "unavailable" as const }),
    };
    const el = await mount(controlledPort({ kind: "saved" }).port, history);
    await restore(el, 1);
    expect(reads).toBe(2);
    expect(el.querySelector("select")).toBeNull();
    expect(labels(el)).toEqual([["true", text.restoredVersion(1)]]);
  });

  it("turns only that restore's label confirmed when its receipt comes, and says so in the status area", async () => {
    const { port, asks } = controlledPort({ kind: "pending" });
    const el = await mount(port);
    await restore(el, 1);
    expect(el.querySelector("[role=status]")?.textContent).toBe(text.pending);
    await restore(el, 2);
    expect(asks).toHaveLength(2);
    expect(labels(el)).toEqual([["false", text.restoredPending(1)], ["false", text.restoredPending(2)]]);

    await act(async () => { asks[0]!("confirmed"); });
    await act(async () => { asks[1]!("waiting"); });
    expect(labels(el)).toEqual([["true", text.restoredVersion(1)], ["false", text.restoredPending(2)]]);
    expect([...el.querySelectorAll("[role=status]")].map((s) => s.textContent)).toContain(text.confirmedLater(1));
    expect(el.textContent).not.toContain(text.pending);
    // "waiting" asks again; the second label stays pending meanwhile.
    expect(asks).toHaveLength(3);
  });

  it("keeps the label waiting on 'waiting' and on a sign-out", async () => {
    const { port, asks } = controlledPort({ kind: "pending" });
    const el = await mount(port);
    await restore(el, 1);
    await act(async () => { asks[0]!("waiting"); });
    expect(asks).toHaveLength(2);
    expect(labels(el)).toEqual([["false", text.restoredPending(1)]]);
    await act(async () => { asks[1]!("signedOut"); });
    expect(asks).toHaveLength(2);
    expect(labels(el)).toEqual([["false", text.restoredPending(1)]]);
  });
});
