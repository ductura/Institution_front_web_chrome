// @vitest-environment jsdom
// NF2-P21: the recovery offer is a status region that exists before its text, so a screen reader
// announces the offer when it comes, and the region stays (empty) when there is nothing or it is hidden.
// The journal scope, the session watch and the device copies are fakes; every text is invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const copies = vi.hoisted(() => ({ list: [] as { key: string; copy: { assignmentId: string; at: number; text: string | null } }[] }));

vi.mock("@/components/editor/EditorPage.scope", () => ({
  readJournalScope: async () => ({ kind: "scope", scope: "s-1", session: { tag: "t-1", at: 1 } }),
}));
vi.mock("@/client/session-end", () => ({ watchSessionEnd: () => ({ ended: () => false, close: () => {} }) }));
vi.mock("@/components/shell/SessionObserver", () => ({ default: () => null }));
vi.mock("@/client/session-marks", async (real) => ({ ...(await real<object>()), hasEnded: () => false }));
vi.mock("./recovery", () => ({
  copyStorage: () => ({}) as Storage,
  hasExitCopies: () => copies.list.length > 0,
  readExitCopies: () => copies.list,
}));

import { RecoveryOffer } from "./RecoveryOffer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("RecoveryOffer", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; copies.list = []; });

  const mount = async () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(RecoveryOffer, { base: "/aplikacija" as never })); });
    return host;
  };
  const region = (host: HTMLElement) => host.querySelector<HTMLElement>("[data-recovery-offer]");

  it("draws an empty status region when the device keeps no copy", async () => {
    const host = await mount();
    expect(region(host)?.getAttribute("role")).toBe("status");
    expect(region(host)?.textContent).toBe("");
    expect(region(host)?.className).toBe("");
  });

  it("fills the same region with the offer, and empties it again when hidden", async () => {
    copies.list = [{ key: "k-1", copy: { assignmentId: "a-1", at: Date.UTC(2026, 10, 25, 9), text: "Izmišljeni tekst." } }];
    const host = await mount();
    const status = region(host)!;
    expect(status.getAttribute("role")).toBe("status");
    expect(status.textContent).toContain("Na ovom uređaju čuva se Vaš tekst od prethodne odjave.");
    expect(status.querySelector("a")?.getAttribute("href")).toBe("/aplikacija/rad/a-1");
    expect(host.querySelectorAll('[role="status"]')).toHaveLength(1);
    const hide = [...status.querySelectorAll("button")].find((b) => b.textContent === "Sakrij obavijest")!;
    await act(async () => { hide.click(); });
    expect(region(host)).toBe(status);
    expect(status.textContent).toBe("");
  });
});
