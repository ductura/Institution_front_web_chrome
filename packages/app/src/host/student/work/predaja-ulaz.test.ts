// @vitest-environment jsdom
// WEB-NUZ-PREDAJA-1 (NF-3 PR-1, PR-2; NF-2 P-17): the way to the submission from the workspace, and the
// one source of "what is still missing" that the rehearsal, the top bar and step 3 share. Invented data.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceTopBarView } from "../../../../../../src/components/editor/WorkspaceTopBar.tsx";
import {
  atHr, beforeCountText, beforeSubmission, declarationText, opensSending, type GateState,
} from "../../../../../../src/components/editor/submission-rehearsal/declaration-gate.ts";
import { rehearsalMessagesHr as r } from "../../../../../../src/components/editor/submission-rehearsal/messages.hr.ts";
import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import type { StateRead } from "../submission/withdraw/contract";
import { opensOnArrival, WITHDRAW_HASH } from "../submission/withdraw/model";
import { SubmittedBanner } from "./frame";
import { workText } from "./messages.hr";

vi.mock("../../../../../../src/client/online-status.ts", () => ({ useOnline: () => true }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ID = "00000000-0000-4000-8000-0000000000b7";
const FORM = { formId: "test-izjava", formVersion: 1 };
const GATES: Record<string, GateState> = {
  loading: { kind: "loading" },
  unavailable: { kind: "unavailable" },
  notRequired: { kind: "not_required" },
  none: { kind: "missing", detail: "none", form: FORM },
  draft: { kind: "missing", detail: "draft", form: FORM },
  stale: { kind: "missing", detail: "stale", form: FORM },
  confirmed: { kind: "confirmed", detail: "confirmed", confirmedAt: "2026-11-20T10:00:00.000000Z", form: FORM },
  bound: { kind: "confirmed", detail: "bound", confirmedAt: "2026-11-20T10:00:00.000000Z", form: FORM },
};

describe("the declaration in words, one sentence per server state (PR-2)", () => {
  it("names each of the five states and never says confirmed for what the server would refuse", () => {
    expect(declarationText(GATES.none!)).toBe(r.declarationNone);
    expect(declarationText(GATES.draft!)).toBe(r.declarationDraft);
    expect(declarationText(GATES.stale!)).toBe(r.declarationStale);
    expect(declarationText(GATES.confirmed!)).toBe("Potvrđena 20. 11. 2026. u 11:00.");
    expect(declarationText(GATES.bound!)).toBe(r.declarationBound);
    expect(declarationText(GATES.notRequired!)).toBe(r.declarationNotRequired);
    expect(declarationText(GATES.loading!)).toBe(r.declarationChecking);
    expect(declarationText(GATES.unavailable!)).toBe(r.declarationUnavailable);
    for (const key of ["none", "draft", "stale", "loading", "unavailable"]) {
      expect({ key, opens: opensSending(GATES[key]!) }).toEqual({ key, opens: false });
      expect({ key, text: declarationText(GATES[key]!).startsWith("Potvrđena") }).toEqual({ key, text: false });
    }
  });

  it("writes the moment in the faculty's time zone, summer and winter", () => {
    expect(atHr("2026-11-20T10:00:00.000Z")).toBe("20. 11. 2026. u 11:00");
    expect(atHr("2026-07-01T10:05:00.000Z")).toBe("1. 7. 2026. u 12:05");
    expect(atHr("nije vrijeme")).toBeNull();
  });
});

describe("what is still missing (E-8a, P-17)", () => {
  it("counts an unconfirmed declaration as blocking and places in the text as not stopping the submission", () => {
    expect(beforeSubmission(GATES.confirmed!, 0)).toEqual({ items: [], count: 0 });
    expect(beforeSubmission(GATES.notRequired!, null)).toEqual({ items: [], count: 0 });
    const both = beforeSubmission(GATES.stale!, 2);
    expect(both.count).toBe(2);
    expect(both.items.map((i) => [i.id, i.blocks])).toEqual([["declaration", true], ["places", false]]);
    expect(both.items[1]!.text).toBe("Mjesta ostavljena za kasnije: 2 (ne zaustavljaju predaju).");
    // A read that has not answered or failed is not counted as a missing confirmation.
    expect(beforeSubmission(GATES.loading!, 1).count).toBe(1);
    expect(beforeSubmission(GATES.unavailable!, 0).count).toBe(0);
  });

  it("says the count as the prototype does", () => {
    expect(beforeCountText(1)).toBe("1 stvar prije predaje");
    expect(beforeCountText(2)).toBe("2 stvari prije predaje");
    expect(beforeCountText(5)).toBe("5 stvari prije predaje");
    expect(beforeCountText(21)).toBe("21 stvar prije predaje");
  });

  it("holds no forbidden term", () => {
    const texts: string[] = [...Object.values(r), ...Object.values(workText)].filter((v) => typeof v === "string");
    for (const text of texts) expect({ text, hits: findForbiddenTerms(text, "hr") }).toEqual({ text, hits: [] });
  });
});

describe("Predaja rada in the top bar (PR-1, P-17)", () => {
  const bar = (props: Record<string, unknown>) => renderToStaticMarkup(h(WorkspaceTopBarView, {
    assignmentId: ID, title: "Izmišljeni rad", online: true, theme: "light", onTheme: () => undefined, ...props,
  }));

  it("carries the count and reads it aloud with the whole name", () => {
    const html = bar({ before: 2 });
    expect(html).toContain(`href="/rad/${ID}/predaja"`);
    expect(html).toContain('aria-label="Predaja rada: 2 stvari prije predaje"');
    expect(html).toMatch(/aria-hidden="true">2<\/b>/);
    expect(html).toContain(">2 stvari prije predaje<");
  });

  it("has the short name for narrow screens and no count when nothing is left or it is not known", () => {
    for (const before of [0, null, undefined]) {
      const html = bar({ before });
      expect(html).toContain(`>${r.submitShort}<`);
      expect(html).not.toContain("prije predaje");
      expect(html).not.toContain("aria-label=\"Predaja rada:");
    }
  });

  it("keeps the whole name on a disabled button without a network", () => {
    const html = bar({ online: false, before: 3 });
    expect(html).toMatch(/<button[^>]*disabled[^>]*aria-label="Predaja rada"/);
    expect(html).not.toContain("/predaja");
  });
});

describe("the banner of a submitted work (E-7a, PR-1)", () => {
  let root: Root | null = null;
  afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });

  async function mount(read: () => Promise<StateRead>) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(SubmittedBanner, { assignmentId: ID, base: "", lead: "Predano 20. 11. 2026., 11:00.", read })); });
    await act(async () => { await new Promise((done) => setTimeout(done, 0)); });
    return host;
  }
  const links = (host: HTMLElement) => [...host.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
  const receipt = `/rad/${ID}/predaja/potvrda`;

  it("offers the receipt, and the withdrawal only on the server's word", async () => {
    const open = await mount(async () => ({ kind: "ready", state: { withdrawable: true, receipts: [] } }));
    expect(open.textContent).toContain(workText.submittedBody);
    expect(links(open)).toEqual([[workText.openReceipt, receipt], [workText.withdraw, `${receipt}#${WITHDRAW_HASH}`]]);
    act(() => root?.unmount());
    const closed = await mount(async () => ({ kind: "ready", state: { withdrawable: false, receipts: [] } }));
    expect(links(closed)).toEqual([[workText.openReceipt, receipt]]);
  });

  it("does not offer the withdrawal when the state cannot be read", async () => {
    const failed = await mount(async () => ({ kind: "nepoznato" }));
    expect(links(failed)).toEqual([[workText.openReceipt, receipt]]);
    act(() => root?.unmount());
    const rejected = await mount(() => Promise.reject(new TypeError("offline")));
    expect(links(rejected)).toEqual([[workText.openReceipt, receipt]]);
  });

  it("opens the confirmation on arrival only when asked and allowed", () => {
    expect(opensOnArrival(`#${WITHDRAW_HASH}`, { withdrawable: true, receipts: [] })).toBe(true);
    expect(opensOnArrival(`#${WITHDRAW_HASH}`, { withdrawable: false, receipts: [] })).toBe(false);
    expect(opensOnArrival("", { withdrawable: true, receipts: [] })).toBe(false);
  });
});
