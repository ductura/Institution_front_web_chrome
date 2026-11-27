// @vitest-environment jsdom
// NF-5 PG-3, PG-5, PG-7, PG-9 inside "Pregled rada", over stand-in reads. Invented work, student and texts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { readOfParts } from "../../../student/work/origin/model";
import type { ReviewExtras } from "./extras";
import { Composition, Given, Notes, Places } from "./PgSections";
import type { Outcome } from "./model";
import type { ReviewReads } from "./read";
import { forbiddenInReview } from "./forbidden";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOC = "rad-izmisljeni-b";
const ok = <T,>(value: T): Promise<Outcome<T>> => Promise.resolve({ kind: "ok", value });
const SUMMARY = {
  summaryFormat: "ductus-process-summary-v1",
  sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 0, items: [] },
  pastes: { evidenceKind: "observed", listedAboveCharacters: 200, smallerCount: 0, listed: [
    { at: { from: "2026-11-10T09:40:00.000Z", to: "2026-11-10T09:40:00.000Z" }, characters: 420, origin: "not_observed" },
  ] },
  gaps: { evidenceKind: "observed", items: [] },
  recordState: "complete",
} as never;
const extras = (over: Partial<ReviewExtras> = {}): ReviewExtras => ({
  composition: async () => readOfParts([{ kind: "typed", percent: 80 }, { kind: "assistant_inserted", percent: 6 }, { kind: "assistant_match", percent: 8 }, { kind: "pasted_unknown", percent: 6 }]),
  disputes: async () => ({ kind: "ok", disputes: [{ id: "n1", eventId: "e1", kind: "dispute", text: "Izmišljeno objašnjenje studenta.", createdWindow: "2026-11-11T10:00:00.000Z" }] }),
  comments: async () => ({ kind: "ok", threads: [{ id: "t1", number: 1, state: "open", anchor: null, revision: 1, comments: [
    { id: "c1", role: "teacher", isOwn: true, body: "Izmišljen komentar.", createdWindow: "2026-11-12T10:00:00.000Z", deletedWindow: null }] }] }),
  drafts: async () => ({ kind: "ready", drafts: [{ id: "d1", body: "Izmišljen nacrt.", state: "draft", savedAt: "2026-11-12T12:00:00.000Z" }] }),
  seen: async () => ({ kind: "ready", items: [{ kind: "comment", id: "c1", firstSeenAt: "2026-11-12T11:00:00.000Z" }] }),
  ...over,
});

