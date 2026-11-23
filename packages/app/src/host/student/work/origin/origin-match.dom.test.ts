// @vitest-environment jsdom
// PIL-P1-PODUDARANJE-KARTA, the student's side of acceptance 1 (P-1 rule 2.2): on /rad/<id>/podrijetlo the student
// sees the same assistant match section as the teacher's map, on the same condition. The page runs as in the
// browser (react-dom/client, effects) with fake ports; the work's document is fixed. Invented data only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PAGES, type Page } from "../../../../routes";
import { HostContext } from "../../../context";
import { DOCUMENT, FAKE_FINDING, fakeMatchCall, fakeParts } from "../../../teacher/provenance/fake-match";
import type { MatchRead } from "../../../teacher/provenance/match-model";
import type { OriginRead } from "../../../teacher/provenance/origin";
import { readOfParts } from "./model";
import OriginPage from "./OriginPage";
import type { OriginReadCall } from "./read";

vi.mock("../../other", () => ({
  useWorkDocument: () => ({ kind: "document", assignmentId: "izmisljeni-zadatak-1", documentId: "izmisljeni-rad-1" }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LABEL = "Podudara se s odgovorom pomoćnika";
const page = PAGES.find((p) => p.path === "/rad/[assignmentId]/podrijetlo") as Page;
const count = (text: string, part: string) => text.split(part).length - 1;

describe("Podrijetlo teksta of the student with the assistant match", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  const mount = async (origin: OriginRead, match: MatchRead) => {
    const { call: matchCall, calls } = fakeMatchCall(match);
    const call: OriginReadCall = async () => origin;
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(h(HostContext.Provider, { value: { base: "/app/web", page, role: "student" } },
        h(OriginPage, { assignmentId: "izmisljeni-zadatak-1", call, matchCall })));
    });
    await act(async () => { await new Promise((done) => setTimeout(done, 0)); });
    return { host, calls };
  };

  it("flag on: the share and the attached conversation are on the page, the share once, under an h2", async () => {
    const { host, calls } = await mount(readOfParts(fakeParts(4)), { kind: "ready", percent: 4, findings: [FAKE_FINDING] });
    expect(calls).toEqual([DOCUMENT]);
    const section = host.querySelector('[data-assistant-match="ready"]');
    expect(section?.textContent).toContain(`${LABEL} · 4 %`);
    expect(section?.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(section?.querySelector("h2")?.id).toBe("assistant-match-h");
    expect(count(host.textContent ?? "", LABEL)).toBe(1);
    expect(host.querySelector('[data-kind="typed"]')).not.toBeNull();
    expect(section?.textContent?.toLowerCase()).not.toContain("student");
  });

  it("flag off: the section does not exist", async () => {
    const { host, calls } = await mount(readOfParts(fakeParts(0)), { kind: "none" });
    expect(calls).toEqual([DOCUMENT]);
    expect(host.querySelector("[data-assistant-match]")).toBeNull();
    expect(host.textContent).not.toContain(LABEL);
    expect(host.querySelector('[data-kind="typed"]')).not.toBeNull();
  });

  it("an empty composition still shows a finding, as the teacher's map does with noMarks", async () => {
    const { host } = await mount({ kind: "empty" }, { kind: "ready", percent: 0, findings: [FAKE_FINDING] });
    const section = host.querySelector('[data-assistant-match="ready"]');
    expect(section?.querySelectorAll("tbody tr")).toHaveLength(1);
  });

  it("no section while the composition is not read", async () => {
    const { host, calls } = await mount({ kind: "unavailable" }, { kind: "ready", percent: 4, findings: [FAKE_FINDING] });
    expect(calls).toEqual([]);
    expect(host.querySelector("[data-assistant-match]")).toBeNull();
  });
});
