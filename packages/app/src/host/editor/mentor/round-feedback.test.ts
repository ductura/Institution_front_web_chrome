// WEB-NF6-RUNDA (MK-8): "Što je mentor rekao". Invented comment, dates and identifiers only.
import { describe, expect, it } from "vitest";

import type { RevisionRequest } from "../../../../../../src/client/revision-requests";

import { currentReturn, latestReturn, openRequests, saidView, withReturn } from "./round-feedback";

const NOW = new Date("2026-11-22T10:00:00");
const ret = (documentId: string, createdAt: string, revisionDueAt: string | null = "2026-11-27T22:59:59.000Z") =>
  ({ documentId, comment: `Izmišljena napomena ${createdAt}`, revisionDueAt, createdAt });
const req = (state: RevisionRequest["state"]) => ({ id: state, state, versions: [] }) as unknown as RevisionRequest;

describe("latestReturn", () => {
  it("takes the newest return of this work only", () => {
    const list = [ret("rad-a", "2026-11-10T10:00:00.000Z"), ret("rad-b", "2026-11-20T10:00:00.000Z"), ret("rad-a", "2026-11-15T10:00:00.000Z")];
    expect(latestReturn(list, "rad-a")?.createdAt).toBe("2026-11-15T10:00:00.000Z");
    expect(latestReturn(list, "rad-c")).toBeNull();
  });
});

describe("withReturn", () => {
  it("gives a revision the return's deadline and comment, and leaves every other state alone", () => {
    const r = ret("rad-a", "2026-11-15T10:00:00.000Z");
    expect(withReturn({ kind: "revise", due: null, mustOpen: 1, request: null }, r))
      .toEqual({ kind: "revise", due: r.revisionDueAt, mustOpen: 1, request: r.comment });
    expect(withReturn({ kind: "revise", due: null, mustOpen: 1, request: "Uputa uz tekst." }, r)).toMatchObject({ request: "Uputa uz tekst." });
    expect(withReturn({ kind: "draft" }, r)).toEqual({ kind: "draft" });
    expect(withReturn(null, r)).toBeNull();
    expect(withReturn(undefined, r)).toBeUndefined();
  });
});

describe("saidView", () => {
  it("is empty when the mentor has said nothing", () => {
    expect(saidView(null, [req("accepted")], NOW)).toBeNull();
  });
  it("words the return, its deadline and the open requests", () => {
    const view = saidView(ret("rad-a", "2026-11-20T10:00:00.000Z"), [req("open"), req("reopened"), req("accepted")], NOW);
    expect(view?.comment).toBe("Izmišljena napomena 2026-11-20T10:00:00.000Z");
    expect(view?.due).toContain("(za 5 dana)");
    expect(view?.open).toBe("2 otvorena zahtjeva uz tekst");
    expect(view?.returned).toMatch(/^Vraćeno na doradu /);
  });
  it("says when the return names no deadline, and counts requests without a return", () => {
    expect(saidView(ret("rad-a", "2026-11-20T10:00:00.000Z", null), [], NOW)).toMatchObject({ due: "Rok dorade nije naveden.", open: "Nema otvorenih zahtjeva uz tekst." });
    expect(saidView(null, [req("open")], NOW)).toMatchObject({ returned: null, due: null, comment: null, open: "1 otvoren zahtjev uz tekst" });
    expect(openRequests([req("open"), req("responded"), req("withdrawn")])).toBe(1);
  });
});

describe("currentReturn (#631 review 2, point 5)", () => {
  const accepted = (window: string) => ({ id: window, state: "accepted", versions: [{ closed: { as: "accepted", window } }] }) as unknown as RevisionRequest;
  it("drops a return the mentor already reviewed past, and keeps one still in its round", () => {
    const old = ret("rad-a", "2026-11-10T10:00:00.000Z");
    expect(currentReturn(old, [accepted("2026-11-12T10:00:00.000Z"), req("open")])).toBeNull();
    expect(currentReturn(old, [accepted("2026-11-08T10:00:00.000Z"), req("open")])).toBe(old);
    expect(currentReturn(old, [])).toBe(old);
    expect(currentReturn(null, [req("open")])).toBeNull();
  });
});
