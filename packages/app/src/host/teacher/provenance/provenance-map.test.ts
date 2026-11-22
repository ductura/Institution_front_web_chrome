import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProvenanceMapView } from "./ProvenanceMap";
import { provenanceText as t } from "./messages.hr";
import { DEFAULT_SWITCHES, legendItems, readOfParts, type MapSwitches, type ProvenanceState } from "./model";
import { provenanceReader } from "./read";

// Invented work; no real person or text.
const ORIGIN = "https://ductura.example.invalid";
const DOCUMENT = "izmisljeni-rad-1";
const KINDS = ["typed", "assistant_inserted", "assistant_match", "imported_file", "pasted_known", "pasted_unknown"] as const;
const parts = (over: Partial<Record<(typeof KINDS)[number], number>> = {}) =>
  KINDS.map((kind) => ({ kind, percent: over[kind] ?? 0 }));

function reader(response: Response | Error) {
  const transport = vi.fn<typeof fetch>();
  if (response instanceof Error) transport.mockRejectedValue(response);
  else transport.mockResolvedValue(response);
  return { transport, read: provenanceReader({ baseUrl: ORIGIN, fetchImpl: transport }) };
}

const input = (out: string, name: string) => out.match(new RegExp(`<input[^>]*data-sw="${name}"[^>]*>`))?.[0] ?? "";

const html = (state: ProvenanceState, switches: MapSwitches = DEFAULT_SWITCHES) =>
  renderToStaticMarkup(createElement(ProvenanceMapView, { state, switches, onSwitches: () => {}, onRetry: () => {} }));

describe("WEB-2158 Karta podrijetla: model", () => {
  it("has no marks when only typed text and the assistant match have a share", () => {
    expect(readOfParts(parts({ typed: 90, assistant_match: 10 }))).toEqual({ kind: "noMarks" });
    expect(readOfParts(parts())).toEqual({ kind: "noMarks" });
  });

  it("has marks for any paste, import or assistant transfer, also below one percent", () => {
    for (const kind of ["pasted_known", "pasted_unknown", "imported_file", "assistant_inserted"] as const) {
      expect(readOfParts(parts({ typed: 99.6, [kind]: 0.4 }))).toEqual({ kind: "marked" });
    }
  });

  it("shows the typed legend line only while both switches are on", () => {
    const keys = (s: MapSwitches) => legendItems(s).map((item) => item.key);
    expect(keys({ origin: true, typed: false })).toEqual(["paste", "ai", "imp", "teach", "open"]);
    expect(keys({ origin: true, typed: true })).toEqual(["paste", "ai", "imp", "teach", "open", "typed"]);
    expect(keys({ origin: false, typed: true })).toEqual(["paste", "ai", "imp", "teach", "open"]);
  });
});

describe("WEB-2158 Karta podrijetla: read", () => {
  it("asks work.origin-composition.get for the work and reads only whether marks exist", async () => {
    const { transport, read } = reader(Response.json({ parts: parts({ typed: 80, pasted_unknown: 20 }) }));
    expect(await read(DOCUMENT)).toEqual({ kind: "marked" });
    const [url, init] = transport.mock.calls[0] ?? [];
    expect(String(url)).toBe(`${ORIGIN}/api/v1/works/${DOCUMENT}/origin-composition`);
    expect(init?.method).toBe("GET");
  });

  it("maps 401, 404, 503, a broken answer and a network failure to their states", async () => {
    const json = (status: number, code: string) => Response.json({ code }, { status });
    expect(await reader(json(401, "unauthorized")).read(DOCUMENT)).toEqual({ kind: "signedOut" });
    expect(await reader(json(404, "not_found")).read(DOCUMENT)).toEqual({ kind: "notFound" });
    expect(await reader(json(503, "unavailable")).read(DOCUMENT)).toEqual({ kind: "unavailable" });
    expect(await reader(Response.json({ parts: [{ kind: "typed", percent: 100 }] })).read(DOCUMENT)).toEqual({ kind: "unavailable" });
    expect(await reader(new Error("offline")).read(DOCUMENT)).toEqual({ kind: "unavailable" });
    expect(await reader(Response.json({ parts: parts() })).read("")).toEqual({ kind: "notFound" });
  });
});

describe("WEB-2158 Karta podrijetla: view", () => {
  it("shows the title, the intro, the sentence on who typed, both switches and the legend", () => {
    const out = html({ kind: "marked" });
    for (const text of [t.title, t.intro, t.whoTyped, t.switchOrigin, t.switchTyped, t.legendPaste, t.legendAi,
      t.legendImport, t.legendTeacher, t.legendOpen, t.textUnavailable]) expect(out).toContain(text.replace(/„|”/g, ""));
    expect(input(out, "origin")).toContain('checked=""');
    expect(input(out, "typed")).not.toContain('checked=""');
    expect(input(out, "typed")).not.toContain("disabled");
    expect(out).not.toContain(t.legendTyped);
    expect(out).not.toMatch(/%/);
  });

  it("disables „Napisano u Ducturi” while „Podrijetlo teksta” is off", () => {
    const out = html({ kind: "marked" }, { origin: false, typed: true });
    expect(input(out, "typed")).toContain('disabled=""');
    expect(input(out, "typed")).not.toContain('checked=""');
    expect(input(out, "origin")).not.toContain('checked=""');
    expect(out).toContain('data-origin="off"');
    expect(out).not.toContain(t.legendTyped);
  });

  it("adds the typed legend line when both switches are on", () => {
    const out = html({ kind: "marked" }, { origin: true, typed: true });
    expect(out).toContain(t.legendTyped);
    expect(out).toContain('data-typed="on"');
  });

  it("says the map has no marks in the bez-oznaka state", () => {
    const out = html({ kind: "noMarks" });
    expect(out).toContain(t.noMarks);
    expect(out).not.toContain(t.textUnavailable);
  });

  it("shows loading, an error with retry, not found and signed out without switches", () => {
    expect(html({ kind: "loading" })).toContain('aria-busy="true"');
    const failed = html({ kind: "unavailable" });
    expect(failed).toContain(t.unavailable);
    expect(failed).toContain(t.retry);
    expect(html({ kind: "notFound" })).toContain(t.notFound);
    expect(html({ kind: "signedOut" })).toContain(t.signedOut);
    for (const state of ["loading", "unavailable", "notFound", "signedOut"] as const) expect(html({ kind: state })).not.toContain("data-sw");
  });
});
