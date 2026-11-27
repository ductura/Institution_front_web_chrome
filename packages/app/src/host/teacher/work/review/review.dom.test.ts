// @vitest-environment jsdom
// WEB-NUZ-PG: "Pregled rada" as a teacher meets it, over stand-in reads. Invented work, student and course only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DeclarationPort } from "../../../../../../../src/client/declaration";
import { HostContext, type HostValue } from "../../../context";
import type { MatchCall } from "../../provenance/contract";
import type { MatchRead } from "../../provenance/match-model";
import type { ProvenanceCall } from "../../provenance/read";
import type { Outcome } from "./model";
import type { HeaderRead, ReviewReads } from "./read";
import type { ReviewExtras } from "./extras";
import ReviewPage from "./ReviewPage";
import { reviewMessages as t } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no modal dialog; the dialog only needs to be open.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

const HOST = { base: "/aplikacija", page: { path: "/nastavnik/rad/[id]/pregled" }, role: "teacher" } as unknown as HostValue;
const DOCUMENT = "rad-izmisljeni-b";
const READY: HeaderRead = { kind: "ready", header: {
  facts: { studentName: "Student A", assignmentId: "00000000-0000-4000-8000-0000000000a1", state: "nije_predano", previousId: "rad-izmisljeni-a", nextId: null, receipt: null },
  context: { course: "Kolegij A", title: "Lokalni mediji", workType: "essay", dueAt: "2026-11-30T22:59:00.000Z" },
  grade: "eligible",
} };
const SUMMARY = {
  summaryFormat: "ductus-process-summary-v1",
  sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 2, items: [] },
  pastes: { evidenceKind: "observed", listedAboveCharacters: 200, listed: [], smallerCount: 0 },
  gaps: { evidenceKind: "observed", items: [] },
  recordState: "complete",
} as const;
const ok = <T,>(value: T): Promise<Outcome<T>> => Promise.resolve({ kind: "ok", value });

function reads(over: Partial<ReviewReads> = {}): ReviewReads {
  return {
    header: async () => READY,
    summary: () => ok(SUMMARY as never),
    details: () => ok({ activeEditingMinutes: 40, keyEvents: [] }),
    thresholds: async () => ({ kind: "notFound" }),
    ...over,
  };
}

const QUIET: ReviewExtras = {
  composition: async () => ({ kind: "empty" }), disputes: async () => ({ kind: "ok", disputes: [] }),
  comments: async () => ({ kind: "ok", threads: [] }), drafts: async () => ({ kind: "ready", drafts: [] }), seen: async () => ({ kind: "ready", items: [] }),
};
const provenance: ProvenanceCall = async () => ({ kind: "noMarks" });
const DECLARATION: DeclarationPort = {
  readStudent: async () => ({ kind: "unavailable" }),
  confirm: async () => ({ kind: "unavailable" }),
  readTeacher: async () => ({
    kind: "ready", confirmedAt: "2026-11-20T10:00:00.000Z", assistantAllowed: true, uses: [], transfers: [], external: [],
    conversations: [{
      conversationId: "00000000-0000-4000-8000-0000000000c1", title: "Razgovor o strukturi", reason: "student_added",
      assistantName: "Izmišljeni Pružatelj, Model Z", throughSeq: 2,
      turns: [{ seq: 1, author: "student", text: "Izmišljeno pitanje." }, { seq: 2, author: "assistant", text: "Izmišljeni odgovor." }],
    }],
  }),
};

