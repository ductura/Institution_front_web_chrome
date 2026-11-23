// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { DOCUMENT, FAKE_FINDING, fakeMatchCall } from "../../../teacher/provenance/fake-match";
import type { MatchRead } from "../../../teacher/provenance/match-model";
import type { OriginRead } from "../../../teacher/provenance/origin";
import { OriginBody } from "./OriginBody";
import { readOfParts } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LABEL = "Podudara se s odgovorom pomoćnika";
// Invented composition of the student's own work: 96 % typed, 4 % matching an answer of the assistant.
const parts = (match: number) => ["typed", "assistant_inserted", "assistant_match", "imported_file", "pasted_known", "pasted_unknown"]
  .map((kind) => ({ kind, percent: kind === "typed" ? 100 - match : kind === "assistant_match" ? match : 0 }));

// PIL-P1-PODUDARANJE-KARTA (P-1 rule 2.2): the student's /rad/<id>/podrijetlo draws the same section as the teacher's map.
describe("student's Podrijetlo teksta with the assistant match", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  const mount = async (read: OriginRead | null, match: MatchRead) => {
    const { call, calls } = fakeMatchCall(match);
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(OriginBody, { read, onRetry: () => {}, documentId: DOCUMENT, matchCall: call })); });
    return { host, calls, section: host.querySelector('[data-assistant-match="ready"]') };
  };

  it("composition ready, match found: the share once and the attached conversation, under an h2", async () => {
    const { host, calls, section } = await mount(readOfParts(parts(4)), { kind: "ready", percent: 4, findings: [FAKE_FINDING] });
    expect(calls).toEqual([DOCUMENT]);
    expect(host.textContent?.split(`${LABEL} · 4 %`)).toHaveLength(2);
    expect(section?.querySelector("[data-assistant-match-share]")).toBeNull();
    expect(section?.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(section?.querySelector("h2")).not.toBeNull();
  });

  it("flag off (match none): the section does not exist", async () => {
    const { host, section } = await mount(readOfParts(parts(0)), { kind: "none" });
    expect(section).toBeNull();
    expect(host.querySelector("[data-assistant-match]")).toBeNull();
    expect(host.textContent).not.toContain(LABEL);
  });

  it("composition empty: a finding without a share is shown, as in the teacher's map", async () => {
    const empty = readOfParts(parts(0).map((p) => ({ ...p, percent: 0 })));
    expect(empty).toEqual({ kind: "empty" });
    const { section } = await mount(empty, { kind: "ready", percent: 0, findings: [FAKE_FINDING] });
    expect(section?.querySelector("[data-assistant-match-share]")?.textContent).toBe(LABEL);
    expect(section?.textContent).not.toContain("%");
  });

  it("composition unavailable or not read yet: no section and no read of the match", async () => {
    for (const read of [null, { kind: "unavailable" }, { kind: "notFound" }, { kind: "signedOut" }] as const) {
      const { host, calls } = await mount(read, { kind: "ready", percent: 4, findings: [FAKE_FINDING] });
      expect(host.querySelector("[data-assistant-match]")).toBeNull();
      expect(calls).toEqual([]);
      act(() => root?.unmount()); document.body.innerHTML = "";
    }
  });
});
