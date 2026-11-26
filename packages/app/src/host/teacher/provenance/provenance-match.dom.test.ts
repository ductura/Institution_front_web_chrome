// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import ProvenanceMap from "./ProvenanceMap";
import { DOCUMENT, FAKE_FINDING, fakeMatchCall } from "./fake-match";
import type { MatchRead } from "./match-model";
import type { ProvenanceCall } from "./read";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const marked: ProvenanceCall = async () => ({ kind: "marked" });

// PIL-P1-PODUDARANJE-KARTA: the mounted map reads the match through its port and draws the section in place.
describe("Karta podrijetla with the assistant match", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  const mount = async (read: MatchRead) => {
    const { call, calls } = fakeMatchCall(read);
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(ProvenanceMap, { documentId: DOCUMENT, call: marked, matchCall: call, textCall: async () => ({ kind: "noRanges" as const }) })); });
    return { host, calls };
  };

  it("flag on: the share and the attached conversation are in the map", async () => {
    const { host, calls } = await mount({ kind: "ready", percent: 4, findings: [FAKE_FINDING] });
    expect(calls).toEqual([DOCUMENT]);
    const section = host.querySelector('[data-assistant-match="ready"]');
    expect(section?.textContent).toContain("Podudara se s odgovorom pomoćnika · 4 %");
    expect(section?.querySelectorAll("tbody tr")).toHaveLength(1);
  });

  it("flag off: the section does not exist", async () => {
    const { host } = await mount({ kind: "none" });
    expect(host.querySelector("[data-assistant-match]")).toBeNull();
    expect(host.textContent).not.toContain("Podudara se s odgovorom pomoćnika");
    expect(host.querySelector("[data-legend]")).not.toBeNull();
  });
});
