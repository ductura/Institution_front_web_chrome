// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProcessSummaryV1 } from "../../../../../../../src/client/process-summary.ts";
import SummaryPanel, { type SummaryPanelProps } from "./SummaryPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SUMMARY: ProcessSummaryV1 = {
  summaryFormat: "ductus-process-summary-v1",
  sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 0, items: [] },
  pastes: { evidenceKind: "observed", listedAboveCharacters: 200, smallerCount: 0, listed: [] },
  gaps: { evidenceKind: "observed", items: [] }, recordState: "complete",
};
const base: SummaryPanelProps = {
  summary: { kind: "ready", summary: SUMMARY }, notes: { kind: "ready", notes: [] }, submitted: false, confirmed: true, online: true,
  workHref: "/rad/a-1", onRetry: () => undefined, onAddNote: async () => ({ kind: "unavailable" }) as never, onNoteAdded: () => undefined,
  assignmentId: "izmisljen-zadatak-1", disputes: { port: { list: async () => ({ kind: "ready", disputes: [] }), add: async () => ({ kind: "unavailable" }) } as never, documentId: "izmisljeni-rad-1" },
};
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("process summary extras in the panel (F4-PRE-R04)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; vi.unstubAllGlobals(); });

  it("reads the declaration again, and only it, when the declaration key changes", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) => { urls.push(String(url)); return json({}); }));
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(SummaryPanel, { ...base, declarationKey: 1 })); });
    const declaration = () => urls.filter((u) => u.endsWith("/declaration")).length;
    const before = urls.length;
    expect(declaration()).toBe(1);
    await act(async () => { root?.render(h(SummaryPanel, { ...base, declarationKey: 1 })); });
    expect(declaration()).toBe(1);
    await act(async () => { root?.render(h(SummaryPanel, { ...base, declarationKey: 2 })); });
    expect(declaration()).toBe(2);
    expect(urls.length - before).toBe(1);
  });
});