describe("NF-5 sections of Pregled rada", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const settle = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };
  const mount = async (node: ReturnType<typeof h>) => {
    const el = document.createElement("div");
    document.body.append(el);
    root = createRoot(el);
    await act(async () => { root!.render(node); });
    await settle();
    return el;
  };

  it("PG-3: every share has its own meaning, its negation and „nije dokaz autorstva”; the help is closed", async () => {
    const el = await mount(h(Composition, { documentId: DOC, extras: extras() }));
    const rows = [...el.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.textContent!.includes("nije dokaz autorstva"))).toBe(true);
    expect(el.textContent).toContain("Što znači");
    expect(el.textContent).toContain("Što ne znači");
    expect(el.querySelector("details")?.hasAttribute("open")).toBe(false);
    expect(el.querySelector("[data-unknown-notice]")?.textContent).toContain("ne sankciju");
    const spoken = [...el.querySelectorAll("p, th, td, summary, h3")].map((n) => n.textContent ?? "").join(" ");
    expect(forbiddenInReview(spoken)).toEqual([]);
  });

  it("PG-3: an unavailable composition says so and reads again on retry", async () => {
    let fail = true;
    const el = await mount(h(Composition, { documentId: DOC, extras: extras({
      composition: async () => (fail ? { kind: "unavailable" } : readOfParts([{ kind: "typed", percent: 100 }])) }) }));
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    fail = false;
    await act(async () => { el.querySelector("button")!.click(); });
    await settle();
    expect(el.querySelectorAll("tbody tr")).toHaveLength(1);
  });

  it("PG-5: lists the important places with „Skoči”, starts nothing and has no live region", async () => {
    const reads = { summary: () => ok(SUMMARY), details: () => ok({ activeEditingMinutes: 1, keyEvents: [] }) } as unknown as ReviewReads;
    const el = await mount(h(Places, { documentId: DOC, reads, replayHref: "/aplikacija/nastavnik/rad/x/reprodukcija" }));
    expect(el.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(el.querySelector("a[data-jump]")?.getAttribute("href")).toBe("/aplikacija/nastavnik/rad/x/reprodukcija");
    expect(el.querySelector("[aria-live]")).toBeNull();
    expect(el.textContent).toContain("Lijepljenje, 420 znakova");
    expect(el.textContent).toContain("razmak");
  });

  it("PG-5: without the details the list is never „nema”; it says so and reads again on retry", async () => {
    let fail = true;
    const empty = { ...(SUMMARY as object), pastes: { evidenceKind: "observed", listedAboveCharacters: 200, smallerCount: 0, listed: [] } } as never;
    const reads = { summary: () => ok(empty), details: () => (fail ? Promise.resolve({ kind: "unavailable" as const }) : ok({ activeEditingMinutes: 1, keyEvents: [] })) } as unknown as ReviewReads;
    const el = await mount(h(Places, { documentId: DOC, reads, replayHref: "/x" }));
    expect(el.querySelector("[data-details-unavailable]")).not.toBeNull();
    expect(el.textContent).not.toContain("U zapisu nema lijepljenja");
    fail = false;
    await act(async () => { el.querySelector("button")!.click(); });
    await settle();
    expect(el.querySelector("[data-details-unavailable]")).toBeNull();
    expect(el.textContent).toContain("U zapisu nema lijepljenja");
  });

  it("a read that throws becomes an error with a retry, never a permanent „Učitavam”", async () => {
    const el = await mount(h(Notes, { documentId: DOC, extras: extras({ disputes: () => Promise.reject(new Error("mreža")) }) }));
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(el.textContent).not.toContain("Učitavam");
    expect(el.querySelector("button")).not.toBeNull();
  });

  it("PG-9: a failed draft read offers a retry", async () => {
    const el = await mount(h(Given, { documentId: DOC, extras: extras({ drafts: async () => ({ kind: "unavailable" }) }) }));
    expect(el.querySelector("button")).not.toBeNull();
  });

  it("PG-7: shows the student's explanation, or says there is none, and points to the finding explanations", async () => {
    const el = await mount(h(Notes, { documentId: DOC, extras: extras() }));
    expect(el.textContent).toContain("Izmišljeno objašnjenje studenta.");
    expect(el.textContent).toContain("Prigovor");
    expect(el.querySelector('[data-missing="finding-explanation"]')).toBeNull();
    expect(el.textContent).toContain("Karti podrijetla");
    await act(async () => { root!.unmount(); });
    document.body.innerHTML = "";
    const none = await mount(h(Notes, { documentId: DOC, extras: extras({ disputes: async () => ({ kind: "ok", disputes: [] }) }) }));
    expect(none.textContent).toContain("Student još nije dao objašnjenje.");
  });

  it("PG-7: a refused read is not shown as „no explanation”", async () => {
    const el = await mount(h(Notes, { documentId: DOC, extras: extras({ disputes: async () => ({ kind: "forbidden" }) }) }));
    expect(el.textContent).not.toContain("Student još nije dao objašnjenje.");
    expect(el.textContent).toContain("samo nastavnik zadatka i mentor");
  });

  it("PG-9: lists published comments and marks the draft „nije objavljeno”; the student's view is said missing", async () => {
    const el = await mount(h(Given, { documentId: DOC, extras: extras() }));
    const rows = [...el.querySelectorAll("tbody tr")].map((r) => r.textContent ?? "");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("objavljeno studentu");
    expect(rows[1]).toContain("nije objavljeno");
    expect(rows[0]).toContain("Student je vidio ·");
    expect(rows[1]).not.toContain("Student je vidio");
    expect(rows[1]).not.toContain("Student još nije otvorio");
  });

  it("PG-9: without a seen record it says „Student još nije otvorio”", async () => {
    const el = await mount(h(Given, { documentId: DOC, extras: extras({ seen: async () => ({ kind: "ready", items: [] }) }) }));
    expect(el.querySelector("tbody tr")!.textContent).toContain("Student još nije otvorio");
  });

  it("PG-9: a failed seen read is said, never shown as „nije otvorio”", async () => {
    const el = await mount(h(Given, { documentId: DOC, extras: extras({ seen: () => Promise.reject(new Error("mreža")) }) }));
    expect(el.textContent).not.toContain("Student još nije otvorio");
    expect(el.querySelector('[data-seen-state="unavailable"]')).not.toBeNull();
    expect(el.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("PG-9: a failed draft read keeps the published comments and says so", async () => {
    const el = await mount(h(Given, { documentId: DOC, extras: extras({ drafts: async () => ({ kind: "unavailable" }) }) }));
    expect(el.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
  });
});
