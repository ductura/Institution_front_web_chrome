import { describe, expect, it } from "vitest";
import { fallbackText, preSubmit, showFallback } from "./model";
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
