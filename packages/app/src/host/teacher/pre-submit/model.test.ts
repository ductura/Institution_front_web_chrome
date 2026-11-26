import { describe, expect, it } from "vitest";
import { fallbackText, openPlaces, placesFromRead, preSubmit, showFallback } from "./model";
import { preSubmitMessages as text } from "./messages.hr";

// Invented summary of an invented work.
const pastes = (listed: { at: { from: string; to: string }; characters: number }[]) => ({ pastes: { listedAboveCharacters: 200, listed } });

describe("N-07 Prije predaje model", () => {
  it("no listed paste says so with the threshold", () => {
    expect(preSubmit(pastes([])).pasted).toEqual({ rows: [], none: "Nema lijepljenja duljih od 200 znakova." });
  });
  it("lists each paste with time and size, in the server's order", () => {
    const p = preSubmit(pastes([
      { at: { from: "2026-10-19T08:10:00.000Z", to: "2026-10-19T08:11:00.000Z" }, characters: 412 },
      { at: { from: "2026-10-20T08:10:00.000Z", to: "2026-10-20T08:11:00.000Z" }, characters: 201 },
    ])).pasted;
    expect(p.none).toBeNull();
    expect(p.rows).toEqual(["19. listopada 2026. u 10:10 · 412 znakova", "20. listopada 2026. u 10:10 · 201 znak"]);
  });
  it("form rules are not run", () => {
    expect(preSubmit(pastes([])).form).toBe("Provjera oblika još nije pokrenuta.");
  });
  it("fallback: server state is drawn as in the prototype, otherwise unavailable", () => {
    const f = fallbackText({ kind: "unfinished", requestedAt: "2026-11-02T08:50:00.000Z" });
    expect(f.title).toBe("Predaja nije dovršena: zamjenski postupak");
    expect(f.body).toContain("Vrijeme zahtjeva studenta (2. studenoga 2026. u 09:50) je zabilježeno i ostaje vrijeme predaje.");
    expect(fallbackText({ kind: "unavailable" })).toEqual({ title: null, body: text.fallbackUnavailable });
  });
  it("fallback only beside a receipt that is not confirmed", () => {
    expect(["potvrdeno", "ceka", "error", "loading", "none"].filter((r) => showFallback(r as never))).toEqual(["ceka", "error"]);
  });
});

// Invented v3 document: two headings, an open place (unknown source) and a known citation.
const SRC = { id: "11111111-1111-4111-8111-111111111111", type: "book", authors: [{ kind: "person", family: "Autor A", given: "Ana" }], year: 2019, title: "Izmišljena knjiga", place: "Grad", publisher: "Nakladnik" };
const OPEN = { type: "citation", sourceId: "33333333-3333-4333-8333-333333333333" };
const para = (n: number, children: unknown[]) => ({ type: "paragraph", id: `22222222-2222-4222-8222-22222222222${n}`, children });
const heading = (n: number, text: string) => ({ type: "heading", level: 1, id: `44444444-4444-4444-8444-44444444444${n}`, children: [{ type: "text", text, marks: [] }] });
const doc = (nodes: unknown[]) => ({ schemaVersion: 3, sources: [SRC], nodes }) as never;
const known = { type: "citation", sourceId: SRC.id };

describe("N-07 open places for a source (NAS-R20)", () => {
  it("lists each open place under its numbered heading and paragraph; a known source is not listed", () => {
    const d = doc([
      para(1, [OPEN]), heading(1, "Uvod"), para(2, [known]),
      heading(2, "Teorijski okvir"), para(3, [{ type: "text", text: "a", marks: [] }]), para(4, [OPEN, OPEN]),
    ]);
    expect(openPlaces(d)).toEqual(["Odlomak 1", "2. Teorijski okvir, odlomak 2", "2. Teorijski okvir, odlomak 2"]);
  });
  it("a read document without open places says none", () => {
    expect(placesFromRead({ kind: "document", document: doc([heading(1, "Uvod"), para(1, [known])]) })).toEqual({ kind: "none" });
    expect(placesFromRead({ kind: "empty" })).toEqual({ kind: "none" });
  });
  it("a failed, signed-out or missing read is unavailable, never none; no answer yet is loading", () => {
    for (const kind of ["unavailable", "signedOut", "notFound"] as const) expect(placesFromRead({ kind })).toEqual({ kind: "unavailable" });
    expect(placesFromRead(null)).toEqual({ kind: "loading" });
  });
  it("a read document with open places is listed", () => {
    expect(placesFromRead({ kind: "document", document: doc([heading(1, "Uvod"), para(1, [OPEN])]) }))
      .toEqual({ kind: "places", rows: ["1. Uvod, odlomak 1"] });
  });
});