describe("WEB-NUZ-PG Pregled rada", () => {
  let root: Root | undefined;
  beforeEach(() => { window.history.replaceState(null, "", "/aplikacija/nastavnik/rad/rad-izmisljeni-b/pregled?kartica=sazetak"); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  const settle = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };
  const mount = async (given: ReviewReads, matchCall: MatchCall = async () => ({ kind: "none" })) => {
    const el = document.createElement("div");
    document.body.append(el);
    root = createRoot(el);
    await act(async () => {
      root!.render(h(HostContext.Provider, { value: HOST },
        h(ReviewPage, { documentId: DOCUMENT, reads: given, matchCall, extras: QUIET, provenanceCall: provenance, declarationPort: DECLARATION })));
    });
    await settle();
    return el;
  };

  it("PG-1/PG-10: shows the context header, the grade in Merlin and Studomat and the tab from the address", async () => {
    const el = await mount(reads());
    expect(el.querySelector("[data-review-context]")?.textContent).toBe("Kolegij A · zadatak „Lokalni mediji”");
    expect(el.querySelector("h1")?.textContent).toBe("Student A · Esej „Lokalni mediji”");
    expect(el.querySelector("[data-review-state]")?.textContent).toContain("rok 30. studenoga 2026.");
    expect(el.querySelector("[data-review-grade]")?.textContent).toContain(t.gradeExternal);
    const tabs = [...el.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).toEqual([t.tabText, t.tabSummary, t.tabOrigin, t.tabReplay, t.tabCompare, t.tabDeclaration]);
    expect(el.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe(t.tabSummary);
    expect(el.querySelector('a[data-step="prev"]')?.getAttribute("href")).toBe("/aplikacija/nastavnik/rad/rad-izmisljeni-a/pregled?kartica=sazetak");
    expect(el.textContent).toContain(t.next);
    expect(el.querySelector('a[data-step="next"]')).toBeNull();
    expect(el.textContent).toContain(t.backToTask);
  });

  it("PG-1: another tab goes into the address and into the previous work's link", async () => {
    const el = await mount(reads());
    const declaration = [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => b.textContent === t.tabDeclaration)!;
    await act(async () => { declaration.click(); });
    expect(window.location.search).toBe("?kartica=izjava");
    expect(el.querySelector('a[data-step="prev"]')?.getAttribute("href")).toBe("/aplikacija/nastavnik/rad/rad-izmisljeni-a/pregled?kartica=izjava");
  });

  it("PG-4: a part the server does not give has no retry; a failed part says it and recovers", async () => {
    let fail = true;
    const matchCall: MatchCall = async (): Promise<MatchRead> => (fail ? { kind: "unavailable" }
      : { kind: "ready", percent: 4, findings: [{ segmentRef: "s1", conversationId: "00000000-0000-4000-8000-0000000000c1",
        messageId: "00000000-0000-4000-8000-0000000000f1", runWords: 12, recordedAt: "2026-11-01T10:00:00.000Z", attachedAt: "2026-11-02T10:00:00.000Z" }] });
    const el = await mount(reads(), matchCall);
    const rules = el.querySelector('[data-part="pg-rules"]')!;
    expect(rules.getAttribute("data-state")).toBe("notGiven");
    expect(rules.textContent).toContain(t.notGiven);
    expect(rules.querySelector("button")).toBeNull();
    const match = el.querySelector('[data-part="pg-match"]')!;
    expect(match.querySelector('[role="alert"]')?.textContent).toBe(t.partError(t.matchHeading));
    expect(el.querySelector('[data-part="pg-record"]')?.textContent).toContain(t.recordComplete);
    expect(el.querySelector('[data-part="pg-rhythm"]')).toBeNull();
    fail = false;
    await act(async () => { match.querySelector("button")!.click(); });
    await settle();
    const again = el.querySelector('[data-part="pg-match"]')!;
    expect(again.getAttribute("data-state")).toBe("ready");
    expect(again.textContent).toContain("4 % · nije dokaz autorstva");
    expect(el.querySelector('[data-part="pg-assistant"]')?.textContent).toContain(`${t.assistantConversations}1`);
  });

  it("PG-14: a conversation names the Asistent, never the provider or model", async () => {
    const el = await mount(reads());
    const open = [...el.querySelectorAll("button")].find((b) => b.textContent === "Pregledaj razgovor")!;
    await act(async () => { open.click(); });
    expect(document.body.textContent).toContain("Asistent");
    expect(document.body.textContent).not.toContain("Model Z");
  });

  it("an unavailable header says so and reads again on retry", async () => {
    let answer: HeaderRead = { kind: "unavailable" };
    const el = await mount(reads({ header: async () => answer }));
    expect(el.querySelector('[role="alert"]')?.textContent).toBe(t.error);
    answer = READY;
    await act(async () => { el.querySelector("button")!.click(); });
    await settle();
    expect(el.querySelector("h1")?.textContent).toBe("Student A · Esej „Lokalni mediji”");
  });
});
